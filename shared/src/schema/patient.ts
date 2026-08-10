import { z } from "zod";

import {
	uuidSchema,
	stringSchema,
	genderSchema,
	userRefSchema,
	facilityRefSchema,
} from "./field";

import {
	globalResponseSchema,
	paginatedGlobalResponseSchema,
	paginationSortAndSearchQuerySchema,
} from "./global";

/**
 * `phone`/`address` are `.nullable()`, not `.min(1)` — `""` is valid,
 * `normalizeNullableFields` collapses it to `null` before writing. No
 * `medical_history` — a patient's history is derived from their referrals
 * and timeline, not a separately stored/edited field.
 */
export const CreatePatientSchema = z.object({
	first_name: stringSchema.min(1).max(100),
	last_name: stringSchema.min(1).max(100),
	date_of_birth: z.iso.date(),
	gender: genderSchema.nullable(),
	phone: stringSchema.max(20).nullable(),
	address: stringSchema.nullable(),
	facility_id: uuidSchema.optional(),
});

export const UpdatePatientSchema = CreatePatientSchema.partial();

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
export const PatientSchema = z.object({
	id: uuidSchema,
	first_name: stringSchema,
	last_name: stringSchema,
	date_of_birth: z.iso.date(),
	gender: genderSchema.nullable(),
	phone: stringSchema.nullable(),
	address: stringSchema.nullable(),
	creator: userRefSchema,
	facility: facilityRefSchema,
	created_at: z.date(),
	updated_at: z.date(),
});

export const patientResponseSchema = globalResponseSchema.extend({
	data: PatientSchema,
});

export const patientListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(PatientSchema),
});

export const patientParamsSchema = z.object({
	id: uuidSchema,
});
