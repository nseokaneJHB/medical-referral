import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	genderSchema,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	HTTP_RESPONSE_CODE,
	createPatientSchema,
	TERMINAL_REFERRAL_STATUSES,
	type PatientDetailResponse,
} from "@referral-tracking/shared";

import {
	generateUuid,
	normalizeNullableFields,
	localDateStartToUtc,
	localMonthStartToUtc,
} from "../../lib/util";
import { parseEnumList } from "../../lib/validator";
import { canAccessPatient } from "../../lib/permission";

import {
	patientOne,
	patientMany,
	patientCount,
	patientCreate as repositoryPatientCreate,
	patientUpdate as repositoryPatientUpdate,
} from "../../repository/patient";
import { referralCount } from "../../repository/referral";
import { timelineMany, timelineCreate } from "../../repository/timeline";

import { PatientModel, type PatientModelSelect } from "../../drizzle/schema";

import {
	buildOrderClause,
	type Executor,
	type WhereClause,
	type WhereOperator,
} from "../../repository/helpers";

import type {
	PatientRequest,
	PatientsRequest,
	PatientFlagRequest,
	PatientCreateRequest,
	PatientUpdateRequest,
	PatientUnflagRequest,
} from "./type";

/** `facility_id` stays selected for the internal access check below; the Zod response schema doesn't declare it, so it's dropped on the wire. */
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

/** Batched flag-status lookup, one query for however many patients are in play — "flagged" means the most recent FLAGGED/UNFLAGGED row for that patient is a FLAGGED one with no later UNFLAGGED. */
const getPatientFlagStatuses = async (
	database: Executor,
	patientIds: string[],
): Promise<Map<string, FlagStatus>> => {
	const statuses = new Map<string, FlagStatus>();
	if (patientIds.length === 0) return statuses;

	const result = await timelineMany(database, {
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
		if (statuses.has(row.entity)) continue;
		statuses.set(row.entity, {
			flagged: row.action === TIMELINE_ACTION.FLAGGED,
			flag_reason: row.action === TIMELINE_ACTION.FLAGGED ? row.notes : null,
		});
	}

	return statuses;
};

const UNFLAGGED_STATUS: FlagStatus = { flagged: false, flag_reason: null };

/** `GET /patients/:id` only — total and active referral counts for this patient, same shape as `doctorStats` in `modules/users/service.ts`. */
const patientStats = async (
	database: Executor,
	patientId: string,
): Promise<PatientDetailResponse["data"]["stats"]> => {
	const [totalReferrals, activeReferrals] = await Promise.all([
		referralCount(database, { where: { patient_id: patientId } }),
		referralCount(database, {
			where: {
				patient_id: patientId,
				status: { notIn: TERMINAL_REFERRAL_STATUSES },
			},
		}),
	]);

	return { total_referrals: totalReferrals, active_referrals: activeReferrals };
};

/** Composes the DB read (`referralCount`) with the pure `canAccessPatient` predicate, since `lib/permission.ts` stays DB-free; short-circuits when `patient` is already the caller's own facility's. */
const canAccessPatientRecord = async (
	database: Executor,
	userFacilityId: string | null,
	patient: Pick<PatientModelSelect, "id" | "facility_id">,
): Promise<boolean> => {
	if (patient.facility_id === userFacilityId) return true;
	if (!userFacilityId) return false;

	const activeReferralCount = await referralCount(database, {
		where: {
			patient_id: patient.id,
			status: { notIn: TERMINAL_REFERRAL_STATUSES },
			OR: [
				{ origin_facility_id: userFacilityId },
				{ destination_facility_id: userFacilityId },
			],
		},
	});

	return canAccessPatient(userFacilityId, patient, activeReferralCount > 0);
};

/** Registers a new patient — `facility_id` is always the Nurse's own, since only Nurses register patients. */
export const patientCreate = async (
	request: FastifyRequest<PatientCreateRequest>,
	reply: FastifyReply<PatientCreateRequest>,
): Promise<void> => {
	const database = request.server.database;

	const [created] = await repositoryPatientCreate(
		database,
		{ select: { id: true } },
		{
			...normalizeNullableFields(request.body, createPatientSchema),
			id: generateUuid(),
			creator_id: request.user!.id,
			facility_id: request.user!.facility_id!,
		},
	);

	const patient = await patientOne(database, {
		where: { id: created.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Patient created.",
		data: {
			...patient!,
			...UNFLAGGED_STATUS,
		},
	});
};

/** Lists patients with pagination/date-range/search/sort filtering, scoped to the caller's own facility. */
export const patients = async (
	request: FastifyRequest<PatientsRequest>,
	reply: FastifyReply<PatientsRequest>,
): Promise<void> => {
	const { query, server } = request;
	const database = server.database;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const dateFilter: WhereOperator<Date> = {};
	if (query.from)
		dateFilter.gte = localDateStartToUtc(query.from, query.tz_offset);
	if (query.to) {
		const end = localDateStartToUtc(query.to, query.tz_offset);
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

	const startOfPeriod = localMonthStartToUtc(query.tz_offset);
	const registeredThisPeriod = await patientCount(database, {
		where: {
			facility_id: request.user!.facility_id!,
			created_at: { gte: startOfPeriod },
		},
	});

	const order = buildOrderClause<PatientModelSelect>(
		query.sort,
		query.order,
		PatientModel,
		"created_at",
		"desc",
	);

	const result = await patientMany(database, {
		page,
		limit,
		where,
		order,
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const flagStatuses = await getPatientFlagStatuses(
		database,
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
		data,
		registered_this_period: registeredThisPeriod,
	});
};

/** Fetches a single patient with flag status and stats, if the caller can access it. */
export const patient = async (
	request: FastifyRequest<PatientRequest>,
	reply: FastifyReply<PatientRequest>,
): Promise<void> => {
	const database = request.server.database;

	const patient = await patientOne(database, {
		where: { id: request.params.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	if (
		!patient ||
		!(await canAccessPatientRecord(database, request.user!.facility_id, patient))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const flagStatus = (await getPatientFlagStatuses(database, [patient.id])).get(
		patient.id,
	);

	const stats = await patientStats(database, patient.id);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient retrieved.",
		data: {
			...patient,
			...(flagStatus ?? UNFLAGGED_STATUS),
			stats,
		},
	});
};

/** Nurse-only — updates a patient's fields except `facility_id`, which is the transfer workflow's job. */
export const patientUpdate = async (
	request: FastifyRequest<PatientUpdateRequest>,
	reply: FastifyReply<PatientUpdateRequest>,
): Promise<void> => {
	const role = request.user!.role;
	const database = request.server.database;

	const existing = await patientOne(database, {
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
		!(await canAccessPatientRecord(database, request.user!.facility_id, existing))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const body = normalizeNullableFields(request.body, createPatientSchema);

	if (role === ROLES.NURSE && "facility_id" in body) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply
			.status(status)
			.send({ code, message: "Nurses may not change a patient's facility." });
	}

	const changes = Object.entries(body)
		.filter(([key, value]) => value !== existing[key as keyof typeof existing])
		.map(
			([key, value]) =>
				`${key}: "${existing[key as keyof typeof existing]}" → "${value}"`,
		);

	const [updated] = await repositoryPatientUpdate(
		database,
		{ where: { id: request.params.id }, select: { id: true } },
		body,
	);

	if (!updated) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	if (changes.length > 0) {
		await timelineCreate(
			database,
			{ select: { id: true } },
			{
				id: generateUuid(),
				type: TIMELINE_TYPE.PATIENT,
				entity: updated.id,
				action: TIMELINE_ACTION.UPDATED,
				previous: null,
				next: null,
				changer_id: request.user!.id,
				notes: changes.join("; "),
			},
		);
	}

	const patient = await patientOne(database, {
		where: { id: updated.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const flagStatus = (await getPatientFlagStatuses(database, [updated.id])).get(
		updated.id,
	);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient updated.",
		data: {
			...patient!,
			...(flagStatus ?? UNFLAGGED_STATUS),
		},
	});
};

/** Doctor-only — flags a patient as an advisory marker (not a status/lifecycle value); can't double-flag, unflag first. */
export const patientFlag = async (
	request: FastifyRequest<PatientFlagRequest>,
	reply: FastifyReply<PatientFlagRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await patientOne(database, {
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (
		!existing ||
		!(await canAccessPatientRecord(database, request.user!.facility_id, existing))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const flagStatus = (await getPatientFlagStatuses(database, [existing.id])).get(
		existing.id,
	);

	if (flagStatus?.flagged) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "This patient is already flagged." });
	}

	await timelineCreate(
		database,
		{ select: { id: true } },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.PATIENT,
			entity: existing.id,
			action: TIMELINE_ACTION.FLAGGED,
			previous: null,
			next: null,
			changer_id: request.user!.id,
			notes: request.body.reason,
		},
	);

	const patient = await patientOne(database, {
		where: { id: existing.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient flagged.",
		data: {
			...patient!,
			flagged: true,
			flag_reason: request.body.reason,
		},
	});
};

/** Doctor-only counterpart to `patientFlag` — reversing a flag is advisory too, no appeal chain needed. */
export const patientUnflag = async (
	request: FastifyRequest<PatientUnflagRequest>,
	reply: FastifyReply<PatientUnflagRequest>,
): Promise<void> => {
	const database = request.server.database;

	const existing = await patientOne(database, {
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (
		!existing ||
		!(await canAccessPatientRecord(database, request.user!.facility_id, existing))
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const flagStatus = (await getPatientFlagStatuses(database, [existing.id])).get(
		existing.id,
	);

	if (!flagStatus?.flagged) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "This patient isn't currently flagged." });
	}

	await timelineCreate(
		database,
		{ select: { id: true } },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.PATIENT,
			entity: existing.id,
			action: TIMELINE_ACTION.UNFLAGGED,
			previous: null,
			next: null,
			changer_id: request.user!.id,
			notes: request.body.notes ?? null,
		},
	);

	const patient = await patientOne(database, {
		where: { id: existing.id },
		select: PATIENT_FIELDS,
		include: PATIENT_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Patient unflagged.",
		data: {
			...patient!,
			...UNFLAGGED_STATUS,
		},
	});
};
