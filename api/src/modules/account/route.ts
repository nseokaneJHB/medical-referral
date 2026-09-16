import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	API_PATHS,
	appealSchema,
	acceptNdaSchema,
	globalResponseSchema,
	timelineResponseSchema,
	changePasswordSchema,
	accountStatusResponseSchema,
	twoFactorPasswordConfirmSchema,
} from "@referral-tracking/shared";

import {
	accountStatus,
	appealSubmit,
	changePassword,
	acceptNda,
	twoFactorEnable,
	twoFactorDisable,
	twoFactorGetTotpUri,
	twoFactorGenerateBackupCodes,
} from "./service";

import { EVENT_NAMES } from "../../lib/constant";

/**
 * Self-service — reachable regardless of account status (only
 * `app.authenticate`, deliberately no `app.authorize`) since a `PENDING`/
 * `REJECTED`/`FLAGGED`/`DISABLED` account must still be able to see its own
 * status and file an appeal. See `middleware/authenticate.ts`'s docstring.
 * `change-password` is here for the same reason — a `must_change_password`
 * account is `ACTIVE` but blocked from every other route by
 * `middleware/authorize.ts`, so it must still be reachable via
 * `app.authenticate` alone. Same for `accept-nda` — an unsigned-NDA account
 * is `ACTIVE` but blocked from every other route by
 * `middleware/authorize.ts`'s NDA check, so it must stay reachable here too.
 */
export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: API_PATHS.ACCOUNT_STATUS,
		handler: accountStatus,
		preHandler: [app.event(EVENT_NAMES.ACCOUNT_STATUS), app.authenticate],
		schema: {
			response: {
				200: accountStatusResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.ACCOUNT_APPEAL,
		handler: appealSubmit,
		preHandler: [app.event(EVENT_NAMES.ACCOUNT_APPEAL), app.authenticate],
		schema: {
			body: appealSchema,
			response: {
				201: timelineResponseSchema,
				401: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.ACCOUNT_CHANGE_PASSWORD,
		handler: changePassword,
		preHandler: [
			app.event(EVENT_NAMES.ACCOUNT_CHANGE_PASSWORD),
			app.authenticate,
		],
		schema: {
			body: changePasswordSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.ACCOUNT_ACCEPT_NDA,
		handler: acceptNda,
		preHandler: [app.event(EVENT_NAMES.ACCOUNT_ACCEPT_NDA), app.authenticate],
		schema: {
			body: acceptNdaSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.ACCOUNT_TWO_FACTOR_ENABLE,
		handler: twoFactorEnable,
		preHandler: [
			app.event(EVENT_NAMES.ACCOUNT_TWO_FACTOR_ENABLE),
			app.authenticate,
		],
		schema: {
			body: twoFactorPasswordConfirmSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.ACCOUNT_TWO_FACTOR_DISABLE,
		handler: twoFactorDisable,
		preHandler: [
			app.event(EVENT_NAMES.ACCOUNT_TWO_FACTOR_DISABLE),
			app.authenticate,
		],
		schema: {
			body: twoFactorPasswordConfirmSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.ACCOUNT_TWO_FACTOR_GET_TOTP_URI,
		handler: twoFactorGetTotpUri,
		preHandler: [
			app.event(EVENT_NAMES.ACCOUNT_TWO_FACTOR_GET_TOTP_URI),
			app.authenticate,
		],
		schema: {
			body: twoFactorPasswordConfirmSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.ACCOUNT_TWO_FACTOR_GENERATE_BACKUP_CODES,
		handler: twoFactorGenerateBackupCodes,
		preHandler: [
			app.event(EVENT_NAMES.ACCOUNT_TWO_FACTOR_GENERATE_BACKUP_CODES),
			app.authenticate,
		],
		schema: {
			body: twoFactorPasswordConfirmSchema,
		},
	});
};
