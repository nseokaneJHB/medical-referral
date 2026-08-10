import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	globalResponseSchema,
	referralsReportQuerySchema,
	referralsReportResponseSchema,
} from "@referral-tracking/shared";

import { referralsReport } from "./service";

import { EVENT_NAMES } from "../../lib/constant";

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "GET",
		url: "/referrals",
		handler: referralsReport,
		preHandler: [
			app.event(EVENT_NAMES.REPORTS_REFERRALS),
			app.authenticate,
			app.authorize([
				ROLES.NURSE,
				ROLES.DOCTOR,
				ROLES.ADMINISTRATOR,
				ROLES.MANAGER,
			]),
		],
		schema: {
			querystring: referralsReportQuerySchema,
			response: {
				200: referralsReportResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
