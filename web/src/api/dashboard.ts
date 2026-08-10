import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	type NurseSummaryResponse,
	type DoctorSummaryResponse,
	type AdminSummaryResponse,
	type ManagerSummaryResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).DASHBOARD;

const forwardedRequestOptions = () => {
	const request = getRequest();
	const cookie = request.headers.get("cookie");
	return cookie ? { headers: { cookie } } : {};
};

export const nurseSummaryRequest = createServerFn({
	method: "GET",
}).handler(async (): Promise<NurseSummaryResponse> => {
	const url = `${baseUrl}/nurse/summary`;
	const { data } = await api.get<NurseSummaryResponse>(
		url,
		forwardedRequestOptions(),
	);
	return data;
});

export const doctorSummaryRequest = createServerFn({
	method: "GET",
}).handler(async (): Promise<DoctorSummaryResponse> => {
	const url = `${baseUrl}/doctor/summary`;
	const { data } = await api.get<DoctorSummaryResponse>(
		url,
		forwardedRequestOptions(),
	);
	return data;
});

export const adminSummaryRequest = createServerFn({
	method: "GET",
}).handler(async (): Promise<AdminSummaryResponse> => {
	const url = `${baseUrl}/admin/summary`;
	const { data } = await api.get<AdminSummaryResponse>(
		url,
		forwardedRequestOptions(),
	);
	return data;
});

export const managerSummaryRequest = createServerFn({
	method: "GET",
}).handler(async (): Promise<ManagerSummaryResponse> => {
	const url = `${baseUrl}/manager/summary`;
	const { data } = await api.get<ManagerSummaryResponse>(
		url,
		forwardedRequestOptions(),
	);
	return data;
});
