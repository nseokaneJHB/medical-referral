import "fastify";
import type { preHandlerHookHandler } from "fastify";

import type pino from "pino";

import type { Role } from "@referral-tracking/shared";

import { UserModelSelect, SessionModelSelect } from "../drizzle/schema";

import type { connection, close } from "../lib/database";

import type { EventName, CustomLevels } from "./global";

declare module "fastify" {
	interface FastifyInstance {
		limit: preHandlerHookHandler;
		correlation: preHandlerHookHandler;
		authenticate: preHandlerHookHandler;
		event: (event: EventName) => preHandlerHookHandler;
		authorize: (roles: Role | Role[]) => preHandlerHookHandler;

		database: typeof connection;
		closeDatabase: typeof close;
	}

	interface FastifyRequest {
		startTime?: bigint;
		eventName: EventName;
		correlationId: string;
		user: UserModelSelect | null;
		session: SessionModelSelect | null;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface FastifyBaseLogger extends pino.Logger<CustomLevels> {}
}
