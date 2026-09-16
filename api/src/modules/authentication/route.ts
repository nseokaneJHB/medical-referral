import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	API_PATHS,
	SignUpSchema,
	SignInSchema,
	sessionResponseSchema,
	TwoFactorSendOtpSchema,
	TwoFactorVerifyOtpSchema,
	TwoFactorVerifyTotpSchema,
	TwoFactorVerifyBackupCodeSchema,
} from "@referral-tracking/shared";

import {
	signUp,
	signIn,
	signOut,
	session,
	twoFactorSendOtp,
	twoFactorVerifyOtp,
	twoFactorVerifyTotp,
	twoFactorVerifyBackupCode,
} from "./service";

import { EVENT_NAMES } from "../../lib/constant";

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "POST",
		url: API_PATHS.SIGN_UP,
		handler: signUp,
		preHandler: [app.event(EVENT_NAMES.SIGN_UP)],
		schema: {
			body: SignUpSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.SIGN_IN,
		handler: signIn,
		preHandler: [app.event(EVENT_NAMES.SIGN_IN)],
		schema: {
			body: SignInSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.SIGN_OUT,
		handler: signOut,
		preHandler: [app.event(EVENT_NAMES.SIGN_OUT)],
	});

	app.route({
		method: "GET",
		url: API_PATHS.SESSION,
		handler: session,
		preHandler: [app.event(EVENT_NAMES.SESSION)],
		schema: {
			response: {
				200: sessionResponseSchema,
			},
		},
	});

	/**
	 * These 4 routes are deliberately NOT behind `app.authenticate` — they
	 * run off better-auth's own short-lived two-factor cookie (set by
	 * `signInEmail`'s 2FA-redirect response), not a full app session. The
	 * same endpoints also double as the "confirm enrollment" step right
	 * after `POST /account/two-factor/enable` for an already-authenticated
	 * caller — better-auth's own handler supports both cases internally.
	 */
	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_VERIFY_TOTP,
		handler: twoFactorVerifyTotp,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_VERIFY_TOTP)],
		schema: {
			body: TwoFactorVerifyTotpSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_VERIFY_BACKUP_CODE,
		handler: twoFactorVerifyBackupCode,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_VERIFY_BACKUP_CODE)],
		schema: {
			body: TwoFactorVerifyBackupCodeSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_SEND_OTP,
		handler: twoFactorSendOtp,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_SEND_OTP)],
		schema: {
			body: TwoFactorSendOtpSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_VERIFY_OTP,
		handler: twoFactorVerifyOtp,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_VERIFY_OTP)],
		schema: {
			body: TwoFactorVerifyOtpSchema,
		},
	});
};
