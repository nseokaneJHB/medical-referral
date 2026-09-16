import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	type AppealBody,
	type AcceptNdaBody,
	type GlobalResponse,
	type TimelineResponse,
	type ChangePasswordBody,
	type AccountStatusResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).ACCOUNT;

export const accountStatusRequest = createServerFn({ method: "GET" }).handler(
	async (): Promise<AccountStatusResponse> => {
		const request = getRequest();
		const cookie = request.headers.get("cookie");
		const options = cookie ? { headers: { cookie } } : {};

		const { data } = await api.get<AccountStatusResponse>(
			`${baseUrl}${API_PATHS.ACCOUNT_STATUS}`,
			options,
		);
		return data;
	},
);

export const submitAppeal = async (
	payload: AppealBody,
): Promise<TimelineResponse> => {
	const { data } = await api.post<TimelineResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_APPEAL}`,
		payload,
	);
	return data;
};

export const changePassword = async (
	payload: ChangePasswordBody,
): Promise<GlobalResponse> => {
	const { data } = await api.patch<GlobalResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_CHANGE_PASSWORD}`,
		payload,
	);
	return data;
};

export const acceptNda = async (
	payload: AcceptNdaBody,
): Promise<GlobalResponse> => {
	const { data } = await api.patch<GlobalResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_ACCEPT_NDA}`,
		payload,
	);
	return data;
};
