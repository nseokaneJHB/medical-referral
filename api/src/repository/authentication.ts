import type { FastifyRequest } from "fastify";

import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth";

/** Wraps better-auth's own `signOut` API — no `Executor`, since better-auth talks to the database through its own adapter. */
export const authSignOut = async (
	headers: FastifyRequest["headers"],
): Promise<Response> => {
	return await auth.api.signOut({
		headers: fromNodeHeaders(headers),
		asResponse: true,
	});
};
