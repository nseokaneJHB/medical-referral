import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	type Role,
	type SignUpBody,
	type SignInBody,
	type SessionResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).AUTH;

/**
 * `/sign-up` and `/sign-in` forward Better Auth's own response body as-is
 * (see api/src/modules/authentication/service.ts's `forwardAuthResponse`)
 * — this is NOT the app's `SessionResponse` envelope, it's Better Auth's
 * native shape. `/session` is the one route with a hand-written handler
 * that actually returns `SessionResponse`.
 */
export interface AuthUserResponse {
	token: string;
	redirect?: boolean;
	user: {
		id: string;
		name: string;
		email: string;
		role: Role;
		image: string | null;
		emailVerified: boolean;
		createdAt: string;
		updatedAt: string;
		facility_id: string | null;
	};
}

export type AuthUser = NonNullable<SessionResponse["user"]>;

// Sign up (client side)
export const signUp = async (
	payload: SignUpBody,
): Promise<AuthUserResponse> => {
	const url = `${baseUrl}${API_PATHS.SIGN_UP}`;

	const { data } = await api.post<AuthUserResponse>(url, payload);

	return data;
};

// Sign in (client side)
export const signIn = async (
	payload: SignInBody,
): Promise<AuthUserResponse> => {
	const url = `${baseUrl}${API_PATHS.SIGN_IN}`;

	const { data } = await api.post<AuthUserResponse>(url, payload);

	return data;
};

// Sign out (client side)
export const signOut = async (): Promise<{ success: boolean }> => {
	const url = `${baseUrl}${API_PATHS.SIGN_OUT}`;

	const { data } = await api.post<{ success: boolean }>(url, null);

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
