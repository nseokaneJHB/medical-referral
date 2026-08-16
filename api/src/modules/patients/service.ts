import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	genderSchema,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	HTTP_RESPONSE_CODE,
	orderDirectionSchema,
	CreatePatientSchema,
	TERMINAL_REFERRAL_STATUSES,
	type Role,
	type PatientResponse,
} from "@referral-tracking/shared";

import { generateUuid, normalizeNullableFields } from "../../lib/util";
import { parseEnumList, parseSortList } from "../../lib/validator";
import { canAccessPatient } from "../../lib/permission";

import type { CoreService } from "../../core";

import { PatientModel, type PatientModelSelect } from "../../drizzle/schema";

import type {
	OrderClause,
	WhereClause,
	WhereOperator,
} from "../../core/helpers";

import type {
	PatientRequest,
	PatientsRequest,
	PatientFlagRequest,
	PatientCreateRequest,
	PatientUpdateRequest,
	PatientUnflagRequest,
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

interface FlagStatus {
	flagged: boolean;
	flag_reason: string | null;
}

/**
 * Batched flag-status lookup — one query for however many patients are in
 * play (a single detail row, or a whole list page), not one query per
 * patient. `limit: 1000` mirrors `manager/service.ts`'s `appeals` handler,
 * which uses the same flat-cap-on-an-internal-batch-lookup pattern for the
 * same reason: realistic volumes here are nowhere near that cap, so a real
 * grouped/windowed query isn't worth the complexity this pass.
 * "Flagged" = the most recent `FLAGGED`/`UNFLAGGED` timeline row for that
 * patient is a `FLAGGED` one with no later `UNFLAGGED` — see
 * `docs/roles-permissions.md`'s "flag is orthogonal to status" design.
 */
const getPatientFlagStatuses = async (
	core: Pick<CoreService, "timeline">,
	patientIds: string[],
): Promise<Map<string, FlagStatus>> => {
	const statuses = new Map<string, FlagStatus>();
	if (patientIds.length === 0) return statuses;

	const result = await core.timeline.many({
		page: 1,
		limit: 1000,
		where: {
			type: TIMELINE_TYPE.PATIENT,
			entity: { in: patientIds },
			action: { in: [TIMELINE_ACTION.FLAGGED, TIMELINE_ACTION.UNFLAGGED] },
		},
		order: { changed_at: "desc" },
		select: { entity: true, action: true, notes: true },
	});

	for (const row of result.data) {
		// Rows arrive most-recent-first; the first row seen per patient is
		// that patient's current flag status — skip any older rows after.
		if (statuses.has(row.entity)) continue;
		statuses.set(row.entity, {
			flagged: row.action === TIMELINE_ACTION.FLAGGED,
			flag_reason: row.action === TIMELINE_ACTION.FLAGGED ? row.notes : null,
		});
	}

	return statuses;
};

const UNFLAGGED_STATUS: FlagStatus = { flagged: false, flag_reason: null };

/**
 * Composes the DB read (`Referral.count`) with the pure
 * `canAccessPatient` predicate — `lib/permission.ts` stays DB-free, so
 * this glue lives here instead, module-specific rather than shared.
 * Short-circuits before the query when `patient` is already the caller's
 * own facility's (the common case).
 */
const canAccessPatientRecord = async (
	core: Pick<CoreService, "referral">,
	userFacilityId: string | null,
	patient: Pick<PatientModelSelect, "id" | "facility_id">,
): Promise<boolean> => {
	if (patient.facility_id === userFacilityId) return true;
	if (!userFacilityId) return false;

	const activeReferralCount = await core.referral.count({
		patient_id: patient.id,
		status: { notIn: TERMINAL_REFERRAL_STATUSES },
		OR: [
			{ origin_facility_id: userFacilityId },
			{ destination_facility_id: userFacilityId },
		],
	});

	return canAccessPatient(userFacilityId, patient, activeReferralCount > 0);
};

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

	const flagStatuses = await getPatientFlagStatuses(
		server.core,
		result.data.map((row) => row.id),
	);
	const data = result.data.map((row) => ({
		...row,
		...(flagStatuses.get(row.id) ?? UNFLAGGED_STATUS),
	}));

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patients retrieved.",
		...result,
		data: data as unknown as PatientResponse["data"][],
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
		!(await canAccessPatientRecord(
			request.server.core,
			request.user!.facility_id,
			patient,
		))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const flagStatus = (
		await getPatientFlagStatuses(request.server.core, [patient.id])
	).get(patient.id);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient retrieved.",
		data: {
			...patient,
			...(flagStatus ?? UNFLAGGED_STATUS),
		} as unknown as PatientResponse["data"],
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
		select: {
			id: true,
			facility_id: true,
			first_name: true,
			last_name: true,
			date_of_birth: true,
			gender: true,
			phone: true,
			address: true,
		},
	});

	if (
		!existing ||
		!(await canAccessPatientRecord(
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

	const changes = Object.entries(body)
		.filter(
			([key, value]) => value !== existing[key as keyof typeof existing],
		)
		.map(
			([key, value]) =>
				`${key}: "${existing[key as keyof typeof existing]}" → "${value}"`,
		);

	const [updated] = await request.server.core.patient.update({
		where: { id: request.params.id },
		data: body,
		select: { id: true },
	});

	if (!updated) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	if (changes.length > 0) {
		await request.server.core.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.PATIENT,
				entity: updated.id,
				action: TIMELINE_ACTION.UPDATED,
				previous: null,
				next: null,
				changer_id: request.user!.id,
				notes: changes.join("; "),
			},
			select: { id: true },
		});
	}

	const patient = await request.server.core.patient.one({
		where: { id: updated.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const flagStatus = (
		await getPatientFlagStatuses(request.server.core, [updated.id])
	).get(updated.id);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient updated.",
		data: {
			...patient,
			...(flagStatus ?? UNFLAGGED_STATUS),
		} as unknown as PatientResponse["data"],
	});
};

/**
 * Doctor-only. Advisory marker, not a status/lifecycle value — see
 * `docs/roles-permissions.md`. A patient can only be flagged once at a
 * time (no double-flag); flagging again requires unflagging first, so the
 * history stays a clean alternating FLAGGED/UNFLAGGED sequence.
 */
export const patientFlag = async (
	request: FastifyRequest<PatientFlagRequest>,
	reply: FastifyReply<PatientFlagRequest>,
): Promise<void> => {
	const existing = await request.server.core.patient.one({
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (
		!existing ||
		!(await canAccessPatientRecord(
			request.server.core,
			request.user!.facility_id,
			existing,
		))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const flagStatus = (
		await getPatientFlagStatuses(request.server.core, [existing.id])
	).get(existing.id);

	if (flagStatus?.flagged) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "This patient is already flagged." });
	}

	await request.server.core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.PATIENT,
			entity: existing.id,
			action: TIMELINE_ACTION.FLAGGED,
			previous: null,
			next: null,
			changer_id: request.user!.id,
			notes: request.body.reason,
		},
		select: { id: true },
	});

	const patient = await request.server.core.patient.one({
		where: { id: existing.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient flagged.",
		data: {
			...patient,
			flagged: true,
			flag_reason: request.body.reason,
		} as unknown as PatientResponse["data"],
	});
};

/** Doctor-only counterpart to `patientFlag` — reversing a flag is advisory too, no appeal chain needed. */
export const patientUnflag = async (
	request: FastifyRequest<PatientUnflagRequest>,
	reply: FastifyReply<PatientUnflagRequest>,
): Promise<void> => {
	const existing = await request.server.core.patient.one({
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (
		!existing ||
		!(await canAccessPatientRecord(
			request.server.core,
			request.user!.facility_id,
			existing,
		))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const flagStatus = (
		await getPatientFlagStatuses(request.server.core, [existing.id])
	).get(existing.id);

	if (!flagStatus?.flagged) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "This patient isn't currently flagged." });
	}

	await request.server.core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.PATIENT,
			entity: existing.id,
			action: TIMELINE_ACTION.UNFLAGGED,
			previous: null,
			next: null,
			changer_id: request.user!.id,
			notes: request.body.notes ?? null,
		},
		select: { id: true },
	});

	const patient = await request.server.core.patient.one({
		where: { id: existing.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient unflagged.",
		data: {
			...patient,
			...UNFLAGGED_STATUS,
		} as unknown as PatientResponse["data"],
	});
};
