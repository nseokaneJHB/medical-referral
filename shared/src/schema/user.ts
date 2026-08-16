import { z } from "zod";

import {
	uuidSchema,
	roleSchema,
	stringSchema,
	userStatusSchema,
	facilityRefSchema,
} from "./field";

import {
	globalResponseSchema,
	paginatedGlobalResponseSchema,
	paginationSortAndSearchQuerySchema,
} from "./global";

export const UserSchema = z.object({
	id: uuidSchema,
	name: stringSchema.nullable(),
	email: stringSchema,
	role: roleSchema,
	status: userStatusSchema,
	facility_id: uuidSchema.nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const userListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(UserSchema),
	pending_applications: z.number(),
});

export const userResponseSchema = globalResponseSchema.extend({
	data: UserSchema,
});

/**
 * Doctor-only — referral counts derived from `Referral.doctor`, present
 * only when the viewed user's role is `DOCTOR`.
 */
export const UserDoctorStatsSchema = z.object({
	total_referrals: z.number(),
	completed_referrals: z.number(),
	completion_rate: z.number(),
});

/**
 * `GET /users/:id` only — a nested `facility` instead of the bare
 * `facility_id` the list/admin-create endpoints still use, kept separate
 * so this doesn't ripple into those.
 */
export const UserDetailSchema = UserSchema.omit({ facility_id: true }).extend({
	facility: facilityRefSchema.nullable(),
	stats: UserDoctorStatsSchema.optional(),
});

export const userDetailResponseSchema = globalResponseSchema.extend({
	data: UserDetailSchema,
});

export const userParamsSchema = z.object({
	id: uuidSchema,
});

/**
 * `role`/`status` each accept a comma-separated list (e.g.
 * `?role=DOCTOR,NURSE`, `?status=PENDING`), parsed server-side via
 * `parseEnumList` — same convention as patients/referrals. `status` is what
 * lets `GET /users?status=PENDING` double as an approval queue without a
 * bespoke endpoint.
 */
export const usersQuerySchema = paginationSortAndSearchQuerySchema.safeExtend({
	role: stringSchema.optional(),
	status: stringSchema.optional(),
});
