import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type AppealBody,
	type FacilityParams,
	type FacilitiesQuery,
	type ApproveActionBody,
	type TimelineResponse,
	type UpdateFacilityBody,
	type FacilityResponse,
	type ModerationReasonBody,
	type FacilityListResponse,
	type TimelineListResponse,
	type FacilityDetailResponse,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).FACILITIES;

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
	.handler(async ({ data: params }): Promise<FacilityDetailResponse> => {
		const url = `${baseUrl}${buildUrlWithParams(API_PATHS.FACILITY_BY_ID, params)}`;
		const { data } = await api.get<FacilityDetailResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

export const facilityHistoryRequest = createServerFn({ method: "GET" })
	.inputValidator((params: FacilityParams) => params)
	.handler(async ({ data: params }): Promise<TimelineListResponse> => {
		const url = `${baseUrl}${buildUrlWithParams(API_PATHS.FACILITY_HISTORY, params)}`;
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
		`${baseUrl}${buildUrlWithParams(API_PATHS.FACILITY_BY_ID, { id })}`,
		payload,
	);
	return data;
};

// Moderation (Administrator only, client-side)
const administratorBaseUrl = () => API_URLS(env.VITE_API_VERSION).ADMINISTRATOR;

export const approveFacility = async (
	id: string,
	payload: ApproveActionBody,
): Promise<FacilityResponse> => {
	const { data } = await api.patch<FacilityResponse>(
		`${administratorBaseUrl()}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_FACILITY_APPROVE, { id })}`,
		payload,
	);
	return data;
};

export const rejectFacility = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<FacilityResponse> => {
	const { data } = await api.patch<FacilityResponse>(
		`${administratorBaseUrl()}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_FACILITY_REJECT, { id })}`,
		payload,
	);
	return data;
};

export const flagFacility = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<FacilityResponse> => {
	const { data } = await api.patch<FacilityResponse>(
		`${administratorBaseUrl()}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_FACILITY_FLAG, { id })}`,
		payload,
	);
	return data;
};

export const suspendFacility = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<FacilityResponse> => {
	const { data } = await api.patch<FacilityResponse>(
		`${administratorBaseUrl()}${buildUrlWithParams(API_PATHS.ADMINISTRATOR_FACILITY_SUSPEND, { id })}`,
		payload,
	);
	return data;
};

// Facility appeal (Manager only, client-side) — files against their own facility
const managerBaseUrl = () => API_URLS(env.VITE_API_VERSION).MANAGER;

export const fileFacilityAppeal = async (
	payload: AppealBody,
): Promise<TimelineResponse> => {
	const { data } = await api.post<TimelineResponse>(
		`${managerBaseUrl()}${API_PATHS.MANAGER_FACILITY_APPEAL}`,
		payload,
	);
	return data;
};
