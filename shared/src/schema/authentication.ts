import { z } from "zod";

import {
	nameSchema,
	roleSchema,
	emailSchema,
	uuidSchema,
	stringSchema,
	userStatusSchema,
} from "./field";

import { globalResponseSchema } from "./global";

import { ROLES } from "../constant";

/**
 * Roles selectable through public self-registration. Deliberately excludes
 * `ADMINISTRATOR` — closes a confirmed live gap where anyone could
 * previously self-register as Administrator by just picking it on the
 * form. Administrators are either bootstrapped outside the public API
 * (`script/bootstrap-admin.ts`) or created directly by an existing
 * Administrator (`POST /administrator/users`), never through here.
 */
export const signUpRoleSchema = z.enum([
	ROLES.MANAGER,
	ROLES.NURSE,
	ROLES.DOCTOR,
]);

/**
 * Registration payload. Better Auth handles the actual sign-up route; this
 * is the shape of the `role` field layered on top of its email/password
 * call — matches the PDF's registration form exactly (Username/Email/
 * Password/Confirm Password/Role).
 *
 * `confirmPassword` is intentionally omitted — that's a client-side-only
 * check (does it match `password`), never sent to the API.
 *
 * `facility_id` is required for Nurse/Doctor (every patient/referral they
 * touch is facility-scoped) — enforced below via `superRefine` since Zod's
 * `.optional()` alone can't express "required depending on another field".
 * Manager either joins an existing facility (`facility_id`) or registers a
 * new one (`new_facility_name`), both starting `PENDING` — see
 * `authentication/service.ts`'s `signUp`.
 */
export const SignUpSchema = z
	.object({
		name: nameSchema,
		email: emailSchema,
		password: stringSchema.min(8, "Password must be at least 8 characters"),
		role: signUpRoleSchema,
		facility_id: uuidSchema.optional(),
		new_facility_name: stringSchema.min(1).max(255).optional(),
		new_facility_address: stringSchema.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.role === ROLES.NURSE || data.role === ROLES.DOCTOR) {
			if (!data.facility_id) {
				ctx.addIssue({
					code: "custom",
					path: ["facility_id"],
					message: "Facility is required for nurses and doctors.",
				});
			}
			if (data.new_facility_name) {
				ctx.addIssue({
					code: "custom",
					path: ["new_facility_name"],
					message:
						"Nurses and doctors join an existing facility, not register a new one.",
				});
			}
			return;
		}

		/**
		 * role === MANAGER: choose an existing facility to join, or
		 * register a new one — exactly one, not both, not neither.
		 */
		const hasExisting = !!data.facility_id;
		const hasNew = !!data.new_facility_name;
		if (hasExisting === hasNew) {
			ctx.addIssue({
				code: "custom",
				path: ["facility_id"],
				message: "Choose an existing facility to join, or register a new one.",
			});
		}
	});

export const SignInSchema = z.object({
	email: emailSchema,
	password: stringSchema.min(1, "Password is required"),
});

export const sessionResponseSchema = globalResponseSchema.extend({
	user: z
		.object({
			id: stringSchema,
			name: stringSchema,
			email: emailSchema,
			role: roleSchema,
			status: userStatusSchema,
			facility_id: stringSchema.nullable(),
		})
		.nullable(),
});
