import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	specialtiesQuerySchema,
	specialtyParamsSchema,
	CreateSpecialtySchema,
	UpdateSpecialtySchema,
	globalResponseSchema,
	specialtyResponseSchema,
	specialtyListResponseSchema,
} from "@referral-tracking/shared";

import { specialties, specialty, specialtyCreate, specialtyUpdate } from "./service";

import { EVENT_NAMES } from "../../lib/constant";

/**
 * The specialty vocabulary itself is Administrator-managed (create/rename);
 * reads are open to any authenticated role — Doctor/Nurse/Manager all need
 * the list to assign/display specialties elsewhere. No delete — same
 * no-hard-delete stance as the rest of this app, and a hard delete here
 * would orphan existing facility/user links.
 */
export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: API_PATHS.SPECIALTY_LIST,
		handler: specialties,
		preHandler: [app.event(EVENT_NAMES.SPECIALTY_LIST), app.authenticate],
		schema: {
			querystring: specialtiesQuerySchema,
			response: {
				200: specialtyListResponseSchema,
				401: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.SPECIALTY_BY_ID,
		handler: specialty,
		preHandler: [app.event(EVENT_NAMES.SPECIALTY_GET), app.authenticate],
		schema: {
			params: specialtyParamsSchema,
			response: {
				200: specialtyResponseSchema,
				401: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.SPECIALTY_LIST,
		handler: specialtyCreate,
		preHandler: [
			app.event(EVENT_NAMES.SPECIALTY_CREATE),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR]),
		],
		schema: {
			body: CreateSpecialtySchema,
			response: {
				201: specialtyResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				409: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.SPECIALTY_BY_ID,
		handler: specialtyUpdate,
		preHandler: [
			app.event(EVENT_NAMES.SPECIALTY_UPDATE),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR]),
		],
		schema: {
			params: specialtyParamsSchema,
			body: UpdateSpecialtySchema,
			response: {
				200: specialtyResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});
};
