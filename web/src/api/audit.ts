import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	type LoginsListResponse,
	type ManagerAuditListResponse,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).AUDIT;

interface AuditQuery {
	page?: string;
	limit?: string;
}

export const loginsRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: AuditQuery) => query)
	.handler(async ({ data: query }): Promise<LoginsListResponse> => {
		const options = { ...forwardedRequestOptions(), params: query };

		const { data } = await api.get<LoginsListResponse>(
			`${baseUrl}${API_PATHS.AUDIT_LOGINS}`,
			options,
		);
		return data;
	});

export const managerAuditRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: AuditQuery) => query)
	.handler(async ({ data: query }): Promise<ManagerAuditListResponse> => {
		const options = { ...forwardedRequestOptions(), params: query };

		const { data } = await api.get<ManagerAuditListResponse>(
			`${API_URLS(env.VITE_API_VERSION).MANAGER}${API_PATHS.MANAGER_AUDIT_LIST}`,
			options,
		);
		return data;
	});
