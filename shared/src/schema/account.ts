import { z } from "zod";

import {
	stringSchema,
	uuidSchema,
	booleanSchema,
	userStatusSchema,
	facilityStatusSchema,
} from "./field";

import { globalResponseSchema } from "./global";

/**
 * `GET /account/status` — what a signed-in but not-yet-`ACTIVE` (or
 * `REJECTED`/`FLAGGED`/`DISABLED`) user is allowed to see: their own
 * status and the reason behind it, plus the same for their facility if
 * they have one. `reason` is the `notes` on the most recent relevant
 * `timeline` row — `null` if there isn't one yet (e.g. still `PENDING`,
 * never acted on).
 */
export const accountStatusSchema = z.object({
	status: userStatusSchema,
	must_change_password: booleanSchema,
	nda_accepted_version: stringSchema.nullable(),
	reason: stringSchema.nullable(),
	facility: z
		.object({
			id: uuidSchema,
			name: stringSchema,
			status: facilityStatusSchema,
			reason: stringSchema.nullable(),
		})
		.nullable(),
});

export const accountStatusResponseSchema = globalResponseSchema.extend({
	data: accountStatusSchema,
});

/**
 * `PATCH /account/change-password` — self-service password change. Used
 * both for the forced flow (an admin-issued temporary password,
 * `must_change_password: true`) and any later voluntary change; either
 * way the caller must prove they know the current password.
 */
export const changePasswordSchema = z.object({
	current_password: stringSchema.min(1, "Current password is required"),
	new_password: stringSchema.min(8, "Password must be at least 8 characters"),
});

/** No body — the caller always accepts whatever NDA_VERSION is currently live. */
export const acceptNdaSchema = z.object({});

/** better-auth requires re-proving the current password for each 2FA management endpoint, same threat model as changePasswordSchema above. */
export const twoFactorPasswordConfirmSchema = z.object({
	password: stringSchema.min(1, "Password is required"),
});

export const twoFactorEnableResponseSchema = globalResponseSchema.extend({
	data: z.object({
		totpURI: stringSchema,
		backupCodes: z.array(stringSchema),
	}),
});

export const twoFactorGetTotpUriResponseSchema = globalResponseSchema.extend({
	data: z.object({
		totpURI: stringSchema,
	}),
});

export const twoFactorGenerateBackupCodesResponseSchema =
	globalResponseSchema.extend({
		data: z.object({
			status: booleanSchema,
			backupCodes: z.array(stringSchema),
		}),
	});
