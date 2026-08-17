import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type UsersQuery,
	type UserParams,
	type UserResponse,
	type UserListResponse,
	type ApproveActionBody,
	type UserDetailResponse,
	type ModerationReasonBody,
	type TimelineListResponse,
	type CreateUserByAdminBody,
	type CreateUserByAdminResponse,
	type ResetUserPasswordResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).USERS;

const forwardedRequestOptions = () => {
	const request = getRequest();
	const cookie = request.headers.get("cookie");
	return cookie ? { headers: { cookie } } : {};
};

// Read (server-side, cookie-forwarded — Admin only, enforced by the API)
export const usersRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: UsersQuery) => query)
	.handler(async ({ data: query }): Promise<UserListResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<UserListResponse>(baseUrl, options);
		return data;
	});

export const userRequest = createServerFn({ method: "GET" })
	.inputValidator((params: UserParams) => params)
	.handler(async ({ data: params }): Promise<UserDetailResponse> => {
		const url = `${baseUrl}${buildUrlWithParams(API_PATHS.USER_BY_ID, params)}`;
		const { data } = await api.get<UserDetailResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

export const userHistoryRequest = createServerFn({ method: "GET" })
	.inputValidator((params: UserParams) => params)
	.handler(async ({ data: params }): Promise<TimelineListResponse> => {
		const url = `${baseUrl}${buildUrlWithParams(API_PATHS.USER_HISTORY, params)}`;
		const { data } = await api.get<TimelineListResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

// Write (client-side)

/**
 * Staff (Nurse/Doctor) moderation is exposed identically under both
 * `/manager/staff/:id/*` and `/administrator/staff/:id/*` (the latter is the
 * orphan-facility fallback — see `docs/roles-permissions.md`) — same shapes,
 * different base URL, so one parameterized set of functions here instead of
 * two near-duplicate ones, mirroring `api/transfers.ts`'s `namespace`
 * pattern.
 */
type StaffModerationNamespace = "MANAGER" | "ADMINISTRATOR";

const STAFF_PATHS = {
	MANAGER: {
		APPROVE: API_PATHS.MANAGER_STAFF_APPROVE,
		REJECT: API_PATHS.MANAGER_STAFF_REJECT,
		FLAG: API_PATHS.MANAGER_STAFF_FLAG,
		DISABLE: API_PATHS.MANAGER_STAFF_DISABLE,
	},
	ADMINISTRATOR: {
		APPROVE: API_PATHS.ADMINISTRATOR_STAFF_APPROVE,
		REJECT: API_PATHS.ADMINISTRATOR_STAFF_REJECT,
		FLAG: API_PATHS.ADMINISTRATOR_STAFF_FLAG,
		DISABLE: API_PATHS.ADMINISTRATOR_STAFF_DISABLE,
	},
} as const;

const staffBaseUrl = (namespace: StaffModerationNamespace): string =>
	API_URLS(env.VITE_API_VERSION)[namespace];

export const approveStaff = async (
	namespace: StaffModerationNamespace,
	id: string,
	payload: ApproveActionBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${staffBaseUrl(namespace)}${buildUrlWithParams(STAFF_PATHS[namespace].APPROVE, { id })}`,
		payload,
	);
	return data;
};

export const rejectStaff = async (
	namespace: StaffModerationNamespace,
	id: string,
	payload: ModerationReasonBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${staffBaseUrl(namespace)}${buildUrlWithParams(STAFF_PATHS[namespace].REJECT, { id })}`,
		payload,
	);
	return data;
};

export const flagStaff = async (
	namespace: StaffModerationNamespace,
	id: string,
	payload: ModerationReasonBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${staffBaseUrl(namespace)}${buildUrlWithParams(STAFF_PATHS[namespace].FLAG, { id })}`,
		payload,
	);
	return data;
};

export const disableStaff = async (
	namespace: StaffModerationNamespace,
	id: string,
	payload: ModerationReasonBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${staffBaseUrl(namespace)}${buildUrlWithParams(STAFF_PATHS[namespace].DISABLE, { id })}`,
		payload,
	);
	return data;
};

/** Manager account moderation — Administrator-only, no namespace needed. */
export const approveManager = async (
	id: string,
	payload: ApproveActionBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${API_URLS(env.VITE_API_VERSION).ADMINISTRATOR}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_MANAGER_APPROVE, { id })}`,
		payload,
	);
	return data;
};

export const rejectManager = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${API_URLS(env.VITE_API_VERSION).ADMINISTRATOR}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_MANAGER_REJECT, { id })}`,
		payload,
	);
	return data;
};

export const flagManager = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${API_URLS(env.VITE_API_VERSION).ADMINISTRATOR}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_MANAGER_FLAG, { id })}`,
		payload,
	);
	return data;
};

export const disableManager = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<UserResponse> => {
	const { data } = await api.patch<UserResponse>(
		`${API_URLS(env.VITE_API_VERSION).ADMINISTRATOR}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_MANAGER_DISABLE, { id })}`,
		payload,
	);
	return data;
};

/** Administrator-only: create any role directly, active immediately. */
export const createUser = async (
	payload: CreateUserByAdminBody,
): Promise<CreateUserByAdminResponse> => {
	const { data } = await api.post<CreateUserByAdminResponse>(
		`${API_URLS(env.VITE_API_VERSION).ADMINISTRATOR}${API_PATHS.ADMINISTRATOR_USER_CREATE}`,
		payload,
	);
	return data;
};

/**
 * Administrator-only: regenerate a user's password — the recovery path
 * when a just-issued (or any) temporary password is lost before being
 * shared, since it's never recoverable once hashed.
 */
export const resetUserPassword = async (
	id: string,
): Promise<ResetUserPasswordResponse> => {
	const { data } = await api.patch<ResetUserPasswordResponse>(
		`${API_URLS(env.VITE_API_VERSION).ADMINISTRATOR}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_USER_RESET_PASSWORD, { id })}`,
		{},
	);
	return data;
};
