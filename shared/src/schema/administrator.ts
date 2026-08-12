import { z } from "zod";

import {
	nameSchema,
	emailSchema,
	roleSchema,
	uuidSchema,
	stringSchema,
} from "./field";

import { globalResponseSchema } from "./global";

import { UserSchema } from "./user";

import { ROLES } from "../constant";

/**
 * `POST /administrator/users` — an Administrator creating any role
 * (including another Administrator) directly, active immediately since an
 * Administrator is vouching for them. No `new_facility_name` here on
 * purpose — that would reopen the bare-facility-creation loophole the
 * creation-time invariant (a facility only comes into being via a
 * Manager's own registration) closes. No `password` either — the server
 * always generates a one-time temporary password (`generateTemporaryPassword`
 * in `lib/util.ts`), returned exactly once in the response.
 */
export const createUserByAdminSchema = z
	.object({
		name: nameSchema,
		email: emailSchema,
		role: roleSchema,
		facility_id: uuidSchema.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.role === ROLES.ADMINISTRATOR) {
			if (data.facility_id) {
				ctx.addIssue({
					code: "custom",
					path: ["facility_id"],
					message: "Administrators must not be assigned a facility.",
				});
			}
			return;
		}

		if (!data.facility_id) {
			ctx.addIssue({
				code: "custom",
				path: ["facility_id"],
				message: "facility_id is required for this role.",
			});
		}
	});

const userWithTemporaryPasswordSchema = z.object({
	user: UserSchema,
	temporary_password: stringSchema,
});

export const createUserByAdminResponseSchema = globalResponseSchema.extend({
	data: userWithTemporaryPasswordSchema,
});

/**
 * `PATCH /administrator/users/:id/reset-password` — no body (Administrator
 * doesn't choose the new password, same reasoning as create: the server
 * always generates a fresh one-time temporary password and returns it
 * exactly once, alongside `must_change_password: true` on the row).
 */
export const resetUserPasswordResponseSchema = globalResponseSchema.extend({
	data: userWithTemporaryPasswordSchema,
});
