import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	createReferralSchema,
	updateReferralSchema,
	referralsQuerySchema,
	globalResponseSchema,
	paginationQuerySchema,
	referralParamsSchema,
	referralResponseSchema,
	redirectReferralSchema,
	updateReferralStatusSchema,
	referralListResponseSchema,
	timelineListResponseSchema,
	assignReferralSpecialtySchema,
	referralSpecialtyListResponseSchema,
	referralSpecialtyLinkResponseSchema,
	referralSpecialtyUnassignParamsSchema,
} from "@referral-tracking/shared";

import {
	referral,
	referrals,
	referralCreate,
	referralUpdate,
	referralAssign,
	referralHistory,
	referralRedirect,
	referralStatusUpdate,
	referralSpecialties,
	referralSpecialtyAssign,
	referralSpecialtyUnassign,
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
			body: createReferralSchema,
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
			body: updateReferralSchema,
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
			body: updateReferralStatusSchema,
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
		method: "PATCH",
		url: API_PATHS.REFERRAL_REDIRECT,
		handler: referralRedirect,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_REDIRECT),
			app.authenticate,
			app.authorize([ROLES.DOCTOR]),
		],
		schema: {
			params: referralParamsSchema,
			body: redirectReferralSchema,
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
		url: API_PATHS.REFERRAL_SPECIALTY_LIST,
		handler: referralSpecialties,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_SPECIALTY_LIST),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER]),
		],
		schema: {
			params: referralParamsSchema,
			response: {
				200: referralSpecialtyListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.REFERRAL_SPECIALTY_ASSIGN,
		handler: referralSpecialtyAssign,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_SPECIALTY_ASSIGN),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR]),
		],
		schema: {
			params: referralParamsSchema,
			body: assignReferralSpecialtySchema,
			response: {
				201: referralSpecialtyLinkResponseSchema,
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
		url: API_PATHS.REFERRAL_SPECIALTY_UNASSIGN,
		handler: referralSpecialtyUnassign,
		preHandler: [
			app.event(EVENT_NAMES.REFERRAL_SPECIALTY_UNASSIGN),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR]),
		],
		schema: {
			params: referralSpecialtyUnassignParamsSchema,
			response: {
				200: globalResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});
};
