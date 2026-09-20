import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	type NurseSummaryResponse,
	type DoctorSummaryResponse,
	type AdminSummaryResponse,
	type ManagerSummaryResponse,
	type ReferralsReportQuery,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).DASHBOARD;

export const nurseSummaryRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ReferralsReportQuery) => query)
	.handler(async ({ data: query }): Promise<NurseSummaryResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<NurseSummaryResponse>(
			`${baseUrl}${API_PATHS.DASHBOARD_NURSE_SUMMARY}`,
			options,
		);
		return data;
	});

export const doctorSummaryRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ReferralsReportQuery) => query)
	.handler(async ({ data: query }): Promise<DoctorSummaryResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<DoctorSummaryResponse>(
			`${baseUrl}${API_PATHS.DASHBOARD_DOCTOR_SUMMARY}`,
			options,
		);
		return data;
	});

export const adminSummaryRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ReferralsReportQuery) => query)
	.handler(async ({ data: query }): Promise<AdminSummaryResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<AdminSummaryResponse>(
			`${baseUrl}${API_PATHS.DASHBOARD_ADMIN_SUMMARY}`,
			options,
		);
		return data;
	});

export const managerSummaryRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ReferralsReportQuery) => query)
	.handler(async ({ data: query }): Promise<ManagerSummaryResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<ManagerSummaryResponse>(
			`${baseUrl}${API_PATHS.DASHBOARD_MANAGER_SUMMARY}`,
			options,
		);
		return data;
	});
