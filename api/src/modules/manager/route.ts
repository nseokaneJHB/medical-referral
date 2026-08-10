import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	appealSchema,
	userParamsSchema,
	appealParamsSchema,
	userResponseSchema,
	appealDecisionSchema,
	approveActionSchema,
	globalResponseSchema,
	moderationReasonSchema,
	timelineResponseSchema,
	timelineListResponseSchema,
} from "@referral-tracking/shared";

import {
	appeals,
	staffFlag,
	appealDeny,
	staffReject,
	staffApprove,
	appealApprove,
	staffDisable,
	facilityAppealSubmit,
} from "./service";

import { EVENT_NAMES } from "../../lib/constant";

import type { EventName } from "../../type/global";

const commonResponses = {
	401: globalResponseSchema,
	403: globalResponseSchema,
	404: globalResponseSchema,
	409: globalResponseSchema,
};

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	const preHandler = (event: EventName) => [
		app.event(event),
		app.authenticate,
		app.authorize([ROLES.MANAGER]),
	];

	app.route({
		method: "PATCH",
		url: "/staff/:id/approve",
		handler: staffApprove,
		preHandler: preHandler(EVENT_NAMES.MANAGER_STAFF_APPROVE),
		schema: {
			params: userParamsSchema,
			body: approveActionSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/staff/:id/reject",
		handler: staffReject,
		preHandler: preHandler(EVENT_NAMES.MANAGER_STAFF_REJECT),
		schema: {
			params: userParamsSchema,
			body: moderationReasonSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/staff/:id/disable",
		handler: staffDisable,
		preHandler: preHandler(EVENT_NAMES.MANAGER_STAFF_DISABLE),
		schema: {
			params: userParamsSchema,
			body: moderationReasonSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/staff/:id/flag",
		handler: staffFlag,
		preHandler: preHandler(EVENT_NAMES.MANAGER_STAFF_FLAG),
		schema: {
			params: userParamsSchema,
			body: moderationReasonSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "POST",
		url: "/facility/appeal",
		handler: facilityAppealSubmit,
		preHandler: preHandler(EVENT_NAMES.MANAGER_FACILITY_APPEAL),
		schema: {
			body: appealSchema,
			response: {
				201: timelineResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: "/appeals/:id/approve",
		handler: appealApprove,
		preHandler: preHandler(EVENT_NAMES.MANAGER_APPEAL_APPROVE),
		schema: {
			params: appealParamsSchema,
			body: appealDecisionSchema,
			response: { 200: timelineResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/appeals/:id/deny",
		handler: appealDeny,
		preHandler: preHandler(EVENT_NAMES.MANAGER_APPEAL_DENY),
		schema: {
			params: appealParamsSchema,
			body: appealDecisionSchema,
			response: { 200: timelineResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "GET",
		url: "/appeals",
		handler: appeals,
		preHandler: preHandler(EVENT_NAMES.MANAGER_APPEAL_LIST),
		schema: {
			response: {
				200: timelineListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
