import type { FastifyReply, FastifyRequest } from "fastify";

import { HTTP_RESPONSE_CODE } from "@referral-tracking/shared";

import { parsePagination } from "../../lib/validator";

import type { LoginsRequest } from "./type";

const LOGINS_FIELDS = {
	id: true,
	user_id: true,
	login_at: true,
	logout_at: true,
	ip: true,
	device: true,
	status: true,
	reason: true,
} as const;

export const logins = async (
	request: FastifyRequest<LoginsRequest>,
	reply: FastifyReply<LoginsRequest>,
): Promise<void> => {
	const { page, limit } = parsePagination(request.query);

	const result = await request.server.core.logins.many({
		page,
		limit,
		order: { login_at: "desc" },
		select: LOGINS_FIELDS,
		include: { user: { select: { email: true, name: true } } },
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Login audit retrieved.",
		...result,
	});
};
