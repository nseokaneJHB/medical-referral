import { z } from "zod";

import {
	uuidSchema,
	stringSchema,
	genderSchema,
	userRefSchema,
	patientRefSchema,
	facilityRefSchema,
} from "./field";

import {
	globalResponseSchema,
	paginatedGlobalResponseSchema,
	paginationSortAndSearchQuerySchema,
} from "./global";

import { timelineActionSchema } from "./timeline";

/**
 * `phone`/`address` are `.nullable()`, not `.min(1)` — `""` is valid,
 * `normalizeNullableFields` collapses it to `null` before writing. No
 * `medical_history` — a patient's history is derived from their referrals
 * and timeline, not a separately stored/edited field.
 */
export const createPatientSchema = z.object({
	first_name: stringSchema.min(1).max(100),
	last_name: stringSchema.min(1).max(100),
	date_of_birth: z.iso.date(),
	gender: genderSchema.nullable(),
	phone: stringSchema.max(20).nullable(),
	address: stringSchema.nullable(),
	facility_id: uuidSchema.optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

/**
 * `gender` is comma-separated (`parseEnumList`). `dob_from`/`dob_to` filter
 * `date_of_birth` — separate from the generic `from`/`to`, which stay
 * `created_at`-scoped.
 */
export const patientsQuerySchema =
	paginationSortAndSearchQuerySchema.safeExtend({
		gender: stringSchema.optional(),
		dob_from: stringSchema.optional(),
		dob_to: stringSchema.optional(),
	});

/**
 * A patient row as returned by the API. `created_at`/`updated_at` are typed
 * as `z.date()` since that's what Drizzle hands back for a MySQL `timestamp`
 * column — Fastify's JSON serialization converts them to ISO strings on
 * the wire the same way `JSON.stringify` always has for `Date` values.
 */
/**
 * `flagged`/`flag_reason` are derived from the shared `timeline` table (most
 * recent `FLAGGED`/`UNFLAGGED` row for this patient), not stored columns —
 * see `docs/roles-permissions.md`'s "flag is orthogonal to status" design.
 * Advisory-only: never gates any read/write elsewhere.
 */
export const patientSchema = z.object({
	id: uuidSchema,
	first_name: stringSchema,
	last_name: stringSchema,
	date_of_birth: z.iso.date(),
	gender: genderSchema.nullable(),
	phone: stringSchema.nullable(),
	address: stringSchema.nullable(),
	creator: userRefSchema,
	facility: facilityRefSchema,
	flagged: z.boolean(),
	flag_reason: stringSchema.nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const patientResponseSchema = globalResponseSchema.extend({
	data: patientSchema,
});

export const patientListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(patientSchema),
	registered_this_period: z.number(),
});

/**
 * `GET /patients/:id` only — referral counts for this specific patient,
 * same shape/reasoning as `userDoctorStatsSchema` in `schema/user.ts`.
 */
export const patientStatsSchema = z.object({
	total_referrals: z.number(),
	active_referrals: z.number(),
});

export const patientDetailSchema = patientSchema.extend({
	stats: patientStatsSchema,
});

export const patientDetailResponseSchema = globalResponseSchema.extend({
	data: patientDetailSchema,
});

export const patientParamsSchema = z.object({
	id: uuidSchema,
});

/**
 * `POST /patients/:id/transfer` — a Nurse/Doctor at the patient's *current*
 * facility requests a move to `destination_facility_id`. Two-sided
 * approval (origin Manager, then destination Manager) happens afterward —
 * see `api/src/lib/transfer.ts`. This never edits `facility_id` directly.
 */
export const transferRequestSchema = z.object({
	destination_facility_id: uuidSchema.describe("Facility to transfer to"),
	reason: stringSchema.min(1, "A reason is required."),
});

/** `:id` on a transfer-decision route is the `TRANSFER_REQUESTED` row's id — the
 * stable identifier for the whole request, not a fresh id per decision step. */
export const transferParamsSchema = z.object({
	id: uuidSchema,
});

/**
 * A transfer request, hydrated for display — richer than the generic
 * `timelineSchema` a raw row would give you (facility/patient names,
 * not bare ids). `action` is the request's *current* stage
 * (`TRANSFER_REQUESTED` = awaiting origin, `TRANSFER_APPROVED_ORIGIN` =
 * awaiting destination, `TRANSFER_APPROVED_DESTINATION`/`TRANSFER_REJECTED`
 * = closed). `reason` is always the original requester's reason, regardless
 * of stage — decision-step reasons/notes live in the timeline history,
 * fetched separately if needed.
 */
export const transferSchema = z.object({
	id: uuidSchema,
	patient: patientRefSchema,
	origin_facility: facilityRefSchema,
	destination_facility: facilityRefSchema,
	reason: stringSchema,
	action: timelineActionSchema,
	requested_by: userRefSchema,
	changed_at: z.date(),
});

export const transferResponseSchema = globalResponseSchema.extend({
	data: transferSchema,
});

export const transferListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(transferSchema),
});
