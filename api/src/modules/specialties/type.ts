import type { RouteGenericInterface } from "fastify";

import type {
	SpecialtyParams,
	SpecialtiesQuery,
	GlobalResponse,
	CreateSpecialtyBody,
	UpdateSpecialtyBody,
	SpecialtyResponse,
	SpecialtyListResponse,
} from "@referral-tracking/shared";

export interface SpecialtiesRequest extends RouteGenericInterface {
	Querystring: SpecialtiesQuery;
	Reply: SpecialtyListResponse | GlobalResponse;
}

export interface SpecialtyCreateRequest extends RouteGenericInterface {
	Body: CreateSpecialtyBody;
	Reply: SpecialtyResponse | GlobalResponse;
}

export interface SpecialtyRequest extends RouteGenericInterface {
	Params: SpecialtyParams;
	Reply: SpecialtyResponse | GlobalResponse;
}

export interface SpecialtyUpdateRequest extends RouteGenericInterface {
	Params: SpecialtyParams;
	Body: UpdateSpecialtyBody;
	Reply: SpecialtyResponse | GlobalResponse;
}
