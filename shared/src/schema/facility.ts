import { z } from "zod";

import {
	uuidSchema,
	stringSchema,
	integerSchema,
	facilityStatusSchema,
} from "./field";

import {
	globalResponseSchema,
	paginatedGlobalResponseSchema,
	paginationSortAndSearchQuerySchema,
} from "./global";

export const createFacilitySchema = z.object({
	name: stringSchema.min(1).max(255),
	address: stringSchema.nullable(),
});

export const updateFacilitySchema = createFacilitySchema.partial();

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

export const facilitySchema = z.object({
	id: uuidSchema,
	name: stringSchema,
	address: stringSchema.nullable(),
	status: facilityStatusSchema,
	created_at: z.date(),
	updated_at: z.date(),
});

export const facilityResponseSchema = globalResponseSchema.extend({
	data: facilitySchema,
});

export const facilityListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(facilitySchema),
	status_counts: z.record(facilityStatusSchema, integerSchema),
});

/**
 * `GET /facilities/:id` only — referral and specialty counts for this
 * specific facility, same shape/reasoning as `userDoctorStatsSchema` in
 * `schema/user.ts`.
 */
export const facilityStatsSchema = z.object({
	referrals_received: integerSchema,
	active_referrals: integerSchema,
	specialties_count: integerSchema,
});

export const facilityDetailSchema = facilitySchema.extend({
	stats: facilityStatsSchema,
});

export const facilityDetailResponseSchema = globalResponseSchema.extend({
	data: facilityDetailSchema,
});

export const facilityParamsSchema = z.object({
	id: uuidSchema,
});
