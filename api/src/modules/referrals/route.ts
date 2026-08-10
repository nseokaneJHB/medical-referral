import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	CreateReferralSchema,
	UpdateReferralSchema,
	referralsQuerySchema,
	globalResponseSchema,
	referralParamsSchema,
	referralResponseSchema,
	UpdateReferralStatusSchema,
	referralListResponseSchema,
	timelineListResponseSchema,
} from "@referral-tracking/shared";

import {
	referral,
	referrals,
	referralCreate,
	referralUpdate,
	referralAssign,
	referralHistory,
	referralStatusUpdate,
} from "./service";

import { EVENT_NAMES } from "../../lib/constant";

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "POST",
		url: API_PATHS.REFERRAL_LIST,
		handler: referralCreate,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_CREATE),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR]),
		],
		schema: {
			body: CreateReferralSchema,
			response: {
				201: referralResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.REFERRAL_LIST,
		handler: referrals,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_LIST),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER]),
		],
		schema: {
			querystring: referralsQuerySchema,
			response: {
				200: referralListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.REFERRAL_BY_ID,
		handler: referral,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_GET),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER]),
		],
		schema: {
			params: referralParamsSchema,
			response: {
				200: referralResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.REFERRAL_BY_ID,
		handler: referralUpdate,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_UPDATE),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.MANAGER]),
		],
		schema: {
			params: referralParamsSchema,
			body: UpdateReferralSchema,
			response: {
				200: referralResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.REFERRAL_STATUS_UPDATE,
		handler: referralStatusUpdate,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_STATUS_UPDATE),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR]),
		],
		schema: {
			params: referralParamsSchema,
			body: UpdateReferralStatusSchema,
			response: {
				200: referralResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.REFERRAL_ASSIGN,
		handler: referralAssign,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_ASSIGN),
			app.authenticate,
			app.authorize([ROLES.DOCTOR]),
		],
		schema: {
			params: referralParamsSchema,
			response: {
				200: referralResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.REFERRAL_HISTORY,
		handler: referralHistory,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_HISTORY),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER]),
		],
		schema: {
			params: referralParamsSchema,
			response: {
				200: timelineListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});
};
