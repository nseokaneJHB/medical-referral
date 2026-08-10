import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	globalResponseSchema,
	loginsListResponseSchema,
} from "@referral-tracking/shared";

import { logins } from "./service";

import { EVENT_NAMES } from "../../lib/constant";

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: "/logins",
		handler: logins,
		preHandler: [
			app.event(EVENT_NAMES.AUDIT_LOGINS),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR]),
		],
		schema: {
			response: {
				200: loginsListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
