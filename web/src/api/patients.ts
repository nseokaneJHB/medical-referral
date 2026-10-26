import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type PatientParams,
	type PatientsQuery,
	type TransferResponse,
	type ApproveActionBody,
	type CreatePatientBody,
	type UpdatePatientBody,
	type PatientResponse,
	type TransferRequestBody,
	type ModerationReasonBody,
	type PatientListResponse,
	type PatientDetailResponse,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).PATIENTS;

// Read (server-side, cookie-forwarded — used in route loaders)
export const patientsRequest = createServerFn({ method: "GET" })
	.inputValidator((query?: PatientsQuery) => query)
	.handler(async ({ data: query }): Promise<PatientListResponse> => {
		const options = {
			...forwardedRequestOptions(),
			params: query,
			paramsSerializer: { indexes: null },
		};

		const { data } = await api.get<PatientListResponse>(baseUrl, options);
		return data;
	});

export const patientRequest = createServerFn({ method: "GET" })
	.inputValidator((params: PatientParams) => params)
	.handler(async ({ data: params }): Promise<PatientDetailResponse> => {
		const url = `${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_BY_ID, params)}`;
		const { data } = await api.get<PatientDetailResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	});

// Write (client-side)
export const createPatient = async (
	payload: CreatePatientBody,
): Promise<PatientResponse> => {
	const { data } = await api.post<PatientResponse>(baseUrl, payload);
	return data;
};

export const updatePatient = async (
	id: string,
	payload: UpdatePatientBody,
): Promise<PatientResponse> => {
	const url = `${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_BY_ID, { id })}`;
	const { data } = await api.patch<PatientResponse>(url, payload);
	return data;
};

export const flagPatient = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<PatientResponse> => {
	const url = `${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_FLAG, { id })}`;
	const { data } = await api.patch<PatientResponse>(url, payload);
	return data;
};

export const unflagPatient = async (
	id: string,
	payload: ApproveActionBody,
): Promise<PatientResponse> => {
	const url = `${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_UNFLAG, { id })}`;
	const { data } = await api.patch<PatientResponse>(url, payload);
	return data;
};

export const requestPatientTransfer = async (
	id: string,
	payload: TransferRequestBody,
): Promise<TransferResponse> => {
	const url = `${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_TRANSFER_REQUEST, { id })}`;
	const { data } = await api.post<TransferResponse>(url, payload);
	return data;
};
