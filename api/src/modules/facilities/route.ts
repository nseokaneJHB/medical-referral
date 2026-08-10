import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	UpdateFacilitySchema,
	facilitiesQuerySchema,
	globalResponseSchema,
	facilityParamsSchema,
	facilityResponseSchema,
	facilityListResponseSchema,
	timelineListResponseSchema,
} from "@referral-tracking/shared";

import {
	facility,
	facilities,
	facilityUpdate,
	facilityHistory,
} from "./service";

import { EVENT_NAMES } from "../../lib/constant";

/**
 * No `POST /` — the creation-time invariant (a facility only ever comes
 * into being paired with a Manager's own registration, see
 * `authentication/service.ts`'s `signUp`) means there's no valid caller
 * left for a direct create, Administrator included. See
 * `docs/roles-permissions.md`.
 */
export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: "/",
		handler: facilities,
		preHandler: [app.event(EVENT_NAMES.FACILITY_LIST)],
		schema: {
			querystring: facilitiesQuerySchema,
			response: {
				200: facilityListResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: "/:id",
		handler: facility,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_GET),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
			response: {
				200: facilityResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: "/:id/history",
		handler: facilityHistory,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_HISTORY),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
			response: {
				200: timelineListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: "/:id",
		handler: facilityUpdate,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_UPDATE),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
			body: UpdateFacilitySchema,
			response: {
				200: facilityResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});
};
