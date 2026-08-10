import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	API_PATHS,
	appealSchema,
	globalResponseSchema,
	timelineResponseSchema,
	accountStatusResponseSchema,
} from "@referral-tracking/shared";

import { accountStatus, appealSubmit } from "./service";

import { EVENT_NAMES } from "../../lib/constant";

/**
 * Self-service — reachable regardless of account status (only
 * `app.authenticate`, deliberately no `app.authorize`) since a `PENDING`/
 * `REJECTED`/`FLAGGED`/`DISABLED` account must still be able to see its own
 * status and file an appeal. See `middleware/authenticate.ts`'s docstring.
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
};
