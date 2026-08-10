import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	userParamsSchema,
	appealParamsSchema,
	appealDecisionSchema,
	approveActionSchema,
	facilityParamsSchema,
	userResponseSchema,
	globalResponseSchema,
	moderationReasonSchema,
	facilityResponseSchema,
	timelineResponseSchema,
	createUserByAdminSchema,
	timelineListResponseSchema,
	createUserByAdminResponseSchema,
} from "@referral-tracking/shared";

import {
	appeals,
	userCreate,
	staffFlag,
	appealDeny,
	staffReject,
	managerFlag,
	staffApprove,
	appealApprove,
	facilityFlag,
	managerReject,
	staffDisable,
	managerApprove,
	managerDisable,
	facilityReject,
	facilitySuspend,
	facilityApprove,
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
		app.authorize([ROLES.ADMINISTRATOR]),
	];

	app.route({
		method: "PATCH",
		url: "/managers/:id/approve",
		handler: managerApprove,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_MANAGER_APPROVE),
		schema: {
			params: userParamsSchema,
			body: approveActionSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/managers/:id/reject",
		handler: managerReject,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_MANAGER_REJECT),
		schema: {
			params: userParamsSchema,
			body: moderationReasonSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/managers/:id/disable",
		handler: managerDisable,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_MANAGER_DISABLE),
		schema: {
			params: userParamsSchema,
			body: moderationReasonSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/managers/:id/flag",
		handler: managerFlag,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_MANAGER_FLAG),
		schema: {
			params: userParamsSchema,
			body: moderationReasonSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/staff/:id/approve",
		handler: staffApprove,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_STAFF_APPROVE),
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
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_STAFF_REJECT),
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
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_STAFF_FLAG),
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
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_STAFF_DISABLE),
		schema: {
			params: userParamsSchema,
			body: moderationReasonSchema,
			response: { 200: userResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/facilities/:id/approve",
		handler: facilityApprove,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_FACILITY_APPROVE),
		schema: {
			params: facilityParamsSchema,
			body: approveActionSchema,
			response: { 200: facilityResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/facilities/:id/reject",
		handler: facilityReject,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_FACILITY_REJECT),
		schema: {
			params: facilityParamsSchema,
			body: moderationReasonSchema,
			response: { 200: facilityResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/facilities/:id/flag",
		handler: facilityFlag,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_FACILITY_FLAG),
		schema: {
			params: facilityParamsSchema,
			body: moderationReasonSchema,
			response: { 200: facilityResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: "/facilities/:id/suspend",
		handler: facilitySuspend,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_FACILITY_SUSPEND),
		schema: {
			params: facilityParamsSchema,
			body: moderationReasonSchema,
			response: { 200: facilityResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "POST",
		url: "/users",
		handler: userCreate,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_USER_CREATE),
		schema: {
			body: createUserByAdminSchema,
			response: {
				201: createUserByAdminResponseSchema,
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
		url: "/appeals/:id/approve",
		handler: appealApprove,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_APPEAL_APPROVE),
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
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_APPEAL_DENY),
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
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_APPEAL_LIST),
		schema: {
			response: {
				200: timelineListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
