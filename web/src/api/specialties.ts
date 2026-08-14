import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type SpecialtiesQuery,
	type SpecialtyResponse,
	type SpecialtyListResponse,
	type CreateSpecialtyBody,
	type UpdateSpecialtyBody,
	type FacilityParams,
	type FacilitySpecialtyListResponse,
	type FacilitySpecialtyLinkResponse,
	type AssignFacilitySpecialtyBody,
	type UserParams,
	type UserSpecialtyListResponse,
	type UserSpecialtyLinkResponse,
	type AssignUserSpecialtyBody,
	type ReferralParams,
	type ReferralSpecialtyListResponse,
	type ReferralSpecialtyLinkResponse,
	type AssignReferralSpecialtyBody,
	type GlobalResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const specialtiesBaseUrl = API_URLS(env.VITE_API_VERSION).SPECIALTIES;
const facilitiesBaseUrl = API_URLS(env.VITE_API_VERSION).FACILITIES;
const usersBaseUrl = API_URLS(env.VITE_API_VERSION).USERS;
const referralsBaseUrl = API_URLS(env.VITE_API_VERSION).REFERRALS;

const forwardedRequestOptions = () => {
	const request = getRequest();
	const cookie = request.headers.get("cookie");
	return cookie ? { headers: { cookie } } : {};
};

// Read (server-side, cookie-forwarded — used in route loaders)
export const specialtiesRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: SpecialtiesQuery) => query)
	.handler(async ({ data: query }): Promise<SpecialtyListResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<SpecialtyListResponse>(
			specialtiesBaseUrl,
			options,
		);
		return data;
	});

export const facilitySpecialtiesRequest = createServerFn({ method: "GET" })
	.inputValidator((params: FacilityParams) => params)
	.handler(
		async ({ data: params }): Promise<FacilitySpecialtyListResponse> => {
			const url = `${facilitiesBaseUrl}${buildUrlWithParams(API_PATHS.FACILITY_SPECIALTY_LIST, params)}`;
			const { data } = await api.get<FacilitySpecialtyListResponse>(
				url,
				forwardedRequestOptions(),
			);
			return data;
		},
	);

export const userSpecialtiesRequest = createServerFn({ method: "GET" })
	.inputValidator((params: UserParams) => params)
	.handler(async ({ data: params }): Promise<UserSpecialtyListResponse> => {
		const url = `${usersBaseUrl}${buildUrlWithParams(API_PATHS.USER_SPECIALTY_LIST, params)}`;
		const { data } = await api.get<UserSpecialtyListResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

export const referralSpecialtiesRequest = createServerFn({ method: "GET" })
	.inputValidator((params: ReferralParams) => params)
	.handler(
		async ({ data: params }): Promise<ReferralSpecialtyListResponse> => {
			const url = `${referralsBaseUrl}${buildUrlWithParams(API_PATHS.REFERRAL_SPECIALTY_LIST, params)}`;
			const { data } = await api.get<ReferralSpecialtyListResponse>(
				url,
				forwardedRequestOptions(),
			);
			return data;
		},
	);

// Write (client-side)
export const createSpecialty = async (
	payload: CreateSpecialtyBody,
): Promise<SpecialtyResponse> => {
	const { data } = await api.post<SpecialtyResponse>(
		specialtiesBaseUrl,
		payload,
	);
	return data;
};

export const updateSpecialty = async (
	id: string,
	payload: UpdateSpecialtyBody,
): Promise<SpecialtyResponse> => {
	const { data } = await api.patch<SpecialtyResponse>(
		`${specialtiesBaseUrl}${buildUrlWithParams(API_PATHS.SPECIALTY_BY_ID, { id })}`,
		payload,
	);
	return data;
};

export const assignFacilitySpecialty = async (
	facilityId: string,
	payload: AssignFacilitySpecialtyBody,
): Promise<FacilitySpecialtyLinkResponse> => {
	const { data } = await api.post<FacilitySpecialtyLinkResponse>(
		`${facilitiesBaseUrl}${buildUrlWithParams(API_PATHS.FACILITY_SPECIALTY_ASSIGN, { id: facilityId })}`,
		payload,
	);
	return data;
};

export const unassignFacilitySpecialty = async (
	facilityId: string,
	specialtyId: string,
): Promise<GlobalResponse> => {
	const { data } = await api.delete<GlobalResponse>(
		`${facilitiesBaseUrl}${buildUrlWithParams(API_PATHS.FACILITY_SPECIALTY_UNASSIGN, { id: facilityId, specialtyId })}`,
	);
	return data;
};

export const assignUserSpecialty = async (
	userId: string,
	payload: AssignUserSpecialtyBody,
): Promise<UserSpecialtyLinkResponse> => {
	const { data } = await api.post<UserSpecialtyLinkResponse>(
		`${usersBaseUrl}${buildUrlWithParams(API_PATHS.USER_SPECIALTY_ASSIGN, { id: userId })}`,
		payload,
	);
	return data;
};

export const unassignUserSpecialty = async (
	userId: string,
	specialtyId: string,
): Promise<GlobalResponse> => {
	const { data } = await api.delete<GlobalResponse>(
		`${usersBaseUrl}${buildUrlWithParams(API_PATHS.USER_SPECIALTY_UNASSIGN, { id: userId, specialtyId })}`,
	);
	return data;
};

export const assignReferralSpecialty = async (
	referralId: string,
	payload: AssignReferralSpecialtyBody,
): Promise<ReferralSpecialtyLinkResponse> => {
	const { data } = await api.post<ReferralSpecialtyLinkResponse>(
		`${referralsBaseUrl}${buildUrlWithParams(API_PATHS.REFERRAL_SPECIALTY_ASSIGN, { id: referralId })}`,
		payload,
	);
	return data;
};

export const unassignReferralSpecialty = async (
	referralId: string,
	specialtyId: string,
): Promise<GlobalResponse> => {
	const { data } = await api.delete<GlobalResponse>(
		`${referralsBaseUrl}${buildUrlWithParams(API_PATHS.REFERRAL_SPECIALTY_UNASSIGN, { id: referralId, specialtyId })}`,
	);
	return data;
};
