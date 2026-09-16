import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { fromNodeHeaders } from "better-auth/node";

import {
	ROLES,
	LOGIN_STATUS,
	FACILITY_STATUS,
	HTTP_RESPONSE_CODE,
	type SessionResponse,
	TWO_FACTOR_COOKIE_MAX_AGE_SECONDS,
} from "@referral-tracking/shared";

import { auth } from "../../lib/auth";
import { generateUuid } from "../../lib/util";

import type {
	SignUpRequest,
	SignInRequest,
	SignOutRequest,
	SessionRequest,
	TwoFactorSendOtpRequest,
	TwoFactorVerifyOtpRequest,
	TwoFactorVerifyTotpRequest,
	TwoFactorVerifyBackupCodeRequest,
} from "./type";

/**
 * Forwards a better-auth `Response` (returned via `asResponse: true`) onto
 * a Fastify reply — status, headers (including the session `Set-Cookie`),
 * and JSON body all carry over as-is.
 */
const forwardAuthResponse = async (
	reply: FastifyReply,
	response: Response,
): Promise<void> => {
	response.headers.forEach((value, key) => {
		if (key.toLowerCase() === "content-length") return;
		reply.header(key, value);
	});

	const body = await response.json().catch(() => null);

	reply.status(response.status);
	reply.send(body);
};

/**
 * A facility only ever comes into being `PENDING`, paired with its
 * founding Manager's own (also-`PENDING`) application — approved together
 * by an Administrator, or both stay hidden/rejected. Joining an *existing*
 * facility (Manager or Nurse/Doctor) instead must actually be one an
 * Administrator has approved — closes the gap where a client bypasses the
 * visibility filter on `GET /facilities` and POSTs a known-but-hidden
 * (pending/rejected/flagged/suspended) facility id directly.
 *
 * Not wrapped in a try/catch to clean up a just-created facility if
 * `signUpEmail` fails afterward: `Facility`'s repo class deliberately has
 * no `delete` (see `core/facility.ts` — a facility already referenced by
 * other rows is a reassignment/soft-delete problem, not a hard delete,
 * matching this whole redesign's no-hard-delete stance). A failure here
 * leaves the paired facility `PENDING` and orphaned (no Manager ever
 * attached) — inert and Administrator-visible-only, not a data integrity
 * problem, just a harmless leftover. True atomicity across this Drizzle
 * write and better-auth's own adapter writes isn't achievable without
 * deeper surgery on the adapter regardless.
 */
export const signUp = async (
	request: FastifyRequest<SignUpRequest>,
	reply: FastifyReply<SignUpRequest>,
): Promise<void> => {
	const {
		name,
		email,
		password,
		role,
		facility_id,
		new_facility_name,
		new_facility_address,
	} = request.body;

	let resolvedFacilityId = facility_id;

	if (role === ROLES.MANAGER && new_facility_name) {
		const [facility] = await request.server.core.facility.create({
			data: {
				id: generateUuid(),
				name: new_facility_name,
				address: new_facility_address ?? null,
				status: FACILITY_STATUS.PENDING,
			},
			select: { id: true },
		});
		resolvedFacilityId = facility.id;
	} else if (facility_id) {
		const facility = await request.server.core.facility.one({
			where: { id: facility_id },
			select: { id: true, status: true },
		});

		if (!facility) {
			const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
			return reply
				.status(status)
				.send({ code, message: "Facility not found." });
		}

		if (facility.status !== FACILITY_STATUS.APPROVED) {
			const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
			return reply.status(status).send({
				code,
				message: "This facility isn't accepting new registrations.",
			});
		}
	}

	const response = await auth.api.signUpEmail({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: { name, email, password, role, facility_id: resolvedFacilityId },
	});

	return forwardAuthResponse(reply, response);
};

/**
 * Resolves a signed-in-but-not-yet-2FA-verified user's stale
 * `two_factor_pending` `logins` rows to `FAILED` — see `docs/2fa.md`
 * decision #6. Better-auth deliberately doesn't expose *whose* attempt
 * just failed to a verify-totp/verify-backup-code/verify-otp caller (that
 * identity lives only in its own signed two-factor cookie), so a failed
 * second-factor attempt can't be resolved to FAILED the moment it happens.
 * This runs instead on the user's *next* sign-in attempt, once enough time
 * has passed that the pending cookie must have expired.
 */
const resolveStalePendingLogins = async (
	server: FastifyInstance,
	userId: string,
): Promise<void> => {
	const cutoff = new Date(
		Date.now() - TWO_FACTOR_COOKIE_MAX_AGE_SECONDS * 1000,
	);

	const stale = await server.core.logins.many({
		page: 1,
		limit: 20,
		where: {
			user_id: userId,
			status: LOGIN_STATUS.TWO_FACTOR_PENDING,
			login_at: { lt: cutoff },
		},
		select: { id: true },
	});

	for (const row of stale.data) {
		await server.core.logins.update({
			where: { id: row.id },
			data: {
				status: LOGIN_STATUS.FAILED,
				reason: "Second factor not completed.",
			},
			select: { id: true },
		});
	}
};

/**
 * Resolves a user's most recent open `two_factor_pending` row to `SUCCESS`
 * once they complete the second factor — mirrors `signOut`'s "most recent
 * open row" lookup further below.
 */
const resolvePendingLoginSuccess = async (
	server: FastifyInstance,
	userId: string,
): Promise<void> => {
	const pending = await server.core.logins.many({
		page: 1,
		limit: 1,
		order: { login_at: "desc" },
		where: { user_id: userId, status: LOGIN_STATUS.TWO_FACTOR_PENDING },
		select: { id: true },
	});

	const [row] = pending.data;
	if (!row) return;

	await server.core.logins.update({
		where: { id: row.id },
		data: { status: LOGIN_STATUS.SUCCESS },
		select: { id: true },
	});
};

/**
 * Resolves the user by email first (so a failed attempt against a *known*
 * email still gets an audit row — build-spec.md's `login_audit` table
 * (now `logins`) is meant to track attempts, not just successes) then logs
 * the outcome. Unknown emails aren't logged: there's no user row to attach
 * them to, and `logins.user_id` is a required FK. A correct password
 * against a 2FA-enabled account logs `TWO_FACTOR_PENDING` instead of
 * `SUCCESS` — see `docs/2fa.md` decision #6.
 */
export const signIn = async (
	request: FastifyRequest<SignInRequest>,
	reply: FastifyReply<SignInRequest>,
): Promise<void> => {
	const { email, password } = request.body;

	const existingUser = await request.server.core.user.one({
		where: { email },
		select: { id: true },
	});

	if (existingUser) {
		await resolveStalePendingLogins(request.server, existingUser.id);
	}

	const response = await auth.api.signInEmail({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: { email, password },
	});

	if (existingUser) {
		const body = (await response
			.clone()
			.json()
			.catch(() => null)) as
			| { message?: string; twoFactorRedirect?: boolean }
			| null;

		let status: (typeof LOGIN_STATUS)[keyof typeof LOGIN_STATUS];
		let reason: string | null = null;

		if (body?.twoFactorRedirect) {
			status = LOGIN_STATUS.TWO_FACTOR_PENDING;
		} else if (!response.ok) {
			status = LOGIN_STATUS.FAILED;
			reason = body?.message ?? "Invalid email or password.";
		} else {
			status = LOGIN_STATUS.SUCCESS;
		}

		await request.server.core.logins.create({
			data: {
				id: generateUuid(),
				user_id: existingUser.id,
				login_at: new Date(),
				ip: request.ip,
				device: request.headers["user-agent"] ?? null,
				status,
				reason,
			},
			select: { id: true },
		});
	}

	return forwardAuthResponse(reply, response);
};

/**
 * Stamps `logout_at` on the most recent still-open `logins` row for this
 * user — resolving the session as the standard `authenticate` middleware
 * would, but sign-out itself stays open to unauthenticated requests
 * (better-auth's own signOut no-ops gracefully without one).
 */
export const signOut = async (
	request: FastifyRequest<SignOutRequest>,
	reply: FastifyReply<SignOutRequest>,
): Promise<void> => {
	const headers = fromNodeHeaders(request.headers);
	const currentSession = await auth.api.getSession({ headers });

	const response = await request.server.core.betterAuth.signOut(
		request.headers,
	);

	if (currentSession?.user?.id) {
		const openLogins = await request.server.core.logins.many({
			limit: 1,
			order: { login_at: "desc" },
			where: {
				user_id: currentSession.user.id,
				status: LOGIN_STATUS.SUCCESS,
				logout_at: { isNull: true },
			},
			select: { id: true },
		});

		const [openLogin] = openLogins.data;
		if (openLogin) {
			await request.server.core.logins.update({
				where: { id: openLogin.id },
				data: { logout_at: new Date() },
				select: { id: true },
			});
		}
	}

	return forwardAuthResponse(reply, response);
};

export const session = async (
	request: FastifyRequest<SessionRequest>,
	reply: FastifyReply<SessionRequest>,
): Promise<void> => {
	const userSession = await auth.api.getSession({
		headers: fromNodeHeaders(request.headers),
	});

	const { code } = HTTP_RESPONSE_CODE.OK;

	const response: SessionResponse = {
		code,
		message: userSession ? "Session active." : "No active session.",
		user: userSession
			? {
					id: userSession.user.id,
					name: userSession.user.name ?? "",
					email: userSession.user.email,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					role: (userSession.user as any).role,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					status: (userSession.user as any).status,
					facility_id:
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(userSession.user as any).facility_id ?? null,
					must_change_password:
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(userSession.user as any).must_change_password ?? false,
					nda_accepted_version:
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(userSession.user as any).nda_accepted_version ?? null,
					two_factor_enabled:
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(userSession.user as any).twoFactorEnabled ?? false,
				}
			: null,
	};

	reply.status(200).send(response);
};

export const twoFactorVerifyTotp = async (
	request: FastifyRequest<TwoFactorVerifyTotpRequest>,
	reply: FastifyReply<TwoFactorVerifyTotpRequest>,
): Promise<void> => {
	const response = await auth.api.verifyTOTP({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	const body = (await response
		.clone()
		.json()
		.catch(() => null)) as { user?: { id: string } } | null;

	if (response.ok && body?.user?.id) {
		await resolvePendingLoginSuccess(request.server, body.user.id);
	}

	return forwardAuthResponse(reply, response);
};

export const twoFactorVerifyBackupCode = async (
	request: FastifyRequest<TwoFactorVerifyBackupCodeRequest>,
	reply: FastifyReply<TwoFactorVerifyBackupCodeRequest>,
): Promise<void> => {
	const response = await auth.api.verifyBackupCode({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	const body = (await response
		.clone()
		.json()
		.catch(() => null)) as { user?: { id: string } } | null;

	if (response.ok && body?.user?.id) {
		await resolvePendingLoginSuccess(request.server, body.user.id);
	}

	return forwardAuthResponse(reply, response);
};

export const twoFactorSendOtp = async (
	request: FastifyRequest<TwoFactorSendOtpRequest>,
	reply: FastifyReply<TwoFactorSendOtpRequest>,
): Promise<void> => {
	const response = await auth.api.sendTwoFactorOTP({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	return forwardAuthResponse(reply, response);
};

export const twoFactorVerifyOtp = async (
	request: FastifyRequest<TwoFactorVerifyOtpRequest>,
	reply: FastifyReply<TwoFactorVerifyOtpRequest>,
): Promise<void> => {
	const response = await auth.api.verifyTwoFactorOTP({
		asResponse: true,
		headers: fromNodeHeaders(request.headers),
		body: request.body,
	});

	const body = (await response
		.clone()
		.json()
		.catch(() => null)) as { user?: { id: string } } | null;

	if (response.ok && body?.user?.id) {
		await resolvePendingLoginSuccess(request.server, body.user.id);
	}

	return forwardAuthResponse(reply, response);
};
