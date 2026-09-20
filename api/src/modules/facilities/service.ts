import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	FACILITY_STATUS,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	createFacilitySchema,
	facilityStatusSchema,
	TERMINAL_REFERRAL_STATUSES,
	uuidSchema,
	type Role,
	type FacilityDetailResponse,
} from "@referral-tracking/shared";

import {
	generateUuid,
	zeroFillCounts,
	normalizeNullableFields,
} from "../../lib/util";
import { parseEnumList } from "../../lib/validator";

import type { CoreService } from "../../core";

import { FacilityModel, type FacilityModelSelect } from "../../drizzle/schema";

import { buildOrderClause, type WhereClause } from "../../core/helpers";

import type {
	FacilitiesRequest,
	FacilityUpdateRequest,
	FacilityRequest,
	FacilityHistoryRequest,
	FacilitySpecialtiesRequest,
	FacilitySpecialtyAssignRequest,
	FacilitySpecialtyUnassignRequest,
} from "./type";

const FACILITY_FIELDS = {
	id: true,
	name: true,
	address: true,
	status: true,
	created_at: true,
	updated_at: true,
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

const TIMELINE_INCLUDE = {
	changer: { select: { id: true, name: true } },
} as const;

/**
 * `GET /facilities/:id` only — referral and specialty counts for this
 * facility, same shape/reasoning as `doctorStats` in `modules/users/service.ts`.
 */
const facilityStats = async (
	core: Pick<CoreService, "referral" | "specialty">,
	facilityId: string,
): Promise<FacilityDetailResponse["data"]["stats"]> => {
	const [referralsReceived, activeReferrals, specialtiesCount] =
		await Promise.all([
			core.referral.count({ destination_facility_id: facilityId }),
			core.referral.count({
				destination_facility_id: facilityId,
				status: { notIn: TERMINAL_REFERRAL_STATUSES },
			}),
			core.specialty.linkCount("facility", { facility_id: facilityId }),
		]);

	return {
		referrals_received: referralsReceived,
		active_referrals: activeReferrals,
		specialties_count: specialtiesCount,
	};
};

/**
 * No `app.authenticate` on this route (see `route.ts`) — the unauthenticated
 * sign-up page needs to list facilities for a registering Nurse/Doctor/
 * Manager to pick from. Visibility is filtered by whoever's actually
 * asking, resolved here directly rather than via the hard `authenticate`
 * gate: no session (or Nurse/Doctor) sees only `APPROVED` facilities;
 * Manager sees `APPROVED` facilities plus their own regardless of status
 * (so they can track their own pending/rejected/flagged/suspended
 * facility); Administrator sees everything, unfiltered. Each concern
 * becomes its own clause, ANDed together via a single top-level `AND`,
 * rather than mixing a top-level `OR` and `AND` side by side.
 */
export const facilities = async (
	request: FastifyRequest<FacilitiesRequest>,
	reply: FastifyReply<FacilitiesRequest>,
): Promise<void> => {
	const { query, server } = request;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const caller =
		await request.server.management.session.resolveUserFromNodeHeaders(
			request.headers,
		);

	const clauses: WhereClause<FacilityModelSelect>[] = [];

	if (!caller || caller.role === ROLES.NURSE || caller.role === ROLES.DOCTOR) {
		clauses.push({ status: FACILITY_STATUS.APPROVED });
	} else if (caller.role === ROLES.MANAGER) {
		clauses.push(
			caller.facility_id
				? {
						OR: [
							{ status: FACILITY_STATUS.APPROVED },
							{ id: caller.facility_id },
						],
					}
				: { status: FACILITY_STATUS.APPROVED },
		);
	}

	const visibilityWhere: WhereClause<FacilityModelSelect> =
		clauses.length > 0 ? { AND: [...clauses] } : {};

	if (query.search) {
		clauses.push({
			OR: [
				{ name: { contains: query.search, mode: "insensitive" } },
				{ address: { contains: query.search, mode: "insensitive" } },
			],
		});
	}

	// ANDed with the visibility clause above, not a replacement for it — a
	// Nurse/Doctor filtering by a status they can't see just gets zero rows.
	if (query.status) {
		clauses.push({
			status: { in: parseEnumList(query.status, facilityStatusSchema) },
		});
	}

	// Facilities offering ANY of the given specialties — two-query fan-out
	// (link ids, then filter facilities by id) rather than a join, matching
	// `getPatientFlagStatuses`'s batch-lookup pattern in
	// `patients/service.ts`; `limit: 1000` is the same flat cap for the
	// same reason (realistic volumes nowhere near it). `inArray` on an
	// empty id list correctly resolves to zero rows (drizzle-orm emits
	// `sql\`false\``), so no empty-array guard is needed here.
	if (query.specialty) {
		const specialtyIds = parseEnumList(query.specialty, uuidSchema) ?? [];
		const links = await server.core.specialty.linkMany("facility", {
			page: 1,
			limit: 1000,
			where: { specialty_id: { in: specialtyIds } },
			select: { facility_id: true },
		});
		clauses.push({
			id: { in: links.data.map((link) => link.facility_id) },
		});
	}

	const where: WhereClause<FacilityModelSelect> =
		clauses.length > 0 ? { AND: clauses } : {};

	const order = buildOrderClause<FacilityModelSelect>(
		query.sort,
		query.order,
		FacilityModel,
		"name",
		"asc",
	);

	const result = await server.core.facility.many({
		page,
		limit,
		where,
		order,
		select: FACILITY_FIELDS,
	});

	const statusCounts = zeroFillCounts(
		await server.core.facility.count(visibilityWhere, "status"),
		FACILITY_STATUS,
	);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Facilities retrieved.",
		...result,
		status_counts: statusCounts,
	});
};

export const facility = async (
	request: FastifyRequest<FacilityRequest>,
	reply: FastifyReply<FacilityRequest>,
): Promise<void> => {
	const role = request.user!.role;
	if (
		role === ROLES.MANAGER &&
		request.params.id !== request.user!.facility_id
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply
			.status(status)
			.send({ code, message: "You may only view your own facility." });
	}

	const facility = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: FACILITY_FIELDS,
	});

	if (!facility) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}

	const stats = await facilityStats(request.server.core, facility.id);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Facility retrieved.",
		data: { ...facility, stats },
	});
};

export const facilityHistory = async (
	request: FastifyRequest<FacilityHistoryRequest>,
	reply: FastifyReply<FacilityHistoryRequest>,
): Promise<void> => {
	const role = request.user!.role;
	if (
		role === ROLES.MANAGER &&
		request.params.id !== request.user!.facility_id
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message: "You may only view your own facility's history.",
		});
	}

	const facility = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true },
	});

	if (!facility) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
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
		where: { type: TIMELINE_TYPE.FACILITY, entity: request.params.id },
		order: { changed_at: "desc" },
		select: TIMELINE_FIELDS,
		include: TIMELINE_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Facility history retrieved.",
		...result,
	});
};

export const facilityUpdate = async (
	request: FastifyRequest<FacilityUpdateRequest>,
	reply: FastifyReply<FacilityUpdateRequest>,
): Promise<void> => {
	const role = request.user!.role;
	if (
		role === ROLES.MANAGER &&
		request.params.id !== request.user!.facility_id
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply
			.status(status)
			.send({ code, message: "You may only edit your own facility." });
	}

	const existing = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true, name: true, address: true },
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}

	const body = normalizeNullableFields(request.body, createFacilitySchema);

	const changes = Object.entries(body)
		.filter(([key, value]) => value !== existing[key as keyof typeof existing])
		.map(
			([key, value]) =>
				`${key}: "${existing[key as keyof typeof existing]}" → "${value}"`,
		);

	const [facility] = await request.server.core.facility.update({
		where: { id: request.params.id },
		data: body,
		select: FACILITY_FIELDS,
	});

	if (!facility) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}

	if (changes.length > 0) {
		await request.server.core.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.FACILITY,
				entity: existing.id,
				action: TIMELINE_ACTION.UPDATED,
				previous: null,
				next: null,
				changer_id: request.user!.id,
				notes: changes.join("; "),
			},
			select: { id: true },
		});
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Facility updated.", data: facility });
};

/**
 * Same "Administrator, or the facility's own Manager" gate `facility()`/
 * `facilityUpdate()` enforce inline above — factored out here since it's
 * also what viewing a facility's specialties requires.
 */
const canViewFacilitySpecialties = (
	role: Role,
	callerFacilityId: string | null,
	facilityId: string,
): boolean => role !== ROLES.MANAGER || callerFacilityId === facilityId;

/**
 * Unlike viewing, assigning/unassigning a facility's specialties is
 * Manager-only for their own facility — Administrator manages the
 * specialty vocabulary itself (`modules/specialties`) but not any one
 * facility's assignments.
 */
const canAssignFacilitySpecialties = (
	role: Role,
	callerFacilityId: string | null,
	facilityId: string,
): boolean => role === ROLES.MANAGER && callerFacilityId === facilityId;

export const facilitySpecialties = async (
	request: FastifyRequest<FacilitySpecialtiesRequest>,
	reply: FastifyReply<FacilitySpecialtiesRequest>,
): Promise<void> => {
	const role = request.user!.role;
	if (
		!canViewFacilitySpecialties(
			role,
			request.user!.facility_id,
			request.params.id,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message: "You may only view your own facility's specialties.",
		});
	}

	const facility = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true },
	});

	if (!facility) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}

	const result = await request.server.core.specialty.linkMany("facility", {
		page: 1,
		limit: 100,
		where: { facility_id: request.params.id },
		select: { id: true, facility_id: true, created_at: true },
		include: {
			specialty: { select: { id: true, name: true, description: true } },
		},
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Facility specialties retrieved.",
		data: result.data,
	});
};

export const facilitySpecialtyAssign = async (
	request: FastifyRequest<FacilitySpecialtyAssignRequest>,
	reply: FastifyReply<FacilitySpecialtyAssignRequest>,
): Promise<void> => {
	const role = request.user!.role;
	if (
		!canAssignFacilitySpecialties(
			role,
			request.user!.facility_id,
			request.params.id,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message: "You may only manage your own facility's specialties.",
		});
	}

	const facility = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true },
	});

	if (!facility) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}

	const specialty = await request.server.core.specialty.one({
		where: { id: request.body.specialty_id },
		select: { id: true, name: true, description: true },
	});

	if (!specialty) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Specialty not found." });
	}

	const existing = await request.server.core.specialty.linkMany("facility", {
		page: 1,
		limit: 1,
		where: {
			facility_id: request.params.id,
			specialty_id: request.body.specialty_id,
		},
		select: { id: true },
	});

	if (existing.data.length > 0) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "This specialty is already assigned to the facility.",
		});
	}

	const [link] = await request.server.core.specialty.linkCreate("facility", {
		data: {
			id: generateUuid(),
			facility_id: request.params.id,
			specialty_id: request.body.specialty_id,
		},
		select: { id: true, facility_id: true, created_at: true },
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Specialty assigned.",
		data: { ...link, specialty },
	});
};

export const facilitySpecialtyUnassign = async (
	request: FastifyRequest<FacilitySpecialtyUnassignRequest>,
	reply: FastifyReply<FacilitySpecialtyUnassignRequest>,
): Promise<void> => {
	const role = request.user!.role;
	if (
		!canAssignFacilitySpecialties(
			role,
			request.user!.facility_id,
			request.params.id,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message: "You may only manage your own facility's specialties.",
		});
	}

	const deleted = await request.server.core.specialty.linkDelete("facility", {
		where: {
			facility_id: request.params.id,
			specialty_id: request.params.specialtyId,
		},
		select: { id: true },
	});

	if (deleted.length === 0) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({
			code,
			message: "This specialty isn't assigned to the facility.",
		});
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({ code, message: "Specialty unassigned." });
};
