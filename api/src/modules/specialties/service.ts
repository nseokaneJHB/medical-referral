import type { FastifyReply, FastifyRequest } from "fastify";

import { HTTP_RESPONSE_CODE } from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";

import {
	SpecialtyModel,
	type SpecialtyModelSelect,
} from "../../drizzle/schema";

import { buildOrderClause, type WhereClause } from "../../repository/helpers";

import {
	specialtyMany,
	specialtyOne,
	specialtyCreate as repositorySpecialtyCreate,
	specialtyUpdate as repositorySpecialtyUpdate,
	specialtyLinkCount,
} from "../../repository/specialty";

import type {
	SpecialtiesRequest,
	SpecialtyRequest,
	SpecialtyCreateRequest,
	SpecialtyUpdateRequest,
} from "./type";

const SPECIALTY_FIELDS = {
	id: true,
	name: true,
	description: true,
	created_at: true,
	updated_at: true,
} as const;

/** Lists specialties with pagination/search, each annotated with its facility and staff assignment counts. */
export const specialties = async (
	request: FastifyRequest<SpecialtiesRequest>,
	reply: FastifyReply<SpecialtiesRequest>,
): Promise<void> => {
	const { query, server } = request;
	const database = server.database;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const where: WhereClause<SpecialtyModelSelect> = {};
	if (query.search) {
		where.name = { contains: query.search, mode: "insensitive" };
	}

	const order = buildOrderClause<SpecialtyModelSelect>(
		query.sort,
		query.order,
		SpecialtyModel,
		"name",
		"asc",
	);

	const result = await specialtyMany(database, {
		page,
		limit,
		where,
		order,
		select: SPECIALTY_FIELDS,
	});

	const [facilityCounts, staffCounts] = await Promise.all([
		specialtyLinkCount(database, { owner: "facility", groupBy: "specialty_id" }),
		specialtyLinkCount(database, { owner: "user", groupBy: "specialty_id" }),
	]);

	const data = result.data.map((row) => ({
		...row,
		facility_count: facilityCounts[row.id] ?? 0,
		staff_count: staffCounts[row.id] ?? 0,
	}));

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Specialties retrieved.",
		...result,
		data,
	});
};

/** Fetches a single specialty by id. */
export const specialty = async (
	request: FastifyRequest<SpecialtyRequest>,
	reply: FastifyReply<SpecialtyRequest>,
): Promise<void> => {
	const specialty = await specialtyOne(request.server.database, {
		where: { id: request.params.id },
		select: SPECIALTY_FIELDS,
	});

	if (!specialty) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Specialty not found." });
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Specialty retrieved.", data: specialty });
};

/** Creates a new specialty, rejecting a duplicate name. */
export const specialtyCreate = async (
	request: FastifyRequest<SpecialtyCreateRequest>,
	reply: FastifyReply<SpecialtyCreateRequest>,
): Promise<void> => {
	const existing = await specialtyOne(request.server.database, {
		where: { name: request.body.name },
		select: { id: true },
	});

	if (existing) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "A specialty with this name already exists." });
	}

	const [specialty] = await repositorySpecialtyCreate(
		request.server.database,
		{ select: SPECIALTY_FIELDS },
		{ id: generateUuid(), ...request.body },
	);

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply
		.status(status)
		.send({ code, message: "Specialty created.", data: specialty });
};

/** Updates a specialty, rejecting a rename onto an already-taken name. */
export const specialtyUpdate = async (
	request: FastifyRequest<SpecialtyUpdateRequest>,
	reply: FastifyReply<SpecialtyUpdateRequest>,
): Promise<void> => {
	const existing = await specialtyOne(request.server.database, {
		where: { id: request.params.id },
		select: { id: true },
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Specialty not found." });
	}

	if (request.body.name) {
		const nameTaken = await specialtyOne(request.server.database, {
			where: { name: request.body.name },
			select: { id: true },
		});
		if (nameTaken && nameTaken.id !== request.params.id) {
			const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
			return reply.status(status).send({
				code,
				message: "A specialty with this name already exists.",
			});
		}
	}

	const [updated] = await repositorySpecialtyUpdate(
		request.server.database,
		{ where: { id: request.params.id }, select: SPECIALTY_FIELDS },
		request.body,
	);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Specialty updated.", data: updated });
};
