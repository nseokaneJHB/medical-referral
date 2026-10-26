import type { FastifyReply, FastifyRequest } from "fastify";

import { fromNodeHeaders } from "better-auth/node";

import {
	FRONTEND_URLS,
	HTTP_RESPONSE_CODE,
	type GlobalResponse,
} from "@referral-tracking/shared";

import { auth } from "../lib/auth";

import { sessionMapUser } from "../repository/cross-schema/session";

import { SessionModelSelect } from "../drizzle/schema";

/** Requires a valid session and attaches it plus the user to the request; status/facility gating lives in `authorize` instead, since a PENDING/REJECTED/etc. account must still be able to sign in to see its own status. */
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

	request.user = sessionMapUser(userSession.user);
	request.session = session;

	return;
};
