import type { FastifyReply, FastifyRequest } from "fastify";

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

import { userUpdate } from "../../repository/user";
import { timelineMany, timelineCreate } from "../../repository/timeline";
import { accountOne, accountUpdate } from "../../repository/account";
import { facilityOne } from "../../repository/facility";
import { appealHasOpenAppeal } from "../../repository/cross-schema/appeal";

import type { Executor } from "../../repository/helpers";

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

/** Latest timeline row for an entity, whatever action it was — used as "the reason you're currently in this state." */
const latestReason = async (
	database: Executor,
	options: {
		type: (typeof TIMELINE_TYPE)[keyof typeof TIMELINE_TYPE];
		entity: string;
	},
): Promise<string | null> => {
	const result = await timelineMany(database, {
		page: 1,
		limit: 1,
		where: { type: options.type, entity: options.entity },
		order: { changed_at: "desc" },
		select: { notes: true },
	});

	return result.data[0]?.notes ?? null;
};

/** Reports the caller's own account status plus their facility's, each with the reason behind its current state. */
export const accountStatus = async (
	request: FastifyRequest<AccountStatusRequest>,
	reply: FastifyReply<AccountStatusRequest>,
): Promise<void> => {
	const user = request.user!;

	const database = request.server.database;

	const [reason, facility] = await Promise.all([
		latestReason(database, { type: TIMELINE_TYPE.USER, entity: user.id }),
		user.facility_id
			? facilityOne(database, {
					where: { id: user.facility_id },
					select: { id: true, name: true, status: true },
				})
			: Promise.resolve(null),
	]);

	const facilityReason = facility
		? await latestReason(database, {
				type: TIMELINE_TYPE.FACILITY,
				entity: facility.id,
			})
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

/** Files an appeal against the caller's own current status, rejecting a second appeal while one is already pending. */
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

	if (
		await appealHasOpenAppeal(request.server.database, {
			type: TIMELINE_TYPE.USER,
			entity: user.id,
		})
	) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "You already have a pending appeal — wait for it to be decided.",
		});
	}

	const [entry] = await timelineCreate(
		request.server.database,
		{
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
		},
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.USER,
			entity: user.id,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			previous: null,
			next: null,
			changer_id: user.id,
			notes: request.body.reason,
		},
	);

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Appeal submitted.",
		data: { ...entry, changer: { id: user.id, name: user.name } },
	});
};

/** Changes the caller's password after verifying their current one, then re-signs them in to refresh their `must_change_password` cookie cache. */
export const changePassword = async (
	request: FastifyRequest<ChangePasswordRequest>,
	reply: FastifyReply<ChangePasswordRequest>,
): Promise<void> => {
	const user = request.user!;

	const account = await accountOne(request.server.database, {
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

	await accountUpdate(
		request.server.database,
		{ where: { id: account.id }, select: { id: true } },
		{ password: await hashPassword(request.body.new_password) },
	);

	await userUpdate(
		request.server.database,
		{ where: { id: user.id }, select: { id: true } },
		{ must_change_password: false },
	);

	/** Re-running sign-in server-side re-issues a fresh cookie reflecting the cleared `must_change_password` flag, so `middleware/authorize.ts` doesn't immediately re-block the caller — same mechanism `modules/authentication/service.ts`'s `signIn` uses. */
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

/** Records the caller's NDA acceptance and refreshes their session so `middleware/authorize.ts` sees it immediately. */
export const acceptNda = async (
	request: FastifyRequest<AcceptNdaRequest>,
	reply: FastifyReply<AcceptNdaRequest>,
): Promise<void> => {
	const user = request.user!;

	await userUpdate(
		request.server.database,
		{ where: { id: user.id }, select: { id: true } },
		{ nda_accepted_version: NDA_VERSION, nda_accepted_at: new Date() },
	);

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

/** Starts two-factor enrollment via better-auth. */
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

/** Fetches the TOTP enrollment URI via better-auth. */
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

/** Generates fresh two-factor backup codes via better-auth. */
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
