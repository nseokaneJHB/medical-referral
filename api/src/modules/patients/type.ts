import type { RouteGenericInterface } from "fastify";

import type {
	PatientParams,
	PatientsQuery,
	GlobalResponse,
	PatientResponse,
	CreatePatientBody,
	UpdatePatientBody,
	PatientListResponse,
} from "@referral-tracking/shared";

export interface PatientCreateRequest extends RouteGenericInterface {
	Body: CreatePatientBody;
	Reply: PatientResponse | GlobalResponse;
}

export interface PatientRequest extends RouteGenericInterface {
	Params: PatientParams;
	Reply: PatientResponse | GlobalResponse;
}

export interface PatientUpdateRequest extends RouteGenericInterface {
	Params: PatientParams;
	Body: UpdatePatientBody;
	Reply: PatientResponse | GlobalResponse;
}

export interface PatientsRequest extends RouteGenericInterface {
	Querystring: PatientsQuery;
	Reply: PatientListResponse | GlobalResponse;
}
