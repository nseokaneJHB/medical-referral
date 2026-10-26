import type { RouteGenericInterface } from "fastify";

import type {
	PaginationQuery,
	FacilityParams,
	FacilitiesQuery,
	GlobalResponse,
	UpdateFacilityBody,
	FacilityResponse,
	FacilityListResponse,
	TimelineListResponse,
	FacilityDetailResponse,
	FacilitySpecialtyListResponse,
	FacilitySpecialtyLinkResponse,
	AssignFacilitySpecialtyBody,
	FacilitySpecialtyUnassignParams,
} from "@referral-tracking/shared";

/** No `FacilityCreateRequest` — `POST /facilities` is removed, see `route.ts`. */
export interface FacilityRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Reply: FacilityDetailResponse | GlobalResponse;
}

export interface FacilityUpdateRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Body: UpdateFacilityBody;
	Reply: FacilityResponse | GlobalResponse;
}

export interface FacilitiesRequest extends RouteGenericInterface {
	Querystring: FacilitiesQuery;
	Reply: FacilityListResponse | GlobalResponse;
}

export interface FacilityHistoryRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Querystring: PaginationQuery;
	Reply: TimelineListResponse | GlobalResponse;
}

export interface FacilitySpecialtiesRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Reply: FacilitySpecialtyListResponse | GlobalResponse;
}

export interface FacilitySpecialtyAssignRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Body: AssignFacilitySpecialtyBody;
	Reply: FacilitySpecialtyLinkResponse | GlobalResponse;
}

export interface FacilitySpecialtyUnassignRequest extends RouteGenericInterface {
	Params: FacilitySpecialtyUnassignParams;
	Reply: GlobalResponse;
}
