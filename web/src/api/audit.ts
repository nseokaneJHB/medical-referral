import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { API_URLS, type LoginsListResponse } from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).AUDIT;

interface LoginsQuery {
	page?: string;
	limit?: string;
}

export const loginsRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: LoginsQuery) => query)
	.handler(async ({ data: query }): Promise<LoginsListResponse> => {
		const request = getRequest();
		const cookie = request.headers.get("cookie");
		const options = {
			...(cookie ? { headers: { cookie } } : {}),
			params: query,
		};

		const { data } = await api.get<LoginsListResponse>(
			`${baseUrl}/logins`,
			options,
		);
		return data;
	});
