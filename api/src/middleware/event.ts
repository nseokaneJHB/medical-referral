import type { FastifyReply, FastifyRequest } from "fastify";

import {
	HTTP_RESPONSE_CODE,
	type GlobalResponse,
} from "@referral-tracking/shared";

import { EventName } from "../type/global";

// 1. Extend Fastify's interface so TypeScript recognizes our high-res timer variable
declare module "fastify" {
	interface FastifyRequest {
		eventName: EventName;
	}
}

/**
 * Creates a request handler for processing a specific event type.
 * The returned handler validates the event identifier and responds with an error when it is missing.
 *
 * Args:
 *   event: The identifier or name of the event this handler should process.
 *
 * Returns:
 *   An asynchronous Fastify route handler that validates the provided event and sends a validation error response if it is not supplied.
 */
export const event = (event: EventName) => {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		if (!event) {
			const { status, code } = HTTP_RESPONSE_CODE.BAD_REQUEST;
			const response: GlobalResponse = {
				code,
				message: "Event not provided",
			};

			return reply.status(status).send(response);
		}

		request.eventName = event;

		reply.header("X-Event-Name", event);
	};
};
