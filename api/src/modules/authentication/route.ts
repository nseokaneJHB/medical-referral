import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	API_PATHS,
	signUpSchema,
	signInSchema,
	signInResponseSchema,
	sessionResponseSchema,
	globalResponseSchema,
	twoFactorSendOtpSchema,
	twoFactorVerifyCodeSchema,
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
			body: signUpSchema,
			response: {
				200: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.SIGN_IN,
		handler: signIn,
		preHandler: [app.event(EVENT_NAMES.SIGN_IN)],
		schema: {
			body: signInSchema,
			response: {
				200: signInResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.SIGN_OUT,
		handler: signOut,
		preHandler: [app.event(EVENT_NAMES.SIGN_OUT)],
		schema: {
			response: {
				200: globalResponseSchema,
				400: globalResponseSchema,
			},
		},
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

	/** Deliberately not behind app.authenticate — these run off better-auth's own short-lived two-factor cookie, not a full app session. */
	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_VERIFY_TOTP,
		handler: twoFactorVerifyTotp,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_VERIFY_TOTP)],
		schema: {
			body: twoFactorVerifyCodeSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_VERIFY_BACKUP_CODE,
		handler: twoFactorVerifyBackupCode,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_VERIFY_BACKUP_CODE)],
		schema: {
			body: twoFactorVerifyCodeSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_SEND_OTP,
		handler: twoFactorSendOtp,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_SEND_OTP)],
		schema: {
			body: twoFactorSendOtpSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.TWO_FACTOR_VERIFY_OTP,
		handler: twoFactorVerifyOtp,
		preHandler: [app.event(EVENT_NAMES.TWO_FACTOR_VERIFY_OTP)],
		schema: {
			body: twoFactorVerifyCodeSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
			},
		},
	});
};
