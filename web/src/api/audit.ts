import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	type LoginsListResponse,
	type ManagerAuditListResponse,
} from "@referral-tracking/shared";

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
			`${baseUrl}${API_PATHS.AUDIT_LOGINS}`,
			options,
		);
		return data;
	});

interface ManagerAuditQuery {
	page?: string;
	limit?: string;
}

export const managerAuditRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ManagerAuditQuery) => query)
	.handler(async ({ data: query }): Promise<ManagerAuditListResponse> => {
		const request = getRequest();
		const cookie = request.headers.get("cookie");
		const options = {
			...(cookie ? { headers: { cookie } } : {}),
			params: query,
		};

		const { data } = await api.get<ManagerAuditListResponse>(
			`${API_URLS(env.VITE_API_VERSION).MANAGER}${API_PATHS.MANAGER_AUDIT_LIST}`,
			options,
		);
		return data;
	});
