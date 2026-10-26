import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	usersQuerySchema,
	userParamsSchema,
	globalResponseSchema,
	paginationQuerySchema,
	userDetailResponseSchema,
	userListResponseSchema,
	timelineListResponseSchema,
	assignUserSpecialtySchema,
	userSpecialtyListResponseSchema,
	userSpecialtyLinkResponseSchema,
	userSpecialtyUnassignParamsSchema,
} from "@referral-tracking/shared";

import {
	users,
	user,
	userHistory,
	userSpecialties,
	userSpecialtyAssign,
	userSpecialtyUnassign,
} from "./service";

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
		url: API_PATHS.USER_LIST,
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
		url: API_PATHS.USER_BY_ID,
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
		url: API_PATHS.USER_HISTORY,
		handler: userHistory,
		preHandler: [
			app.event(EVENT_NAMES.USER_HISTORY),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: userParamsSchema,
			querystring: paginationQuerySchema,
			response: {
				200: timelineListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.USER_SPECIALTY_LIST,
		handler: userSpecialties,
		preHandler: [
			app.event(EVENT_NAMES.USER_SPECIALTY_LIST),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: userParamsSchema,
			response: {
				200: userSpecialtyListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.USER_SPECIALTY_ASSIGN,
		handler: userSpecialtyAssign,
		preHandler: [
			app.event(EVENT_NAMES.USER_SPECIALTY_ASSIGN),
			app.authenticate,
			app.authorize([ROLES.MANAGER]),
		],
		schema: {
			params: userParamsSchema,
			body: assignUserSpecialtySchema,
			response: {
				201: userSpecialtyLinkResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "DELETE",
		url: API_PATHS.USER_SPECIALTY_UNASSIGN,
		handler: userSpecialtyUnassign,
		preHandler: [
			app.event(EVENT_NAMES.USER_SPECIALTY_UNASSIGN),
			app.authenticate,
			app.authorize([ROLES.MANAGER]),
		],
		schema: {
			params: userSpecialtyUnassignParamsSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});
};
