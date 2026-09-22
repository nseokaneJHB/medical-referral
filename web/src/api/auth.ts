import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	type SignUpBody,
	type SignInBody,
	type SignInResponse,
	type GlobalResponse,
	type SessionResponse,
	type TwoFactorSendOtpBody,
	type TwoFactorVerifyCodeBody,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).AUTH;

export type AuthUser = NonNullable<SessionResponse["user"]>;

export const signUp = async (payload: SignUpBody): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.SIGN_UP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

/** May come back asking for a second factor instead of a session; see SignInResponse.twoFactorRedirect. */
export const signIn = async (payload: SignInBody): Promise<SignInResponse> => {
	const url = `${baseUrl}${API_PATHS.SIGN_IN}`;

	const { data } = await api.post<SignInResponse>(url, payload);

	return data;
};

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

	const { data } = await api.get<SessionResponse>(
		url,
		forwardedRequestOptions(),
	);

	return data;
});

/** Also doubles as the "confirm enrollment" step right after POST /account/two-factor/enable — see docs/2fa.md. */
export const twoFactorVerifyTotp = async (
	payload: TwoFactorVerifyCodeBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_VERIFY_TOTP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

export const twoFactorVerifyBackupCode = async (
	payload: TwoFactorVerifyCodeBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_VERIFY_BACKUP_CODE}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

export const twoFactorSendOtp = async (
	payload: TwoFactorSendOtpBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_SEND_OTP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};

export const twoFactorVerifyOtp = async (
	payload: TwoFactorVerifyCodeBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.TWO_FACTOR_VERIFY_OTP}`;

	const { data } = await api.post<GlobalResponse>(url, payload);

	return data;
};
