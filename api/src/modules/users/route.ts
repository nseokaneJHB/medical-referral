import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	usersQuerySchema,
	userParamsSchema,
	globalResponseSchema,
	userDetailResponseSchema,
	userListResponseSchema,
	timelineListResponseSchema,
} from "@referral-tracking/shared";

import { users, user, userHistory } from "./service";

import { EVENT_NAMES } from "../../lib/constant";

/**
 * No `PATCH /:id/disable` — see the note in `service.ts`. Moderation now
 * lives in `modules/administrator` and `modules/manager`.
 */
export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: "/",
		handler: users,
		preHandler: [
			app.event(EVENT_NAMES.USER_LIST),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			querystring: usersQuerySchema,
			response: {
				200: userListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: "/:id",
		handler: user,
		preHandler: [
			app.event(EVENT_NAMES.USER_GET),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: userParamsSchema,
			response: {
				200: userDetailResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: "/:id/history",
		handler: userHistory,
		preHandler: [
			app.event(EVENT_NAMES.USER_HISTORY),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: userParamsSchema,
			response: {
				200: timelineListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});
};
