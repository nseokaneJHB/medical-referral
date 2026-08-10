import type { FastifyRequest } from "fastify";

import { fromNodeHeaders } from "better-auth/node";

import { auth as betterAuth } from "../lib/auth";

export class BetterAuth {
	private readonly auth: typeof betterAuth;

	constructor(auth: typeof betterAuth) {
		this.auth = auth;
	}

	signOut = async (headers: FastifyRequest["headers"]): Promise<Response> => {
		return await this.auth.api.signOut({
			headers: fromNodeHeaders(headers),
			asResponse: true,
		});
	};
}
