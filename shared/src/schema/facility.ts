import { z } from "zod";

import { uuidSchema, stringSchema, facilityStatusSchema } from "./field";

import {
	globalResponseSchema,
	paginatedGlobalResponseSchema,
	paginationSortAndSearchQuerySchema,
} from "./global";

export const CreateFacilitySchema = z.object({
	name: stringSchema.min(1).max(255),
	address: stringSchema.nullable(),
});

export const UpdateFacilitySchema = CreateFacilitySchema.partial();

/**
 * `status` and `specialty` are both comma-separated (`parseEnumList`),
 * ANDed with the caller's own visibility scoping in `listFacilities` —
 * never a way to see more. `specialty` filters to facilities linked to
 * any of the given specialty ids via `facility_specialties`.
 */
export const facilitiesQuerySchema =
	paginationSortAndSearchQuerySchema.safeExtend({
		status: stringSchema.optional(),
		specialty: stringSchema.optional(),
	});

export const FacilitySchema = z.object({
	id: uuidSchema,
	name: stringSchema,
	address: stringSchema.nullable(),
	status: facilityStatusSchema,
	created_at: z.date(),
	updated_at: z.date(),
});

export const facilityResponseSchema = globalResponseSchema.extend({
	data: FacilitySchema,
});

export const facilityListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(FacilitySchema),
});

export const facilityParamsSchema = z.object({
	id: uuidSchema,
});
