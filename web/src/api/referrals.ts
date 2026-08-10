import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	type ReferralParams,
	type ReferralsQuery,
	type CreateReferralBody,
	type UpdateReferralBody,
	type ReferralResponse,
	type ReferralListResponse,
	type TimelineListResponse,
	type UpdateReferralStatusBody,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).REFERRALS;

const forwardedRequestOptions = () => {
	const request = getRequest();
	const cookie = request.headers.get("cookie");
	return cookie ? { headers: { cookie } } : {};
};

// Read (server-side, cookie-forwarded — used in route loaders)
export const referralsRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: ReferralsQuery) => query)
	.handler(async ({ data: query }): Promise<ReferralListResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<ReferralListResponse>(baseUrl, options);
		return data;
	});

export const referralRequest = createServerFn({ method: "GET" })
	.inputValidator((params: ReferralParams) => params)
	.handler(async ({ data: params }): Promise<ReferralResponse> => {
		const url = `${baseUrl}/${params.id}`;
		const { data } = await api.get<ReferralResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

export const referralHistoryRequest = createServerFn({ method: "GET" })
	.inputValidator((params: ReferralParams) => params)
	.handler(async ({ data: params }): Promise<TimelineListResponse> => {
		const url = `${baseUrl}/${params.id}/history`;
		const { data } = await api.get<TimelineListResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

// Write (client-side)
export const createReferral = async (
	payload: CreateReferralBody,
): Promise<ReferralResponse> => {
	const { data } = await api.post<ReferralResponse>(baseUrl, payload);
	return data;
};

export const updateReferral = async (
	id: string,
	payload: UpdateReferralBody,
): Promise<ReferralResponse> => {
	const { data } = await api.patch<ReferralResponse>(
		`${baseUrl}/${id}`,
		payload,
	);
	return data;
};

export const updateReferralStatus = async (
	id: string,
	payload: UpdateReferralStatusBody,
): Promise<ReferralResponse> => {
	const { data } = await api.patch<ReferralResponse>(
		`${baseUrl}/${id}/status`,
		payload,
	);
	return data;
};

export const assignReferral = async (id: string): Promise<ReferralResponse> => {
	const { data } = await api.patch<ReferralResponse>(
		`${baseUrl}/${id}/assign`,
		null,
	);
	return data;
};
