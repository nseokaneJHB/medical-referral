import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	type SignUpBody,
	type SignInBody,
	type SignInResponse,
	type GlobalResponse,
	type SessionResponse,
	type TwoFactorSendOtpBody,
	type TwoFactorVerifyOtpBody,
	type TwoFactorVerifyTotpBody,
	type TwoFactorVerifyBackupCodeBody,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).AUTH;

export type AuthUser = NonNullable<SessionResponse["user"]>;

// Sign up (client side)
export const signUp = async (payload: SignUpBody): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.SIGN_UP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

// Sign in (client side) — may come back asking for a second factor instead
// of a session; see `SignInResponse.twoFactorRedirect`.
export const signIn = async (
	payload: SignInBody,
): Promise<SignInResponse> => {
	const url = `${baseUrl}${API_PATHS.SIGN_IN}`;

	const { data } = await api.post<SignInResponse>(url, payload);

	return data;
};

// Sign out (client side)
export const signOut = async (): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.SIGN_OUT}`;

	const { data } = await api.post<GlobalResponse>(url, null);

	return data;
};

// Current session (server side — forwards the incoming request's cookie)
export const sessionRequest = createServerFn({
	method: "GET",
}).handler(async (): Promise<SessionResponse> => {
	const url = `${baseUrl}${API_PATHS.SESSION}`;

	const request = getRequest();
	const cookie = request.headers.get("cookie");

	let options = {};
	if (cookie) options = { headers: { cookie } };

	const { data } = await api.get<SessionResponse>(url, options);

	return data;
});

/**
 * Completes sign-in's second factor with an authenticator-app code. Also
 * doubles as the "confirm enrollment" step right after
 * `POST /account/two-factor/enable` for an already-authenticated caller —
 * better-auth's own handler supports both cases off whichever cookie
 * (two-factor-pending or session) is present, see docs/2fa.md.
 */
export const twoFactorVerifyTotp = async (
	payload: TwoFactorVerifyTotpBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_VERIFY_TOTP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

// Completes sign-in's second factor with a one-time backup code.
export const twoFactorVerifyBackupCode = async (
	payload: TwoFactorVerifyBackupCodeBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_VERIFY_BACKUP_CODE}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

// Sends a fresh email OTP for the pending sign-in.
export const twoFactorSendOtp = async (
	payload: TwoFactorSendOtpBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_SEND_OTP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

// Completes sign-in's second factor with the emailed OTP code.
export const twoFactorVerifyOtp = async (
	payload: TwoFactorVerifyOtpBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_VERIFY_OTP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};
