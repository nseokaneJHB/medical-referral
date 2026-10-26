import type { RouteGenericInterface } from "fastify";

import type {
	PatientParams,
	PatientsQuery,
	GlobalResponse,
	PatientResponse,
	ApproveActionBody,
	CreatePatientBody,
	UpdatePatientBody,
	ModerationReasonBody,
	PatientListResponse,
	PatientDetailResponse,
} from "@referral-tracking/shared";

export interface PatientCreateRequest extends RouteGenericInterface {
	Body: CreatePatientBody;
	Reply: PatientResponse | GlobalResponse;
}

export interface PatientRequest extends RouteGenericInterface {
	Params: PatientParams;
	Reply: PatientDetailResponse | GlobalResponse;
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

export interface PatientFlagRequest extends RouteGenericInterface {
	Params: PatientParams;
	Body: ModerationReasonBody;
	Reply: PatientResponse | GlobalResponse;
}

export interface PatientUnflagRequest extends RouteGenericInterface {
	Params: PatientParams;
	Body: ApproveActionBody;
	Reply: PatientResponse | GlobalResponse;
}
