import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	TIMELINE_TYPE,
	FACILITY_STATUS,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	CreateFacilitySchema,
	orderDirectionSchema,
	facilityStatusSchema,
	type Role,
} from "@referral-tracking/shared";

import { normalizeNullableFields } from "../../lib/util";
import { parseEnumList, parseSortList } from "../../lib/validator";

import { FacilityModel, type FacilityModelSelect } from "../../drizzle/schema";

import type { OrderClause, WhereClause } from "../../core/helpers";

import type {
	FacilitiesRequest,
	FacilityUpdateRequest,
	FacilityRequest,
	FacilityHistoryRequest,
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

	const where: WhereClause<FacilityModelSelect> =
		clauses.length > 0 ? { AND: clauses } : {};

	const sorts = parseSortList(query.sort, FacilityModel, "name");
	const orders = parseEnumList(query.order, orderDirectionSchema) ?? ["asc"];
	const order = Object.fromEntries(
		sorts.map((sorting, index) => [
			sorting,
			orders[index] || orders[0] || "asc",
		]),
	) as OrderClause<FacilityModelSelect>;

	const result = await server.core.facility.many({
		page,
		limit,
		where,
		order,
		select: FACILITY_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Facilities retrieved.",
		...result,
	});
};

export const facility = async (
	request: FastifyRequest<FacilityRequest>,
	reply: FastifyReply<FacilityRequest>,
): Promise<void> => {
	const role = request.user!.role as Role;
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

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Facility retrieved.", data: facility });
};

export const facilityHistory = async (
	request: FastifyRequest<FacilityHistoryRequest>,
	reply: FastifyReply<FacilityHistoryRequest>,
): Promise<void> => {
	const role = request.user!.role as Role;
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
	const role = request.user!.role as Role;
	if (
		role === ROLES.MANAGER &&
		request.params.id !== request.user!.facility_id
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply
			.status(status)
			.send({ code, message: "You may only edit your own facility." });
	}

	const [facility] = await request.server.core.facility.update({
		where: { id: request.params.id },
		data: normalizeNullableFields(request.body, CreateFacilitySchema),
		select: FACILITY_FIELDS,
	});

	if (!facility) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Facility updated.", data: facility });
};
