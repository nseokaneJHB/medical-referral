import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	API_PATHS,
	SignUpSchema,
	SignInSchema,
	sessionResponseSchema,
} from "@referral-tracking/shared";

import { signUp, signIn, signOut, session } from "./service";

import { EVENT_NAMES } from "../../lib/constant";

export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "POST",
		url: API_PATHS.SIGN_UP,
		handler: signUp,
		preHandler: [app.event(EVENT_NAMES.SIGN_UP)],
		schema: {
			body: SignUpSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.SIGN_IN,
		handler: signIn,
		preHandler: [app.event(EVENT_NAMES.SIGN_IN)],
		schema: {
			body: SignInSchema,
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.SIGN_OUT,
		handler: signOut,
		preHandler: [app.event(EVENT_NAMES.SIGN_OUT)],
	});

	app.route({
		method: "GET",
		url: API_PATHS.SESSION,
		handler: session,
		preHandler: [app.event(EVENT_NAMES.SESSION)],
		schema: {
			response: {
				200: sessionResponseSchema,
			},
		},
	});
};
