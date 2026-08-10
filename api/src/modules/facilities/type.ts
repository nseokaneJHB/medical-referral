import type { RouteGenericInterface } from "fastify";

import type {
	FacilityParams,
	FacilitiesQuery,
	GlobalResponse,
	UpdateFacilityBody,
	FacilityResponse,
	FacilityListResponse,
	TimelineListResponse,
} from "@referral-tracking/shared";

/** No `FacilityCreateRequest` — `POST /facilities` is removed, see `route.ts`. */
export interface FacilityRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Reply: FacilityResponse | GlobalResponse;
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
	Querystring: {
		page?: string;
		limit?: string;
	};
	Reply: TimelineListResponse | GlobalResponse;
}
