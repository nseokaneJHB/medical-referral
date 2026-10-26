import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	updateFacilitySchema,
	facilitiesQuerySchema,
	globalResponseSchema,
	paginationQuerySchema,
	facilityParamsSchema,
	facilityResponseSchema,
	facilityListResponseSchema,
	timelineListResponseSchema,
	facilityDetailResponseSchema,
	assignFacilitySpecialtySchema,
	facilitySpecialtyListResponseSchema,
	facilitySpecialtyLinkResponseSchema,
	facilitySpecialtyUnassignParamsSchema,
} from "@referral-tracking/shared";

import {
	facility,
	facilities,
	facilityUpdate,
	facilityHistory,
	facilitySpecialties,
	facilitySpecialtyAssign,
	facilitySpecialtyUnassign,
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
		url: API_PATHS.FACILITY_LIST,
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
		url: API_PATHS.FACILITY_BY_ID,
		handler: facility,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_GET),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
			response: {
				200: facilityDetailResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.FACILITY_HISTORY,
		handler: facilityHistory,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_HISTORY),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
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
		method: "PATCH",
		url: API_PATHS.FACILITY_BY_ID,
		handler: facilityUpdate,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_UPDATE),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
			body: updateFacilitySchema,
			response: {
				200: facilityResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.FACILITY_SPECIALTY_LIST,
		handler: facilitySpecialties,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_SPECIALTY_LIST),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR, ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
			response: {
				200: facilitySpecialtyListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.FACILITY_SPECIALTY_ASSIGN,
		handler: facilitySpecialtyAssign,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_SPECIALTY_ASSIGN),
			app.authenticate,
			app.authorize([ROLES.MANAGER]),
		],
		schema: {
			params: facilityParamsSchema,
			body: assignFacilitySpecialtySchema,
			response: {
				201: facilitySpecialtyLinkResponseSchema,
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
		url: API_PATHS.FACILITY_SPECIALTY_UNASSIGN,
		handler: facilitySpecialtyUnassign,
		preHandler: [
			app.event(EVENT_NAMES.FACILITY_SPECIALTY_UNASSIGN),
			app.authenticate,
			app.authorize([ROLES.MANAGER]),
		],
		schema: {
			params: facilitySpecialtyUnassignParamsSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});
};
