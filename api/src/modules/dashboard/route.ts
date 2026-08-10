import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
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
		url: "/nurse/summary",
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
		url: "/doctor/summary",
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
		url: "/admin/summary",
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
		url: "/manager/summary",
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
