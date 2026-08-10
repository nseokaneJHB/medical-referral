import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	globalResponseSchema,
	adminSummaryResponseSchema,
	doctorSummaryResponseSchema,
	nurseSummaryResponseSchema,
	managerSummaryResponseSchema,
} from "@referral-tracking/shared";

import {
	nurseSummary,
	doctorSummary,
	adminSummary,
	managerSummary,
} from "./service";

import { EVENT_NAMES } from "../../lib/constant";

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: API_PATHS.DASHBOARD_NURSE_SUMMARY,
		handler: nurseSummary,
		preHandler: [
			app.event(EVENT_NAMES.DASHBOARD_NURSE_SUMMARY),
			app.authenticate,
			app.authorize([ROLES.NURSE]),
		],
		schema: {
			response: {
				200: nurseSummaryResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.DASHBOARD_DOCTOR_SUMMARY,
		handler: doctorSummary,
		preHandler: [
			app.event(EVENT_NAMES.DASHBOARD_DOCTOR_SUMMARY),
			app.authenticate,
			app.authorize([ROLES.DOCTOR]),
		],
		schema: {
			response: {
				200: doctorSummaryResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.DASHBOARD_ADMIN_SUMMARY,
		handler: adminSummary,
		preHandler: [
			app.event(EVENT_NAMES.DASHBOARD_ADMIN_SUMMARY),
			app.authenticate,
			app.authorize([ROLES.ADMINISTRATOR]),
		],
		schema: {
			response: {
				200: adminSummaryResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.DASHBOARD_MANAGER_SUMMARY,
		handler: managerSummary,
		preHandler: [
			app.event(EVENT_NAMES.DASHBOARD_MANAGER_SUMMARY),
			app.authenticate,
			app.authorize([ROLES.MANAGER]),
		],
		schema: {
			response: {
				200: managerSummaryResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
