import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	genderSchema,
	HTTP_RESPONSE_CODE,
	orderDirectionSchema,
	CreatePatientSchema,
	type Role,
	type PatientResponse,
} from "@referral-tracking/shared";

import { generateUuid, normalizeNullableFields } from "../../lib/util";
import { parseEnumList, parseSortList } from "../../lib/validator";
import { canAccessPatient } from "../../lib/permission";

import { PatientModel, type PatientModelSelect } from "../../drizzle/schema";

import type {
	OrderClause,
	WhereClause,
	WhereOperator,
} from "../../core/helpers";

import type {
	PatientRequest,
	PatientsRequest,
	PatientCreateRequest,
	PatientUpdateRequest,
} from "./type";

// `facility_id` stays selected for the internal access check below — the
// Zod response schema no longer declares it, so it's dropped on the wire.
const PATIENT_FIELDS = {
	id: true,
	first_name: true,
	last_name: true,
	date_of_birth: true,
	gender: true,
	phone: true,
	address: true,
	facility_id: true,
	created_at: true,
	updated_at: true,
} as const;

const PATIENT_INCLUDE = {
	creator: { select: { id: true, name: true } },
	facility: { select: { id: true, name: true } },
} as const;

/**
 * `facility_id` is always the Nurse's own — only Nurses register patients.
 */
export const patientCreate = async (
	request: FastifyRequest<PatientCreateRequest>,
	reply: FastifyReply<PatientCreateRequest>,
): Promise<void> => {
	const [created] = await request.server.core.patient.create({
		data: {
			...normalizeNullableFields(request.body, CreatePatientSchema),
			id: generateUuid(),
			creator_id: request.user!.id,
			facility_id: request.user!.facility_id!,
		},
		select: { id: true },
	});

	const patient = await request.server.core.patient.one({
		where: { id: created.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Patient created.",
		// `include`-derived fields (`creator`/`facility`) aren't modeled by
		// `WithCount` — present at runtime, just invisible to this type.
		data: patient as unknown as PatientResponse["data"],
	});
};

/**
 * Date range/search/sort as usual; every role reaching this handler
 * (Nurse/Doctor/Manager) is scoped to their own facility.
 */
export const patients = async (
	request: FastifyRequest<PatientsRequest>,
	reply: FastifyReply<PatientsRequest>,
): Promise<void> => {
	const { query, server } = request;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const dateFilter: WhereOperator<Date> = {};
	if (query.from) dateFilter.gte = new Date(`${query.from}T00:00:00.000Z`);
	if (query.to) {
		const end = new Date(`${query.to}T00:00:00.000Z`);
		end.setUTCDate(end.getUTCDate() + 1);
		dateFilter.lt = end;
	}

	const where: WhereClause<PatientModelSelect> = {
		facility_id: request.user!.facility_id!,
	};
	if (query.from || query.to) where.created_at = dateFilter;

	if (query.search) {
		where.OR = [
			{ first_name: { contains: query.search, mode: "insensitive" } },
			{ last_name: { contains: query.search, mode: "insensitive" } },
			{ phone: { contains: query.search, mode: "insensitive" } },
		];
	}

	if (query.gender) {
		where.gender = { in: parseEnumList(query.gender, genderSchema) };
	}

	const dobFilter: WhereOperator<string> = {};
	if (query.dob_from) dobFilter.gte = query.dob_from;
	if (query.dob_to) dobFilter.lte = query.dob_to;
	if (query.dob_from || query.dob_to) where.date_of_birth = dobFilter;

	const sorts = parseSortList(query.sort, PatientModel, "created_at");
	const orders = parseEnumList(query.order, orderDirectionSchema) ?? ["desc"];
	const order = Object.fromEntries(
		sorts.map((sorting, index) => [
			sorting,
			orders[index] || orders[0] || "desc",
		]),
	) as OrderClause<PatientModelSelect>;

	const result = await server.core.patient.many({
		page,
		limit,
		where,
		order,
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patients retrieved.",
		...result,
	});
};

export const patient = async (
	request: FastifyRequest<PatientRequest>,
	reply: FastifyReply<PatientRequest>,
): Promise<void> => {
	const patient = await request.server.core.patient.one({
		where: { id: request.params.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	if (
		!patient ||
		!(await canAccessPatient(
			request.server.core,
			request.user!.facility_id,
			patient,
		))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient retrieved.",
		data: patient as unknown as PatientResponse["data"],
	});
};

/**
 * Nurse-only — Doctors no longer have any patient field to update
 * (medical history is now derived from referrals, not stored on the
 * patient record). Nurses may update anything but `facility_id` — that's
 * the (not-yet-built) transfer workflow's job.
 */
export const patientUpdate = async (
	request: FastifyRequest<PatientUpdateRequest>,
	reply: FastifyReply<PatientUpdateRequest>,
): Promise<void> => {
	const role = request.user!.role as Role;

	const existing = await request.server.core.patient.one({
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (
		!existing ||
		!(await canAccessPatient(
			request.server.core,
			request.user!.facility_id,
			existing,
		))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const body = normalizeNullableFields(request.body, CreatePatientSchema);

	if (role === ROLES.NURSE && "facility_id" in body) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply
			.status(status)
			.send({ code, message: "Nurses may not change a patient's facility." });
	}

	const [updated] = await request.server.core.patient.update({
		where: { id: request.params.id },
		data: body,
		select: { id: true },
	});

	if (!updated) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const patient = await request.server.core.patient.one({
		where: { id: updated.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient updated.",
		data: patient as unknown as PatientResponse["data"],
	});
};
