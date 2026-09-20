import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	globalResponseSchema,
	paginationQuerySchema,
	loginsListResponseSchema,
} from "@referral-tracking/shared";

import { logins } from "./service";

import { EVENT_NAMES } from "../../lib/constant";

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: API_PATHS.AUDIT_LOGINS,
		handler: logins,
		preHandler: [
			app.event(EVENT_NAMES.AUDIT_LOGINS),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR]),
		],
		schema: {
			querystring: paginationQuerySchema,
			response: {
				200: loginsListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
