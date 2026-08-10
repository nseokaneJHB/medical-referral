import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type PatientParams,
	type PatientsQuery,
	type ApproveActionBody,
	type CreatePatientBody,
	type UpdatePatientBody,
	type PatientResponse,
	type ModerationReasonBody,
	type PatientListResponse,
} from "@referral-tracking/shared";

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).PATIENTS;

const forwardedRequestOptions = () => {
	const request = getRequest();
	const cookie = request.headers.get("cookie");
	return cookie ? { headers: { cookie } } : {};
};

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
	.handler(async ({ data: params }): Promise<PatientResponse> => {
		const url = `${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_BY_ID, params)}`;
		const { data } = await api.get<PatientResponse>(
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
	const { data } = await api.patch<PatientResponse>(
		`${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_BY_ID, { id })}`,
		payload,
	);
	return data;
};

export const flagPatient = async (
	id: string,
	payload: ModerationReasonBody,
): Promise<PatientResponse> => {
	const { data } = await api.patch<PatientResponse>(
		`${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_FLAG, { id })}`,
		payload,
	);
	return data;
};

export const unflagPatient = async (
	id: string,
	payload: ApproveActionBody,
): Promise<PatientResponse> => {
	const { data } = await api.patch<PatientResponse>(
		`${baseUrl}${buildUrlWithParams(API_PATHS.PATIENT_UNFLAG, { id })}`,
		payload,
	);
	return data;
};
