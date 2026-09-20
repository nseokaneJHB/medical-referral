import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { fromNodeHeaders } from "better-auth/node";

import {
	NDA_VERSION,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	HTTP_RESPONSE_CODE,
	type TwoFactorEnableResponse,
	type TwoFactorGetTotpUriResponse,
	type TwoFactorGenerateBackupCodesResponse,
} from "@referral-tracking/shared";

import { auth } from "../../lib/auth";
import { canFileAppeal } from "../../lib/permission";
import { generateUuid, httpCodeForStatus } from "../../lib/util";
import { hashPassword, verifyPassword } from "../../lib/password";

import { AppealManager } from "../../management/appeal";

import type {
	AcceptNdaRequest,
	AccountStatusRequest,
	AppealSubmitRequest,
	ChangePasswordRequest,
	TwoFactorEnableRequest,
	TwoFactorDisableRequest,
	TwoFactorGetTotpUriRequest,
	TwoFactorGenerateBackupCodesRequest,
} from "./type";

/** Shape of better-auth's own error response body, read once per failed call. */
type AuthErrorBody = { message?: string };

/**
 * Latest timeline row for an entity, whatever action it was — used as
 * "the reason you're currently in this state," regardless of which
 * specific action put you there.
 */
const latestReason = async (
	server: FastifyInstance,
	type: (typeof TIMELINE_TYPE)[keyof typeof TIMELINE_TYPE],
	entity: string,
): Promise<string | null> => {
	const result = await server.core.timeline.many({
		page: 1,
		limit: 1,
		where: { type, entity },
		order: { changed_at: "desc" },
		select: { notes: true },
	});

	return result.data[0]?.notes ?? null;
};

export const accountStatus = async (
	request: FastifyRequest<AccountStatusRequest>,
	reply: FastifyReply<AccountStatusRequest>,
): Promise<void> => {
	const user = request.user!;

	const [reason, facility] = await Promise.all([
		latestReason(request.server, TIMELINE_TYPE.USER, user.id),
		user.facility_id
			? request.server.core.facility.one({
					where: { id: user.facility_id },
					select: { id: true, name: true, status: true },
				})
			: Promise.resolve(null),
	]);

	const facilityReason = facility
		? await latestReason(request.server, TIMELINE_TYPE.FACILITY, facility.id)
		: null;

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Account status retrieved.",
		data: {
			status: user.status,
			must_change_password: user.must_change_password,
			nda_accepted_version: user.nda_accepted_version,
			reason,
			facility: facility
				? {
						id: facility.id,
						name: facility.name,
						status: facility.status,
						reason: facilityReason,
					}
				: null,
		},
	});
};

export const appealSubmit = async (
	request: FastifyRequest<AppealSubmitRequest>,
	reply: FastifyReply<AppealSubmitRequest>,
): Promise<void> => {
	const user = request.user!;

	if (!canFileAppeal(user)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message:
				"There's nothing to appeal right now — check GET /account/status.",
		});
	}

	const appealManager = new AppealManager(request.server.core);
	if (await appealManager.hasOpenAppeal(TIMELINE_TYPE.USER, user.id)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "You already have a pending appeal — wait for it to be decided.",
		});
	}

	const [entry] = await request.server.core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.USER,
			entity: user.id,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			previous: null,
			next: null,
			changer_id: user.id,
			notes: request.body.reason,
		},
		select: {
			id: true,
			type: true,
			entity: true,
			action: true,
			previous: true,
			next: true,
			notes: true,
			changed_at: true,
		},
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Appeal submitted.",
		data: { ...entry, changer: { id: user.id, name: user.name } },
	});
};

export const changePassword = async (
	request: FastifyRequest<ChangePasswordRequest>,
	reply: FastifyReply<ChangePasswordRequest>,
): Promise<void> => {
	const user = request.user!;

	const account = await request.server.core.account.one({
		where: { user_id: user.id },
		select: { id: true, password: true },
	});

	if (!account || !account.password) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "No credential account found for this user." });
	}

	const valid = await verifyPassword({
		hash: account.password,
		password: request.body.current_password,
	});

	if (!valid) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Current password is incorrect." });
	}

	await request.server.core.account.update({
		where: { id: account.id },
		data: { password: await hashPassword(request.body.new_password) },
		select: { id: true },
	});

	await request.server.core.user.update({
		where: { id: user.id },
		data: { must_change_password: false },
		select: { id: true },
	});

	/**
	 * better-auth's session cookie-cache (`lib/auth.ts`'s `session.cookieCache`)
	 * embeds `must_change_password` at sign-in time and has no way to know
	 * this row just changed underneath it — re-running the sign-in flow
	 * server-side with the new password re-issues a fresh cookie reflecting
	 * the cleared flag, so the caller isn't immediately blocked by
	 * `middleware/authorize.ts` on their very next request after an
	 * otherwise-successful password change. Same mechanism
	 * `modules/authentication/service.ts`'s `signIn` handler already uses.
	 */
	const signInResponse = await auth.api.signInEmail({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: { email: user.email, password: request.body.new_password },
	});

	const freshCookies = signInResponse.headers.getSetCookie();
	if (freshCookies.length > 0) reply.header("set-cookie", freshCookies);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({ code, message: "Password changed." });
};

export const acceptNda = async (
	request: FastifyRequest<AcceptNdaRequest>,
	reply: FastifyReply<AcceptNdaRequest>,
): Promise<void> => {
	const user = request.user!;

	await request.server.core.user.update({
		where: { id: user.id },
		data: { nda_accepted_version: NDA_VERSION, nda_accepted_at: new Date() },
		select: { id: true },
	});

	/** disableCookieCache forces a fresh DB-backed read so the caller isn't immediately re-blocked by middleware/authorize.ts. */
	const sessionResponse = await auth.api.getSession({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		query: { disableCookieCache: true },
	});

	const freshCookies = sessionResponse.headers.getSetCookie();
	if (freshCookies.length > 0) reply.header("set-cookie", freshCookies);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({ code, message: "NDA accepted." });
};

export const twoFactorEnable = async (
	request: FastifyRequest<TwoFactorEnableRequest>,
	reply: FastifyReply<TwoFactorEnableRequest>,
): Promise<void> => {
	const response = await auth.api.enableTwoFactor({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	const cookies = response.headers.getSetCookie();
	if (cookies.length > 0) reply.header("set-cookie", cookies);

	const body = (await response.json()) as AuthErrorBody;

	if (response.ok) {
		return reply.status(response.status).send({
			code: HTTP_RESPONSE_CODE.OK.code,
			message: "Two-factor authentication enrollment started.",
			data: body as TwoFactorEnableResponse["data"],
		});
	}

	return reply.status(response.status).send({
		code: httpCodeForStatus(response.status),
		message: body?.message ?? "Could not enable two-factor authentication.",
	});
};

/** disableTwoFactor rotates the session internally, so its response cookie is forwarded directly — a fresh getSession call would look up the already-deleted old token. */
export const twoFactorDisable = async (
	request: FastifyRequest<TwoFactorDisableRequest>,
	reply: FastifyReply<TwoFactorDisableRequest>,
): Promise<void> => {
	const response = await auth.api.disableTwoFactor({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	if (!response.ok) {
		const body = (await response.json()) as AuthErrorBody;

		return reply.status(response.status).send({
			code: httpCodeForStatus(response.status),
			message: body?.message ?? "Could not disable two-factor authentication.",
		});
	}

	const freshCookies = response.headers.getSetCookie();
	if (freshCookies.length > 0) reply.header("set-cookie", freshCookies);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Two-factor authentication disabled." });
};

export const twoFactorGetTotpUri = async (
	request: FastifyRequest<TwoFactorGetTotpUriRequest>,
	reply: FastifyReply<TwoFactorGetTotpUriRequest>,
): Promise<void> => {
	const response = await auth.api.getTOTPURI({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	const cookies = response.headers.getSetCookie();
	if (cookies.length > 0) reply.header("set-cookie", cookies);

	const body = (await response.json()) as AuthErrorBody;

	if (response.ok) {
		return reply.status(response.status).send({
			code: HTTP_RESPONSE_CODE.OK.code,
			message: "TOTP URI retrieved.",
			data: body as TwoFactorGetTotpUriResponse["data"],
		});
	}

	return reply.status(response.status).send({
		code: httpCodeForStatus(response.status),
		message: body?.message ?? "Could not fetch TOTP URI.",
	});
};

export const twoFactorGenerateBackupCodes = async (
	request: FastifyRequest<TwoFactorGenerateBackupCodesRequest>,
	reply: FastifyReply<TwoFactorGenerateBackupCodesRequest>,
): Promise<void> => {
	const response = await auth.api.generateBackupCodes({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	const cookies = response.headers.getSetCookie();
	if (cookies.length > 0) reply.header("set-cookie", cookies);

	const body = (await response.json()) as AuthErrorBody;

	if (response.ok) {
		return reply.status(response.status).send({
			code: HTTP_RESPONSE_CODE.OK.code,
			message: "Backup codes generated.",
			data: body as TwoFactorGenerateBackupCodesResponse["data"],
		});
	}

	return reply.status(response.status).send({
		code: httpCodeForStatus(response.status),
		message: body?.message ?? "Could not generate backup codes.",
	});
};
