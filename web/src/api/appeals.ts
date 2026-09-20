import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type TimelineResponse,
	type AppealListResponse,
	type AppealDecisionBody,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

/**
 * Appeal decisions are exposed identically under both `/manager/appeals`
 * and `/administrator/appeals` — Manager sees only appeals for their own
 * facility's staff, Administrator sees every appeal system-wide (including
 * facility appeals, which only Administrator ever decides) — same shapes,
 * different base URL and scope, so one parameterized module here instead
 * of two near-duplicate ones, mirroring `api/transfers.ts`'s `namespace`
 * pattern.
 */
type AppealNamespace = "MANAGER" | "ADMINISTRATOR";

const PATHS = {
	MANAGER: {
		LIST: API_PATHS.MANAGER_APPEAL_LIST,
		APPROVE: API_PATHS.MANAGER_APPEAL_APPROVE,
		DENY: API_PATHS.MANAGER_APPEAL_DENY,
	},
	ADMINISTRATOR: {
		LIST: API_PATHS.ADMINISTRATOR_APPEAL_LIST,
		APPROVE: API_PATHS.ADMINISTRATOR_APPEAL_APPROVE,
		DENY: API_PATHS.ADMINISTRATOR_APPEAL_DENY,
	},
} as const;

const baseUrl = (namespace: AppealNamespace): string =>
	API_URLS(env.VITE_API_VERSION)[namespace];

// Read (server-side, cookie-forwarded — used in the route loader)
export const appealsRequest = createServerFn({ method: "GET" })
	.inputValidator((data: { namespace: AppealNamespace }) => data)
	.handler(async ({ data }): Promise<AppealListResponse> => {
		const { data: response } = await api.get<AppealListResponse>(
			`${baseUrl(data.namespace)}${PATHS[data.namespace].LIST}`,
			forwardedRequestOptions(),
		);
		return response;
	});

// Write (client-side)

export const approveAppeal = async (
	namespace: AppealNamespace,
	id: string,
	payload: AppealDecisionBody,
): Promise<TimelineResponse> => {
	const { data } = await api.patch<TimelineResponse>(
		`${baseUrl(namespace)}${buildUrlWithParams(PATHS[namespace].APPROVE, { id })}`,
		payload,
	);
	return data;
};

export const denyAppeal = async (
	namespace: AppealNamespace,
	id: string,
	payload: AppealDecisionBody,
): Promise<TimelineResponse> => {
	const { data } = await api.patch<TimelineResponse>(
		`${baseUrl(namespace)}${buildUrlWithParams(PATHS[namespace].DENY, { id })}`,
		payload,
	);
	return data;
};
