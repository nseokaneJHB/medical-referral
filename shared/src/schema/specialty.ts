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
 * many-to-many, via `FacilitySpecialtyLinkSchema`/`UserSpecialtyLinkSchema`.
 * Administrator-managed; no delete endpoint (rename only) — same
 * no-hard-delete stance as the rest of this app, and a hard delete would
 * orphan any existing facility/user links pointing at it.
 */
export const SpecialtySchema = z.object({
	id: uuidSchema,
	name: stringSchema,
	description: stringSchema,
	created_at: z.date(),
	updated_at: z.date(),
});

/** Minimal nested reference to a specialty — id, name, description, for display. */
export const specialtyRefSchema = SpecialtySchema.pick({
	id: true,
	name: true,
	description: true,
});

export const CreateSpecialtySchema = z.object({
	name: stringSchema
		.min(1)
		.max(255)
		.regex(
			/^(?!.*\s&\s)(?!.*\band\b).*$/i,
			'Enter a single specialty — split combined names like "X & Y" into separate entries.',
		),
	description: stringSchema.min(1).max(1000),
});

export const UpdateSpecialtySchema = CreateSpecialtySchema.partial();

export const specialtyResponseSchema = globalResponseSchema.extend({
	data: SpecialtySchema,
});

/**
 * `GET /specialties` list rows only — how many facilities and how many
 * Doctor/Nurse staff currently have each specialty assigned, computed via
 * `Specialty.linkCount` grouped by `specialty_id`. Not present on the bare
 * `SpecialtySchema` used by the detail/create/update endpoints.
 */
export const SpecialtyListItemSchema = SpecialtySchema.extend({
	facility_count: z.number(),
	staff_count: z.number(),
});

export const specialtyListResponseSchema = paginatedGlobalResponseSchema.extend(
	{
		data: z.array(SpecialtyListItemSchema),
	},
);

export const specialtyParamsSchema = z.object({
	id: uuidSchema,
});

export const specialtiesQuerySchema = paginationSortAndSearchQuerySchema;

/**
 * A facility's specialty link — one row per facility/specialty pairing.
 * Nests the specialty ref directly (rather than a bare `specialty_id`) so
 * the frontend can render the name without a second round trip, same
 * reasoning as `facilityRefSchema`/`userRefSchema` elsewhere.
 */
export const FacilitySpecialtyLinkSchema = z.object({
	id: uuidSchema,
	facility_id: uuidSchema,
	specialty: specialtyRefSchema,
	created_at: z.date(),
});

export const assignFacilitySpecialtySchema = z.object({
	specialty_id: uuidSchema,
});

export const facilitySpecialtyListResponseSchema = globalResponseSchema.extend({
	data: z.array(FacilitySpecialtyLinkSchema),
});

export const facilitySpecialtyLinkResponseSchema = globalResponseSchema.extend({
	data: FacilitySpecialtyLinkSchema,
});

export const facilitySpecialtyUnassignParamsSchema = z.object({
	id: uuidSchema,
	specialtyId: uuidSchema,
});

/**
 * A Doctor/Nurse's specialty link — one row per user/specialty pairing.
 * Same nested-ref shape as the facility link above.
 */
export const UserSpecialtyLinkSchema = z.object({
	id: uuidSchema,
	user_id: uuidSchema,
	specialty: specialtyRefSchema,
	created_at: z.date(),
});

export const assignUserSpecialtySchema = z.object({
	specialty_id: uuidSchema,
});

export const userSpecialtyListResponseSchema = globalResponseSchema.extend({
	data: z.array(UserSpecialtyLinkSchema),
});

export const userSpecialtyLinkResponseSchema = globalResponseSchema.extend({
	data: UserSpecialtyLinkSchema,
});

export const userSpecialtyUnassignParamsSchema = z.object({
	id: uuidSchema,
	specialtyId: uuidSchema,
});

/**
 * A referral's specialty link — one row per referral/specialty pairing.
 * Same nested-ref shape as the facility/user links above.
 */
export const ReferralSpecialtyLinkSchema = z.object({
	id: uuidSchema,
	referral_id: uuidSchema,
	specialty: specialtyRefSchema,
	created_at: z.date(),
});

export const assignReferralSpecialtySchema = z.object({
	specialty_id: uuidSchema,
});

export const referralSpecialtyListResponseSchema = globalResponseSchema.extend({
	data: z.array(ReferralSpecialtyLinkSchema),
});

export const referralSpecialtyLinkResponseSchema = globalResponseSchema.extend({
	data: ReferralSpecialtyLinkSchema,
});

export const referralSpecialtyUnassignParamsSchema = z.object({
	id: uuidSchema,
	specialtyId: uuidSchema,
});
