import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	type PaginationQuery,
	type LoginsListResponse,
	type ManagerAuditListResponse,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const auditUrl = API_URLS(env.VITE_API_VERSION).AUDIT;
const managerUrl = API_URLS(env.VITE_API_VERSION).MANAGER;

export const loginsRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: PaginationQuery) => query)
	.handler(async ({ data: query }): Promise<LoginsListResponse> => {
		const options = { ...forwardedRequestOptions(), params: query };
		const url = `${auditUrl}${API_PATHS.AUDIT_LOGINS}`;

		const { data } = await api.get<LoginsListResponse>(url, options);
		return data;
	});

export const managerAuditRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: PaginationQuery) => query)
	.handler(async ({ data: query }): Promise<ManagerAuditListResponse> => {
		const options = { ...forwardedRequestOptions(), params: query };
		const url = `${managerUrl}${API_PATHS.MANAGER_AUDIT_LIST}`;

		const { data } = await api.get<ManagerAuditListResponse>(url, options);
		return data;
	});
