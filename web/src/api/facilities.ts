import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	type FacilityParams,
	type FacilitiesQuery,
	type UpdateFacilityBody,
	type FacilityResponse,
	type FacilityListResponse,
	type TimelineListResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).FACILITIES;

const forwardedRequestOptions = () => {
	const request = getRequest();
	const cookie = request.headers.get("cookie");
	return cookie ? { headers: { cookie } } : {};
};

// Read (server-side, cookie-forwarded — used in route loaders)
export const facilitiesRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: FacilitiesQuery) => query)
	.handler(async ({ data: query }): Promise<FacilityListResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<FacilityListResponse>(baseUrl, options);
		return data;
	});

export const facilityRequest = createServerFn({ method: "GET" })
	.inputValidator((params: FacilityParams) => params)
	.handler(async ({ data: params }): Promise<FacilityResponse> => {
		const url = `${baseUrl}/${params.id}`;
		const { data } = await api.get<FacilityResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

export const facilityHistoryRequest = createServerFn({ method: "GET" })
	.inputValidator((params: FacilityParams) => params)
	.handler(async ({ data: params }): Promise<TimelineListResponse> => {
		const url = `${baseUrl}/${params.id}/history`;
		const { data } = await api.get<TimelineListResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

// Write (client-side)
export const updateFacility = async (
	id: string,
	payload: UpdateFacilityBody,
): Promise<FacilityResponse> => {
	const { data } = await api.patch<FacilityResponse>(
		`${baseUrl}/${id}`,
		payload,
	);
	return data;
};
