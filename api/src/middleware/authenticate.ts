import type { FastifyReply, FastifyRequest } from "fastify";

import { fromNodeHeaders } from "better-auth/node";

import {
	FRONTEND_URLS,
	HTTP_RESPONSE_CODE,
	type GlobalResponse,
} from "@referral-tracking/shared";

import { auth } from "../lib/auth";
import { mapSessionUser } from "../lib/session";

import { SessionModelSelect } from "../drizzle/schema";

/**
 * Middleware: Require a valid authenticated session.
 * Attaches session and user to the request for downstream handlers.
 *
 * Status/facility gating (is this account/facility usable right now) lives
 * in `authorize` (`middleware/authorize.ts`), not here — `authenticate`
 * only ever checks "is there a session." This is deliberate: `PENDING`/
 * `REJECTED`/`FLAGGED`/`DISABLED` accounts (and users at a non-`APPROVED`
 * facility) must still be able to sign in to see their own status and file
 * an appeal (`modules/account/route.ts`), which only works if
 * `authenticate` alone doesn't already reject them.
 *
 * Usage: preHandler: [app.authenticate]
 */
export const authenticate = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const headers = fromNodeHeaders(request.headers);

	const userSession = await auth.api.getSession({ headers });

	if (!userSession || !userSession.session || !userSession.user) {
		const { status, code } = HTTP_RESPONSE_CODE.UNAUTHENTICATED;
		const response: GlobalResponse = {
			code,
			message: "Unauthenticated.",
			redirectUrl: FRONTEND_URLS.SIGN_IN,
		};

		return reply.status(status).send(response);
	}

	const session: SessionModelSelect = {
		id: userSession.session.id,
		token: userSession.session.token,
		user_id: userSession.session.userId,
		expires_at: userSession.session.expiresAt,
		created_at: userSession.session.createdAt,
		updated_at: userSession.session.updatedAt,
		agent: userSession.session.userAgent ?? null,
		ip: userSession.session.ipAddress ?? null,
	};

	request.user = mapSessionUser(userSession.user);
	request.session = session;

	return;
};
