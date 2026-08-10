import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type UsersQuery,
	type UserParams,
	type UserListResponse,
	type UserDetailResponse,
	type TimelineListResponse,
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
