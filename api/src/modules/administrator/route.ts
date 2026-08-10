import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	userParamsSchema,
	appealParamsSchema,
	appealDecisionSchema,
	approveActionSchema,
	facilityParamsSchema,
	userResponseSchema,
	transferParamsSchema,
	globalResponseSchema,
	transferResponseSchema,
	moderationReasonSchema,
	facilityResponseSchema,
	timelineResponseSchema,
	createUserByAdminSchema,
	transferListResponseSchema,
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
import {
	transfers,
	transferOriginReject,
	transferOriginApprove,
	transferDestinationReject,
	transferDestinationApprove,
} from "../patients/transfer-service";

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
		url: API_PATHS.ADMINISTRATOR_MANAGER_APPROVE,
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
		url: API_PATHS.ADMINISTRATOR_MANAGER_REJECT,
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
		url: API_PATHS.ADMINISTRATOR_MANAGER_DISABLE,
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
		url: API_PATHS.ADMINISTRATOR_MANAGER_FLAG,
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
		url: API_PATHS.ADMINISTRATOR_STAFF_APPROVE,
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
		url: API_PATHS.ADMINISTRATOR_STAFF_REJECT,
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
		url: API_PATHS.ADMINISTRATOR_STAFF_FLAG,
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
		url: API_PATHS.ADMINISTRATOR_STAFF_DISABLE,
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
		url: API_PATHS.ADMINISTRATOR_FACILITY_APPROVE,
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
		url: API_PATHS.ADMINISTRATOR_FACILITY_REJECT,
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
		url: API_PATHS.ADMINISTRATOR_FACILITY_FLAG,
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
		url: API_PATHS.ADMINISTRATOR_FACILITY_SUSPEND,
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
		url: API_PATHS.ADMINISTRATOR_USER_CREATE,
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
		url: API_PATHS.ADMINISTRATOR_APPEAL_APPROVE,
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
		url: API_PATHS.ADMINISTRATOR_APPEAL_DENY,
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
		url: API_PATHS.ADMINISTRATOR_APPEAL_LIST,
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

	app.route({
		method: "PATCH",
		url: API_PATHS.ADMINISTRATOR_TRANSFER_ORIGIN_APPROVE,
		handler: transferOriginApprove,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_TRANSFER_ORIGIN_APPROVE),
		schema: {
			params: transferParamsSchema,
			body: approveActionSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.ADMINISTRATOR_TRANSFER_ORIGIN_REJECT,
		handler: transferOriginReject,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_TRANSFER_ORIGIN_REJECT),
		schema: {
			params: transferParamsSchema,
			body: moderationReasonSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.ADMINISTRATOR_TRANSFER_DESTINATION_APPROVE,
		handler: transferDestinationApprove,
		preHandler: preHandler(
			EVENT_NAMES.ADMINISTRATOR_TRANSFER_DESTINATION_APPROVE,
		),
		schema: {
			params: transferParamsSchema,
			body: approveActionSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.ADMINISTRATOR_TRANSFER_DESTINATION_REJECT,
		handler: transferDestinationReject,
		preHandler: preHandler(
			EVENT_NAMES.ADMINISTRATOR_TRANSFER_DESTINATION_REJECT,
		),
		schema: {
			params: transferParamsSchema,
			body: moderationReasonSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.ADMINISTRATOR_TRANSFER_LIST,
		handler: transfers,
		preHandler: preHandler(EVENT_NAMES.ADMINISTRATOR_TRANSFER_LIST),
		schema: {
			response: {
				200: transferListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
