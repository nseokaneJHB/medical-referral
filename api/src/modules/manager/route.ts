import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	appealSchema,
	userParamsSchema,
	appealParamsSchema,
	userResponseSchema,
	transferParamsSchema,
	appealDecisionSchema,
	approveActionSchema,
	globalResponseSchema,
	transferResponseSchema,
	moderationReasonSchema,
	timelineResponseSchema,
	transferListResponseSchema,
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
		app.authorize([ROLES.MANAGER]),
	];

	app.route({
		method: "PATCH",
		url: API_PATHS.MANAGER_STAFF_APPROVE,
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
		url: API_PATHS.MANAGER_STAFF_REJECT,
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
		url: API_PATHS.MANAGER_STAFF_DISABLE,
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
		url: API_PATHS.MANAGER_STAFF_FLAG,
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
		url: API_PATHS.MANAGER_FACILITY_APPEAL,
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
		url: API_PATHS.MANAGER_APPEAL_APPROVE,
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
		url: API_PATHS.MANAGER_APPEAL_DENY,
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
		url: API_PATHS.MANAGER_APPEAL_LIST,
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

	app.route({
		method: "PATCH",
		url: API_PATHS.MANAGER_TRANSFER_ORIGIN_APPROVE,
		handler: transferOriginApprove,
		preHandler: preHandler(EVENT_NAMES.MANAGER_TRANSFER_ORIGIN_APPROVE),
		schema: {
			params: transferParamsSchema,
			body: approveActionSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.MANAGER_TRANSFER_ORIGIN_REJECT,
		handler: transferOriginReject,
		preHandler: preHandler(EVENT_NAMES.MANAGER_TRANSFER_ORIGIN_REJECT),
		schema: {
			params: transferParamsSchema,
			body: moderationReasonSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.MANAGER_TRANSFER_DESTINATION_APPROVE,
		handler: transferDestinationApprove,
		preHandler: preHandler(EVENT_NAMES.MANAGER_TRANSFER_DESTINATION_APPROVE),
		schema: {
			params: transferParamsSchema,
			body: approveActionSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.MANAGER_TRANSFER_DESTINATION_REJECT,
		handler: transferDestinationReject,
		preHandler: preHandler(EVENT_NAMES.MANAGER_TRANSFER_DESTINATION_REJECT),
		schema: {
			params: transferParamsSchema,
			body: moderationReasonSchema,
			response: { 200: transferResponseSchema, ...commonResponses },
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.MANAGER_TRANSFER_LIST,
		handler: transfers,
		preHandler: preHandler(EVENT_NAMES.MANAGER_TRANSFER_LIST),
		schema: {
			response: {
				200: transferListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});
};
