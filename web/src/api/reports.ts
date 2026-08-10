import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	type ReferralsReportQuery,
	type ReferralsReportResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).REPORTS;

export const referralsReportRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ReferralsReportQuery) => query)
	.handler(async ({ data: query }): Promise<ReferralsReportResponse> => {
		const request = getRequest();
		const cookie = request.headers.get("cookie");
		const options = {
			...(cookie ? { headers: { cookie } } : {}),
			params: query,
		};

		const { data } = await api.get<ReferralsReportResponse>(
			`${baseUrl}/referrals`,
			options,
		);
		return data;
	});
