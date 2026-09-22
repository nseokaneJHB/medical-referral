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
	stringToTitleCase,
} from "@referral-tracking/shared";

import {
	zeroFillCounts,
	generateUuid,
	localDateStartToUtc,
} from "../../lib/util";
import { parseEnumList } from "../../lib/validator";
import {
	canActOnReferral,
	canViewReferral,
	canRedirectReferral,
	canManageReferralSpecialties,
} from "../../lib/permission";

import { userOne } from "../../repository/user";
import { patientOne } from "../../repository/patient";
import { facilityOne } from "../../repository/facility";
import { timelineMany, timelineCreate } from "../../repository/timeline";
import {
	referralOne,
	referralMany,
	referralCount,
	referralCreate as repositoryReferralCreate,
	referralUpdate as repositoryReferralUpdate,
} from "../../repository/referral";
import {
	specialtyOne,
	specialtyLinkMany,
	specialtyLinkCreate,
	specialtyLinkDelete,
} from "../../repository/specialty";
import {
	autoAssignmentAttempt,
	autoAssignmentRevalidate,
	autoAssignmentRecheckFacility,
} from "../../repository/cross-schema/auto-assignment";

import { ReferralModel, type ReferralModelSelect } from "../../drizzle/schema";

import {
	buildOrderClause,
	type WhereClause,
	type WhereOperator,
} from "../../repository/helpers";

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

/** Raw FK columns stay selected for internal access-check logic; the Zod response schema doesn't declare them, so they're dropped on the wire. */
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

/** Creates a referral — `origin_facility_id` is resolved server-side from the patient, never the request; a patient already having an active referral isn't blocked here, just surfaced as a client-side warning. */
export const referralCreate = async (
	request: FastifyRequest<ReferralCreateRequest>,
	reply: FastifyReply<ReferralCreateRequest>,
): Promise<void> => {
	const database = request.server.database;
	const role = request.user!.role;

	const patient = await patientOne(database, {
		where: { id: request.body.patient_id },
		select: { id: true, facility_id: true },
	});

	if (!patient || patient.facility_id !== request.user!.facility_id) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const doctor = role === ROLES.DOCTOR ? request.user!.id : request.body.doctor;
	const { specialty_ids: specialtyIds, ...referralBody } = request.body;

	const created = await database.transaction(async (tx) => {
		const [createdReferral] = await repositoryReferralCreate(
			tx,
			{ select: { id: true } },
			{
				...referralBody,
				id: generateUuid(),
				referrer_id: request.user!.id,
				origin_facility_id: patient.facility_id,
				doctor,
			},
		);

		if (specialtyIds && specialtyIds.length > 0) {
			await specialtyLinkCreate(
				tx,
				{ owner: "referral", select: { id: true } },
				specialtyIds.map((specialtyId) => ({
					id: generateUuid(),
					referral_id: createdReferral.id,
					specialty_id: specialtyId,
				})),
			);
		}

		return createdReferral;
	});

	/** Best-effort and runs only after the transaction above commits — a matching bug must never prevent referral creation. */
	if (!doctor) {
		try {
			await autoAssignmentAttempt(database, {
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

	const referral = await referralOne(database, {
		where: { id: created.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Referral created.",
		data: referral!,
	});
};

/** Lists referrals scoped by role: Doctor sees their own plus unassigned ones at their facility, Nurse sees only ones they created, Manager sees their facility's either direction. */
export const referrals = async (
	request: FastifyRequest<ReferralsRequest>,
	reply: FastifyReply<ReferralsRequest>,
): Promise<void> => {
	const { query, server } = request;
	const database = server.database;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const role = request.user!.role;

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

	/** Snapshotted before the query-string filters below are layered on, so the stats stay a stable role-scoped picture, not reactive to the caller's current search/status/date filters. */
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

	const order = buildOrderClause<ReferralModelSelect>(
		query.sort,
		query.order,
		ReferralModel,
		"created_at",
		"desc",
	);

	const result = await referralMany(database, {
		page,
		limit,
		where,
		order,
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const statusCounts = zeroFillCounts(
		await referralCount(database, { where: roleScopeWhere, groupBy: "status" }),
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

/** Fetches a single referral, if the caller can view it. */
export const referral = async (
	request: FastifyRequest<ReferralRequest>,
	reply: FastifyReply<ReferralRequest>,
): Promise<void> => {
	const referral = await referralOne(request.server.database, {
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const role = request.user!.role;
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
		data: referral,
	});
};

/** `true` if a referral's status can no longer legally transition. */
const isTerminal = (status: string): boolean =>
	(TERMINAL_REFERRAL_STATUSES as string[]).includes(status);

/** Updates a referral's fields — Nurses only their own, Managers only doctor-assignment for referrals sent to their facility. */
export const referralUpdate = async (
	request: FastifyRequest<ReferralUpdateRequest>,
	reply: FastifyReply<ReferralUpdateRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await referralOne(database, {
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

	if (isTerminal(existing.status)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: `This referral has already reached a terminal status ("${stringToTitleCase(existing.status)}").`,
		});
	}

	const role = request.user!.role;
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

	/** A Manager assigning a doctor to a still-pending referral immediately accepts it too — no separate accept step. */
	const autoAccept =
		role === ROLES.MANAGER &&
		request.body.doctor &&
		existing.status === REFERRAL_STATUS.PENDING;

	const doctorChanged =
		request.body.doctor !== undefined &&
		request.body.doctor !== existing.doctor;

	if (doctorChanged) {
		await database.transaction(async (tx) => {
			await repositoryReferralUpdate(
				tx,
				{ where: { id: request.params.id }, select: { id: true } },
				autoAccept
					? { ...request.body, status: REFERRAL_STATUS.ACCEPTED }
					: request.body,
			);

			const [previousDoctor, assignedDoctor] = await Promise.all([
				existing.doctor
					? userOne(tx, {
							where: { id: existing.doctor },
							select: { name: true },
						})
					: Promise.resolve(null),
				userOne(tx, {
					where: { id: request.body.doctor! },
					select: { name: true },
				}),
			]);

			await timelineCreate(
				tx,
				{ select: { id: true } },
				{
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
			);
		});
	} else {
		await repositoryReferralUpdate(
			database,
			{ where: { id: request.params.id }, select: { id: true } },
			request.body,
		);
	}

	const referral = await referralOne(database, {
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral updated.",
		data: referral!,
	});
};

/** Lets a Doctor claim an unassigned referral sent to their own facility, auto-accepting it if still PENDING. */
export const referralAssign = async (
	request: FastifyRequest<ReferralAssignRequest>,
	reply: FastifyReply<ReferralAssignRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await referralOne(database, {
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

	if (isTerminal(existing.status)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: `This referral has already reached a terminal status ("${stringToTitleCase(existing.status)}").`,
		});
	}

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

	const autoAccept = existing.status === REFERRAL_STATUS.PENDING;

	await database.transaction(async (tx) => {
		await repositoryReferralUpdate(
			tx,
			{ where: { id: request.params.id }, select: { id: true } },
			autoAccept
				? { doctor: request.user!.id, status: REFERRAL_STATUS.ACCEPTED }
				: { doctor: request.user!.id },
		);

		await timelineCreate(
			tx,
			{ select: { id: true } },
			{
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: request.params.id,
				action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
				previous: existing.status,
				next: autoAccept ? REFERRAL_STATUS.ACCEPTED : existing.status,
				changer_id: request.user!.id,
				notes: `Assigned to ${request.user!.name}.`,
			},
		);
	});

	const referral = await referralOne(database, {
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral assigned.",
		data: referral!,
	});
};

/** Doctor-only — redirects a referral to a new destination, resetting it to PENDING with `doctor` cleared; refuses any facility already visited (origin, destination, or a prior redirect) or not currently APPROVED. */
export const referralRedirect = async (
	request: FastifyRequest<ReferralRedirectRequest>,
	reply: FastifyReply<ReferralRedirectRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await referralOne(database, {
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

	const role = request.user!.role;
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

	if (isTerminal(existing.status)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: `This referral has already reached a terminal status ("${stringToTitleCase(existing.status)}").`,
		});
	}

	const { destination_facility_id: newDestinationId, notes } = request.body;

	const destination = await facilityOne(database, {
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

	const priorRedirects = await timelineMany(database, {
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

	await database.transaction(async (tx) => {
		await repositoryReferralUpdate(
			tx,
			{ where: { id: existing.id }, select: { id: true } },
			{
				doctor: null,
				status: REFERRAL_STATUS.PENDING,
				destination_facility_id: newDestinationId,
			},
		);

		await timelineCreate(
			tx,
			{ select: { id: true } },
			{
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: existing.id,
				action: TIMELINE_ACTION.REDIRECTED,
				previous: existing.destination_facility_id,
				next: newDestinationId,
				changer_id: request.user!.id,
				notes,
			},
		);
	});

	const referral = await referralOne(database, {
		where: { id: existing.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral redirected.",
		data: referral!,
	});
};

/** Lists a referral's tagged specialties — viewable by anyone who can view the referral itself. */
export const referralSpecialties = async (
	request: FastifyRequest<ReferralSpecialtiesRequest>,
	reply: FastifyReply<ReferralSpecialtiesRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await referralOne(database, {
		where: { id: request.params.id },
		select: {
			id: true,
			referrer_id: true,
			doctor: true,
			origin_facility_id: true,
			destination_facility_id: true,
		},
	});

	const role = request.user!.role;
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

	const result = await specialtyLinkMany(database, {
		owner: "referral",
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
		data: result.data,
	});
};

/** Tags a specialty on a referral, then best-effort revalidates auto-assignment. */
export const referralSpecialtyAssign = async (
	request: FastifyRequest<ReferralSpecialtyAssignRequest>,
	reply: FastifyReply<ReferralSpecialtyAssignRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await referralOne(database, {
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

	const role = request.user!.role;
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

	if (isTerminal(existing.status)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: `This referral has already reached a terminal status ("${stringToTitleCase(existing.status)}").`,
		});
	}

	const specialty = await specialtyOne(database, {
		where: { id: request.body.specialty_id },
		select: { id: true, name: true, description: true },
	});

	if (!specialty) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Specialty not found." });
	}

	const existingLink = await specialtyLinkMany(database, {
		owner: "referral",
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

	const [link] = await specialtyLinkCreate(
		database,
		{
			owner: "referral",
			select: { id: true, referral_id: true, created_at: true },
		},
		{
			id: generateUuid(),
			referral_id: request.params.id,
			specialty_id: request.body.specialty_id,
		},
	);

	try {
		await autoAssignmentRevalidate(database, { referralId: request.params.id });
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

/** Untags a specialty from a referral, then best-effort revalidates auto-assignment. */
export const referralSpecialtyUnassign = async (
	request: FastifyRequest<ReferralSpecialtyUnassignRequest>,
	reply: FastifyReply<ReferralSpecialtyUnassignRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await referralOne(database, {
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

	const role = request.user!.role;
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

	if (isTerminal(existing.status)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: `This referral has already reached a terminal status ("${stringToTitleCase(existing.status)}").`,
		});
	}

	const deleted = await specialtyLinkDelete(database, {
		owner: "referral",
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
		await autoAssignmentRevalidate(database, { referralId: request.params.id });
	} catch (error) {
		request.log.error(
			{ error, referralId: request.params.id },
			"Auto-assignment revalidation failed after specialty untag.",
		);
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({ code, message: "Specialty untagged." });
};

/** Validates the requested status change against `STATUS_TRANSITIONS` and the per-role target restriction, then writes the new status and a `timeline` row together in one transaction. */
export const referralStatusUpdate = async (
	request: FastifyRequest<ReferralStatusUpdateRequest>,
	reply: FastifyReply<ReferralStatusUpdateRequest>,
): Promise<void> => {
	const database = request.server.database;
	const { next, notes } = request.body;

	const existing = await referralOne(database, {
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

	const role = request.user!.role;
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

	await database.transaction(async (tx) => {
		await repositoryReferralUpdate(
			tx,
			{ where: { id: request.params.id }, select: { id: true } },
			{ status: next },
		);

		await timelineCreate(
			tx,
			{ select: { id: true } },
			{
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: request.params.id,
				action: TIMELINE_ACTION.STATUS_CHANGE,
				previous: existing.status,
				next,
				changer_id: request.user!.id,
				notes: notes ?? null,
			},
		);
	});

	if (isTerminal(next) && existing.doctor) {
		try {
			await autoAssignmentRecheckFacility(database, {
				facilityId: existing.destination_facility_id,
			});
		} catch (error) {
			request.log.error(
				{ error, referralId: request.params.id },
				"Auto-assignment recheck failed after referral went terminal.",
			);
		}
	}

	const referral = await referralOne(database, {
		where: { id: request.params.id },
		select: REFERRAL_FIELDS,
		include: REFERRAL_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referral status updated.",
		data: referral!,
	});
};

/** Lists a referral's status/moderation timeline, paginated, if the caller can view the referral. */
export const referralHistory = async (
	request: FastifyRequest<ReferralHistoryRequest>,
	reply: FastifyReply<ReferralHistoryRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await referralOne(database, {
		where: { id: request.params.id },
		select: {
			id: true,
			referrer_id: true,
			doctor: true,
			origin_facility_id: true,
			destination_facility_id: true,
		},
	});

	const role = request.user!.role;
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

	const result = await timelineMany(database, {
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
