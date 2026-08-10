import { z } from "zod";

import { uuidSchema, stringSchema } from "./field";

import {
	globalResponseSchema,
	paginatedGlobalResponseSchema,
	paginationSortAndSearchQuerySchema,
} from "./global";

/**
 * A clinical specialty (e.g. "Cardiology") — a controlled-vocabulary
 * reference a Facility or a Doctor/Nurse can be associated with,
 * many-to-many, via `FacilitySpecialtySchema`/`UserSpecialtySchema`.
 */
export const SpecialtySchema = z.object({
	id: uuidSchema,
	name: stringSchema,
	created_at: z.date(),
	updated_at: z.date(),
});

export const CreateSpecialtySchema = z.object({
	name: stringSchema.min(1).max(255),
});

export const UpdateSpecialtySchema = CreateSpecialtySchema.partial();

export const specialtyResponseSchema = globalResponseSchema.extend({
	data: SpecialtySchema,
});

export const specialtyListResponseSchema = paginatedGlobalResponseSchema.extend(
	{
		data: z.array(SpecialtySchema),
	},
);

export const specialtyParamsSchema = z.object({
	id: uuidSchema,
});

export const specialtiesQuerySchema = paginationSortAndSearchQuerySchema;

/** A facility's specialty link — one row per facility/specialty pairing. */
export const FacilitySpecialtySchema = z.object({
	id: uuidSchema,
	facility_id: uuidSchema,
	specialty_id: uuidSchema,
	created_at: z.date(),
});

export const assignFacilitySpecialtySchema = z.object({
	specialty_id: uuidSchema,
});

export const facilitySpecialtyListResponseSchema =
	paginatedGlobalResponseSchema.extend({
		data: z.array(FacilitySpecialtySchema),
	});

/** A Doctor/Nurse's specialty link — one row per user/specialty pairing. */
export const UserSpecialtySchema = z.object({
	id: uuidSchema,
	user_id: uuidSchema,
	specialty_id: uuidSchema,
	created_at: z.date(),
});

export const assignUserSpecialtySchema = z.object({
	specialty_id: uuidSchema,
});

export const userSpecialtyListResponseSchema =
	paginatedGlobalResponseSchema.extend({
		data: z.array(UserSpecialtySchema),
	});
