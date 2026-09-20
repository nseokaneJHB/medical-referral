import type { FastifyReply, FastifyRequest } from "fastify";

import {
	HTTP_RESPONSE_CODE,
	orderDirectionSchema,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";
import {
	parseSortList,
	parseEnumList,
	buildOrderClause,
} from "../../lib/validator";

import {
	SpecialtyModel,
	type SpecialtyModelSelect,
} from "../../drizzle/schema";

import type { WhereClause } from "../../core/helpers";

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

export const specialties = async (
	request: FastifyRequest<SpecialtiesRequest>,
	reply: FastifyReply<SpecialtiesRequest>,
): Promise<void> => {
	const { query, server } = request;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const where: WhereClause<SpecialtyModelSelect> = {};
	if (query.search) {
		where.name = { contains: query.search, mode: "insensitive" };
	}

	const sorts = parseSortList(query.sort, SpecialtyModel, "name");
	const orders = parseEnumList(query.order, orderDirectionSchema) ?? ["asc"];
	const order = buildOrderClause<SpecialtyModelSelect>(sorts, orders, "asc");

	const result = await server.core.specialty.many({
		page,
		limit,
		where,
		order,
		select: SPECIALTY_FIELDS,
	});

	const [facilityCounts, staffCounts] = await Promise.all([
		server.core.specialty.linkCount("facility", undefined, "specialty_id"),
		server.core.specialty.linkCount("user", undefined, "specialty_id"),
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

export const specialty = async (
	request: FastifyRequest<SpecialtyRequest>,
	reply: FastifyReply<SpecialtyRequest>,
): Promise<void> => {
	const specialty = await request.server.core.specialty.one({
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

export const specialtyCreate = async (
	request: FastifyRequest<SpecialtyCreateRequest>,
	reply: FastifyReply<SpecialtyCreateRequest>,
): Promise<void> => {
	const existing = await request.server.core.specialty.one({
		where: { name: request.body.name },
		select: { id: true },
	});

	if (existing) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "A specialty with this name already exists." });
	}

	const [specialty] = await request.server.core.specialty.create({
		data: { id: generateUuid(), ...request.body },
		select: SPECIALTY_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply
		.status(status)
		.send({ code, message: "Specialty created.", data: specialty });
};

export const specialtyUpdate = async (
	request: FastifyRequest<SpecialtyUpdateRequest>,
	reply: FastifyReply<SpecialtyUpdateRequest>,
): Promise<void> => {
	const existing = await request.server.core.specialty.one({
		where: { id: request.params.id },
		select: { id: true },
	});

	if (!existing) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Specialty not found." });
	}

	if (request.body.name) {
		const nameTaken = await request.server.core.specialty.one({
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

	const [updated] = await request.server.core.specialty.update({
		where: { id: request.params.id },
		data: request.body,
		select: SPECIALTY_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Specialty updated.", data: updated });
};
