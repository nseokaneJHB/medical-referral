import type { RouteGenericInterface } from "fastify";

import type {
	ReferralParams,
	ReferralsQuery,
	GlobalResponse,
	ReferralResponse,
	CreateReferralBody,
	UpdateReferralBody,
	ReferralListResponse,
	TimelineListResponse,
	UpdateReferralStatusBody,
} from "@referral-tracking/shared";

export interface ReferralCreateRequest extends RouteGenericInterface {
	Body: CreateReferralBody;
	Reply: ReferralResponse | GlobalResponse;
}

export interface ReferralRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Reply: ReferralResponse | GlobalResponse;
}

export interface ReferralUpdateRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Body: UpdateReferralBody;
	Reply: ReferralResponse | GlobalResponse;
}

export interface ReferralAssignRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Reply: ReferralResponse | GlobalResponse;
}

export interface ReferralStatusUpdateRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Body: UpdateReferralStatusBody;
	Reply: ReferralResponse | GlobalResponse;
}

export interface ReferralsRequest extends RouteGenericInterface {
	Querystring: ReferralsQuery;
	Reply: ReferralListResponse | GlobalResponse;
}

export interface ReferralHistoryRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Querystring: {
		page?: string;
		limit?: string;
	};
	Reply: TimelineListResponse | GlobalResponse;
}
