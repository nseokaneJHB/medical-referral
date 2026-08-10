import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	type AppealBody,
	type TimelineResponse,
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
			`${baseUrl}/status`,
			options,
		);
		return data;
	},
);

export const submitAppeal = async (
	payload: AppealBody,
): Promise<TimelineResponse> => {
	const { data } = await api.post<TimelineResponse>(
		`${baseUrl}/appeal`,
		payload,
	);
	return data;
};
