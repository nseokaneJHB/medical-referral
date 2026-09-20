import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	FACILITY_STATUS,
	REFERRAL_STATUS,
	STATUS_TRANSITIONS,
	NURSE_STATUS_TARGETS,
	TERMINAL_REFERRAL_STATUSES,
	DOCTOR_STATUS_TARGETS_BY_STATUS,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	prioritySchema,
	referralStatusSchema,
	orderDirectionSchema,
	stringToTitleCase,
	type Role,
	type ReferralResponse,
	type ReferralSpecialtyListResponse,
} from "@referral-tracking/shared";

import {
	zeroFillCounts,
	generateUuid,
	localDateStartToUtc,
} from "../../lib/util";
import {
	parseEnumList,
	parseSortList,
	buildOrderClause,
} from "../../lib/validator";
import {
	canActOnReferral,
	canViewReferral,
	canRedirectReferral,
	canManageReferralSpecialties,
} from "../../lib/permission";

import { AutoAssignmentManager } from "../../management/auto-assignment";

import { ReferralModel, type ReferralModelSelect } from "../../drizzle/schema";

import type { WhereClause, WhereOperator } from "../../core/helpers";

import type {
	ReferralRequest,
	ReferralsRequest,
	ReferralAssignRequest,
	ReferralCreateRequest,
	ReferralUpdateRequest,
	ReferralHistoryRequest,
	ReferralRedirectRequest,
	ReferralStatusUpdateRequest,
	ReferralSpecialtiesRequest,
	ReferralSpecialtyAssignRequest,
	ReferralSpecialtyUnassignRequest,
} from "./type";

// Raw FK columns stay selected for internal access-check logic — the Zod
// response schema doesn't declare them, so they're dropped on the wire.
const REFERRAL_FIELDS = {
	id: true,
	patient_id: true,
	origin_facility_id: true,
	destination_facility_id: true,
	visit_reason: true,
	referral_reason: true,
	priority: true,
	status: true,
	referrer_id: true,
	doctor: true,
	created_at: true,
	updated_at: true,
} as const;

const REFERRAL_INCLUDE = {
	patient: { select: { id: true, first_name: true, last_name: true } },
	referrer: { select: { id: true, name: true } },
	assignedDoctor: { select: { id: true, name: true } },
	origin_facility: { select: { id: true, name: true } },
	destination_facility: { select: { id: true, name: true } },
} as const;

const TIMELINE_FIELDS = {
	id: true,
	type: true,
	entity: true,
	action: true,
	previous: true,
	next: true,
	notes: true,
	changed_at: true,
} as const;

/**
 * `origin_facility_id` is resolved server-side from the patient, never the
 * request. No block on a patient already having an active referral —
 * that's surfaced as a non-blocking warning client-side instead (see
 * `patient_id` filter on `listReferrals` below), since a patient can
 * legitimately need a second, unrelated referral while a long-running one
 * is still open.
 */
export const referralCreate = async (
	request: FastifyRequest<ReferralCreateRequest>,
	reply: FastifyReply<ReferralCreateRequest>,
): Promise<void> => {
	const role = request.user!.role as Role;

	const patient = await request.server.core.patient.one({
		where: { id: request.body.patient_id },
		select: { id: true, facility_id: true },
	});

	if (!patient || patient.facility_id !== request.user!.facility_id) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const doctor = role === ROLES.DOCTOR ? request.user!.id : request.body.doctor;
	const { specialty_ids: specialtyIds, ...referralBody } = request.body;

	const created = await request.server.core.connection.transaction(
		async (tx) => {
			const txCore = request.server.core.withTransaction(tx);

			const [createdReferral] = await txCore.referral.create({
				data: {
					...referralBody,
					id: generateUuid(),
					referrer_id: request.user!.id,
					origin_facility_id: patient.facility_id,
					doctor,
				},
				select: { id: true },
			});

			if (specialtyIds && specialtyIds.length > 0) {
				await txCore.specialty.linkCreate("referral", {
					data: specialtyIds.map((specialtyId) => ({
						id: generateUuid(),
						referral_id: createdReferral.id,
						specialty_id: specialtyId,
					})),
					select: { id: true },
				});
			}

			return createdReferral;
		},
	);

	/** Best-effort and runs only after the transaction above commits — a matching bug must never prevent referral creation. */
	if (!doctor) {
		try {
			await new AutoAssignmentManager(request.server.core).attempt({
				referralId: created.id,
				facilityId: request.body.destination_facility_id,
				specialtyIds: specialtyIds ?? [],
				currentStatus: REFERRAL_STATUS.PENDING,
			});
		} catch (error) {
			request.log.error(
				{ error, referralId: created.id },
				"Auto-assignment failed after referral creation.",
			);
		}
	}

	const referral = await request.server.core.referral.one({
		where: { id: created.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Referral created.",
		data: referral as unknown as ReferralResponse["data"],
	});
};

/**
 * Doctor sees referrals assigned to them plus unassigned ones at their
 * facility (so self-assign is discoverable); Nurse sees only ones they
 * created; Manager sees their facility's either direction.
 */
export const referrals = async (
	request: FastifyRequest<ReferralsRequest>,
	reply: FastifyReply<ReferralsRequest>,
): Promise<void> => {
	const { query, server } = request;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const role = request.user!.role as Role;

	const where: WhereClause<ReferralModelSelect> = {};
	if (role === ROLES.DOCTOR) {
		where.OR = [
			{ doctor: request.user!.id },
			{
				doctor: { isNull: true },
				destination_facility_id: request.user!.facility_id!,
			},
		];
	}
	if (role === ROLES.NURSE) where.referrer_id = request.user!.id;
	if (role === ROLES.MANAGER) {
		where.OR = [
			{ origin_facility_id: request.user!.facility_id! },
			{ destination_facility_id: request.user!.facility_id! },
		];
	}

	// Snapshot taken before the query-string filters below are layered on —
	// the stats stay a stable role-scoped picture, not reactive to whatever
	// the caller currently has typed into search/status/date filters.
	const roleScopeWhere: WhereClause<ReferralModelSelect> = { ...where };

	const dateFilter: WhereOperator<Date> = {};
	if (query.from)
		dateFilter.gte = localDateStartToUtc(query.from, query.tz_offset);
	if (query.to) {
		const end = localDateStartToUtc(query.to, query.tz_offset);
		end.setUTCDate(end.getUTCDate() + 1);
		dateFilter.lt = end;
	}
	if (query.from || query.to) where.created_at = dateFilter;

	if (query.status) {
		where.status = { in: parseEnumList(query.status, referralStatusSchema) };
	}
	if (query.priority) {
		where.priority = { in: parseEnumList(query.priority, prioritySchema) };
	}

	if (query.search) {
		where.referral_reason = { contains: query.search, mode: "insensitive" };
	}

	if (query.patient_id) where.patient_id = query.patient_id;

	const sorts = parseSortList(query.sort, ReferralModel, "created_at");
	const orders = parseEnumList(query.order, orderDirectionSchema) ?? ["desc"];
	const order = buildOrderClause<ReferralModelSelect>(sorts, orders, "desc");

	const result = await server.core.referral.many({
		page,
		limit,
		where,
		order,
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const statusCounts = zeroFillCounts(
		await server.core.referral.count(roleScopeWhere, "status"),
		REFERRAL_STATUS,
	);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referrals retrieved.",
		...result,
		status_counts: statusCounts,
	});
};

export const referral = async (
	request: FastifyRequest<ReferralRequest>,
	reply: FastifyReply<ReferralRequest>,
): Promise<void> => {
	const referral = await request.server.core.referral.one({
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const role = request.user!.role as Role;
	if (
		!referral ||
		!canViewReferral(
			role,
			request.user!.id,
			request.user!.facility_id,
			referral,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral retrieved.",
		data: referral as unknown as ReferralResponse["data"],
	});
};

const isTerminal = (status: string): boolean =>
	(TERMINAL_REFERRAL_STATUSES as string[]).includes(status);

/** Sends the standard CONFLICT response and returns true when the referral is already terminal, so callers can `if (...) return;`. */
const requireNonTerminal = (
	reply: FastifyReply,
	referralStatus: string,
): boolean => {
	if (!isTerminal(referralStatus)) return false;

	const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
	reply.status(status).send({
		code,
		message: `This referral has already reached a terminal status ("${stringToTitleCase(referralStatus)}").`,
	});
	return true;
};

export const referralUpdate = async (
	request: FastifyRequest<ReferralUpdateRequest>,
	reply: FastifyReply<ReferralUpdateRequest>,
): Promise<void> => {
	const existing = await request.server.core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			status: true,
			referrer_id: true,
			doctor: true,
			destination_facility_id: true,
		},
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	if (requireNonTerminal(reply, existing.status)) return;

	const role = request.user!.role as Role;
	if (role === ROLES.NURSE && existing.referrer_id !== request.user!.id) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message: "Nurses may only update referrals they created.",
		});
	}

	if (role === ROLES.MANAGER) {
		if (existing.destination_facility_id !== request.user!.facility_id) {
			const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
			return reply.status(status).send({
				code,
				message: "Managers may only update referrals sent to their facility.",
			});
		}

		const disallowedFields = Object.keys(request.body).filter(
			(key) => key !== "doctor",
		);
		if (disallowedFields.length > 0) {
			const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
			return reply.status(status).send({
				code,
				message: `Managers may only assign a doctor, not: ${disallowedFields.join(", ")}.`,
			});
		}
	}

	// A Manager assigning a doctor to a still-pending referral immediately
	// accepts it too — no separate accept step (see Doctor self-assign below).
	const autoAccept =
		role === ROLES.MANAGER &&
		request.body.doctor &&
		existing.status === REFERRAL_STATUS.PENDING;

	// A doctor-assignment/reassignment event is auditable independent of
	// whether it also happens to auto-accept a PENDING referral — a
	// Manager reassigning an already-ACCEPTED referral's doctor must
	// leave a trail too.
	const doctorChanged =
		request.body.doctor !== undefined &&
		request.body.doctor !== existing.doctor;

	if (doctorChanged) {
		await request.server.core.connection.transaction(async (tx) => {
			const txCore = request.server.core.withTransaction(tx);

			await txCore.referral.update({
				where: { id: request.params.id },
				data: autoAccept
					? { ...request.body, status: REFERRAL_STATUS.ACCEPTED }
					: request.body,
				select: { id: true },
			});

			const [previousDoctor, assignedDoctor] = await Promise.all([
				existing.doctor
					? txCore.user.one({
							where: { id: existing.doctor },
							select: { name: true },
						})
					: Promise.resolve(null),
				txCore.user.one({
					where: { id: request.body.doctor! },
					select: { name: true },
				}),
			]);

			await txCore.timeline.create({
				data: {
					id: generateUuid(),
					type: TIMELINE_TYPE.REFERRAL,
					entity: request.params.id,
					action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
					previous: existing.status,
					next: autoAccept ? REFERRAL_STATUS.ACCEPTED : existing.status,
					changer_id: request.user!.id,
					notes: previousDoctor?.name
						? `Reassigned from ${previousDoctor.name} to ${assignedDoctor?.name ?? "Unknown"}.`
						: assignedDoctor?.name
							? `Assigned to ${assignedDoctor.name}.`
							: null,
				},
				select: { id: true },
			});
		});
	} else {
		await request.server.core.referral.update({
			where: { id: request.params.id },
			data: request.body,
			select: { id: true },
		});
	}

	const referral = await request.server.core.referral.one({
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral updated.",
		data: referral as unknown as ReferralResponse["data"],
	});
};

/**
 * Lets a Doctor claim an unassigned referral themselves, rather than
 * waiting on an Admin to assign one via `PATCH /:id`. Deliberately a
 * separate sub-resource (mirrors `/:id/status`) instead of opening up the
 * general update endpoint to Doctors — narrower, auditable permission
 * surface. Restricted to referrals sent to the Doctor's own facility; a
 * Doctor can't claim referrals headed elsewhere.
 */
export const referralAssign = async (
	request: FastifyRequest<ReferralAssignRequest>,
	reply: FastifyReply<ReferralAssignRequest>,
): Promise<void> => {
	const existing = await request.server.core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			status: true,
			doctor: true,
			destination_facility_id: true,
		},
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	if (requireNonTerminal(reply, existing.status)) return;

	if (existing.doctor) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "This referral already has an assigned doctor." });
	}

	if (request.user!.facility_id !== existing.destination_facility_id) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only assign yourself to referrals sent to your facility.",
		});
	}

	// Claiming a still-pending referral immediately accepts it too — no
	// separate accept step (see Manager doctor-assignment in `updateReferral`).
	const autoAccept = existing.status === REFERRAL_STATUS.PENDING;

	await request.server.core.connection.transaction(async (tx) => {
		const txCore = request.server.core.withTransaction(tx);

		await txCore.referral.update({
			where: { id: request.params.id },
			data: autoAccept
				? { doctor: request.user!.id, status: REFERRAL_STATUS.ACCEPTED }
				: { doctor: request.user!.id },
			select: { id: true },
		});

		// `existing.doctor` is always null here — self-claim is blocked
		// earlier in this handler whenever a doctor is already assigned —
		// so this is always a fresh assignment, never a reassignment.
		await txCore.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: request.params.id,
				action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
				previous: existing.status,
				next: autoAccept ? REFERRAL_STATUS.ACCEPTED : existing.status,
				changer_id: request.user!.id,
				notes: `Assigned to ${request.user!.name}.`,
			},
			select: { id: true },
		});
	});

	const referral = await request.server.core.referral.one({
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral assigned.",
		data: referral as unknown as ReferralResponse["data"],
	});
};

/**
 * Doctor-only. Resets the referral to `PENDING` and clears `doctor` at the
 * new destination, so that facility's Manager/Doctor triages it fresh —
 * matching how a normal new referral is picked up (see
 * `docs/roles-permissions.md`). Refuses any facility this referral has
 * already been at (origin, current destination, or any prior redirect's
 * destination) — closes the ping-pong/loop risk without an arbitrary hop
 * limit — and any facility that isn't currently `APPROVED`.
 */
export const referralRedirect = async (
	request: FastifyRequest<ReferralRedirectRequest>,
	reply: FastifyReply<ReferralRedirectRequest>,
): Promise<void> => {
	const { core } = request.server;

	const existing = await core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			status: true,
			doctor: true,
			origin_facility_id: true,
			destination_facility_id: true,
		},
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	const role = request.user!.role as Role;
	if (
		!canRedirectReferral(
			role,
			request.user!.id,
			request.user!.facility_id,
			existing,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only redirect a referral assigned to you, or unassigned and sent to your facility.",
		});
	}

	if (requireNonTerminal(reply, existing.status)) return;

	const { destination_facility_id: newDestinationId, notes } = request.body;

	const destination = await core.facility.one({
		where: { id: newDestinationId },
		select: { id: true, status: true },
	});

	if (!destination || destination.status !== FACILITY_STATUS.APPROVED) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "The destination facility isn't currently available.",
		});
	}

	const priorRedirects = await core.timeline.many({
		page: 1,
		limit: 1000,
		where: {
			type: TIMELINE_TYPE.REFERRAL,
			entity: existing.id,
			action: TIMELINE_ACTION.REDIRECTED,
		},
		select: { previous: true, next: true },
	});

	const visitedFacilityIds = new Set<string>([
		existing.origin_facility_id,
		existing.destination_facility_id,
		...priorRedirects.data.flatMap((row) =>
			[row.previous, row.next].filter((id): id is string => id !== null),
		),
	]);

	if (visitedFacilityIds.has(newDestinationId)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "This referral has already been at that facility.",
		});
	}

	await core.connection.transaction(async (tx) => {
		const txCore = core.withTransaction(tx);

		await txCore.referral.update({
			where: { id: existing.id },
			data: {
				doctor: null,
				status: REFERRAL_STATUS.PENDING,
				destination_facility_id: newDestinationId,
			},
			select: { id: true },
		});

		await txCore.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: existing.id,
				action: TIMELINE_ACTION.REDIRECTED,
				previous: existing.destination_facility_id,
				next: newDestinationId,
				changer_id: request.user!.id,
				notes,
			},
			select: { id: true },
		});
	});

	const referral = await core.referral.one({
		where: { id: existing.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral redirected.",
		data: referral as unknown as ReferralResponse["data"],
	});
};

/**
 * Which clinical specialties a referral needs. Viewable by anyone who can
 * view the referral (`canViewReferral`); tagging/untagging is narrower
 * (`canManageReferralSpecialties`) — the referring Nurse, or an assigned/
 * eligible-unassigned Doctor, and only while the referral is still open.
 */
export const referralSpecialties = async (
	request: FastifyRequest<ReferralSpecialtiesRequest>,
	reply: FastifyReply<ReferralSpecialtiesRequest>,
): Promise<void> => {
	const { core } = request.server;

	const existing = await core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			referrer_id: true,
			doctor: true,
			origin_facility_id: true,
			destination_facility_id: true,
		},
	});

	const role = request.user!.role as Role;
	if (
		!existing ||
		!canViewReferral(
			role,
			request.user!.id,
			request.user!.facility_id,
			existing,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	const result = await core.specialty.linkMany("referral", {
		page: 1,
		limit: 100,
		where: { referral_id: request.params.id },
		select: { id: true, referral_id: true, created_at: true },
		include: {
			specialty: { select: { id: true, name: true, description: true } },
		},
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral specialties retrieved.",
		// `include`-derived fields (`specialty`) aren't modeled by `linkMany`'s
		// return type — present at runtime, just invisible to this type. See
		// `core/helpers.ts`.
		data: result.data as unknown as ReferralSpecialtyListResponse["data"],
	});
};

export const referralSpecialtyAssign = async (
	request: FastifyRequest<ReferralSpecialtyAssignRequest>,
	reply: FastifyReply<ReferralSpecialtyAssignRequest>,
): Promise<void> => {
	const { core } = request.server;

	const existing = await core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			status: true,
			referrer_id: true,
			doctor: true,
			destination_facility_id: true,
		},
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	const role = request.user!.role as Role;
	if (
		!canManageReferralSpecialties(
			role,
			request.user!.id,
			request.user!.facility_id,
			existing,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only tag specialties on a referral you created or are assigned to.",
		});
	}

	if (requireNonTerminal(reply, existing.status)) return;

	const specialty = await core.specialty.one({
		where: { id: request.body.specialty_id },
		select: { id: true, name: true, description: true },
	});

	if (!specialty) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Specialty not found." });
	}

	const existingLink = await core.specialty.linkMany("referral", {
		page: 1,
		limit: 1,
		where: {
			referral_id: request.params.id,
			specialty_id: request.body.specialty_id,
		},
		select: { id: true },
	});

	if (existingLink.data.length > 0) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "This specialty is already tagged on the referral.",
		});
	}

	const [link] = await core.specialty.linkCreate("referral", {
		data: {
			id: generateUuid(),
			referral_id: request.params.id,
			specialty_id: request.body.specialty_id,
		},
		select: { id: true, referral_id: true, created_at: true },
	});

	try {
		await new AutoAssignmentManager(core).revalidate(request.params.id);
	} catch (error) {
		request.log.error(
			{ error, referralId: request.params.id },
			"Auto-assignment revalidation failed after specialty tag.",
		);
	}

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Specialty tagged.",
		data: { ...link, specialty },
	});
};

export const referralSpecialtyUnassign = async (
	request: FastifyRequest<ReferralSpecialtyUnassignRequest>,
	reply: FastifyReply<ReferralSpecialtyUnassignRequest>,
): Promise<void> => {
	const { core } = request.server;

	const existing = await core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			status: true,
			referrer_id: true,
			doctor: true,
			destination_facility_id: true,
		},
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	const role = request.user!.role as Role;
	if (
		!canManageReferralSpecialties(
			role,
			request.user!.id,
			request.user!.facility_id,
			existing,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only tag specialties on a referral you created or are assigned to.",
		});
	}

	if (requireNonTerminal(reply, existing.status)) return;

	const deleted = await core.specialty.linkDelete("referral", {
		where: {
			referral_id: request.params.id,
			specialty_id: request.params.specialtyId,
		},
		select: { id: true },
	});

	if (deleted.length === 0) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({
			code,
			message: "This specialty isn't tagged on the referral.",
		});
	}

	try {
		await new AutoAssignmentManager(core).revalidate(request.params.id);
	} catch (error) {
		request.log.error(
			{ error, referralId: request.params.id },
			"Auto-assignment revalidation failed after specialty untag.",
		);
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({ code, message: "Specialty untagged." });
};

/**
 * Validates against `STATUS_TRANSITIONS` (build-spec.md section 2.3) AND the
 * per-role target restriction, then writes the new status and a `timeline`
 * row together in one transaction.
 */
export const referralStatusUpdate = async (
	request: FastifyRequest<ReferralStatusUpdateRequest>,
	reply: FastifyReply<ReferralStatusUpdateRequest>,
): Promise<void> => {
	const { core } = request.server;
	const { next, notes } = request.body;

	const existing = await core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			status: true,
			referrer_id: true,
			doctor: true,
			destination_facility_id: true,
		},
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	const role = request.user!.role as Role;
	if (!canActOnReferral(role, request.user!.id, existing)) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				role === ROLES.NURSE
					? "Nurses may only update the status of referrals they created."
					: "Doctors may only update the status of referrals assigned to them.",
		});
	}

	const legalNextStates =
		STATUS_TRANSITIONS[existing.status as keyof typeof STATUS_TRANSITIONS];
	if (!legalNextStates?.includes(next)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: `Cannot move a referral from "${stringToTitleCase(existing.status)}" to "${stringToTitleCase(next)}".`,
		});
	}

	const allowedTargets =
		role === ROLES.NURSE
			? NURSE_STATUS_TARGETS
			: (DOCTOR_STATUS_TARGETS_BY_STATUS[
					existing.status as keyof typeof DOCTOR_STATUS_TARGETS_BY_STATUS
				] ?? []);
	if (!allowedTargets.includes(next)) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message: `${role === ROLES.NURSE ? "Nurses" : "Doctors"} may not set a referral's status to "${stringToTitleCase(next)}".`,
		});
	}

	await core.connection.transaction(async (tx) => {
		const txCore = core.withTransaction(tx);

		await txCore.referral.update({
			where: { id: request.params.id },
			data: { status: next },
			select: { id: true },
		});

		await txCore.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: request.params.id,
				action: TIMELINE_ACTION.STATUS_CHANGE,
				previous: existing.status,
				next,
				changer_id: request.user!.id,
				notes: notes ?? null,
			},
			select: { id: true },
		});
	});

	if (isTerminal(next) && existing.doctor) {
		try {
			await new AutoAssignmentManager(core).recheckFacility(
				existing.destination_facility_id,
			);
		} catch (error) {
			request.log.error(
				{ error, referralId: request.params.id },
				"Auto-assignment recheck failed after referral went terminal.",
			);
		}
	}

	const referral = await core.referral.one({
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral status updated.",
		data: referral as unknown as ReferralResponse["data"],
	});
};

export const referralHistory = async (
	request: FastifyRequest<ReferralHistoryRequest>,
	reply: FastifyReply<ReferralHistoryRequest>,
): Promise<void> => {
	const existing = await request.server.core.referral.one({
		where: { id: request.params.id },
		select: {
			id: true,
			referrer_id: true,
			doctor: true,
			origin_facility_id: true,
			destination_facility_id: true,
		},
	});

	const role = request.user!.role as Role;
	if (
		!existing ||
		!canViewReferral(
			role,
			request.user!.id,
			request.user!.facility_id,
			existing,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Referral not found." });
	}

	const page = request.query.page
		? Number(request.query.page)
		: DEFAULT_PAGE_NUMBER;
	const limit = request.query.limit
		? Number(request.query.limit)
		: DEFAULT_PAGE_LIMIT;

	const result = await request.server.core.timeline.many({
		page,
		limit,
		where: { type: TIMELINE_TYPE.REFERRAL, entity: request.params.id },
		order: { changed_at: "desc" },
		select: TIMELINE_FIELDS,
		include: { changer: { select: { id: true, name: true } } },
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral history retrieved.",
		...result,
	});
};
