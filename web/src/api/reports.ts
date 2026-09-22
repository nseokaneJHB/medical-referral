import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	type ReferralsReportQuery,
	type ReferralsReportResponse,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).REPORTS;

export const referralsReportRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ReferralsReportQuery) => query)
	.handler(async ({ data: query }): Promise<ReferralsReportResponse> => {
		const options = { ...forwardedRequestOptions(), params: query };

		const url = `${baseUrl}${API_PATHS.REPORTS_REFERRALS}`;
		const { data } = await api.get<ReferralsReportResponse>(url, options);
		return data;
	});
