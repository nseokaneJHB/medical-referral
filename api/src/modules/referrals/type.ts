import type { RouteGenericInterface } from "fastify";

import type {
	PaginationQuery,
	ReferralParams,
	ReferralsQuery,
	GlobalResponse,
	ReferralResponse,
	CreateReferralBody,
	UpdateReferralBody,
	RedirectReferralBody,
	ReferralListResponse,
	TimelineListResponse,
	UpdateReferralStatusBody,
	ReferralSpecialtyListResponse,
	ReferralSpecialtyLinkResponse,
	AssignReferralSpecialtyBody,
	ReferralSpecialtyUnassignParams,
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

export interface ReferralRedirectRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Body: RedirectReferralBody;
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
	Querystring: PaginationQuery;
	Reply: TimelineListResponse | GlobalResponse;
}

export interface ReferralSpecialtiesRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Reply: ReferralSpecialtyListResponse | GlobalResponse;
}

export interface ReferralSpecialtyAssignRequest extends RouteGenericInterface {
	Params: ReferralParams;
	Body: AssignReferralSpecialtyBody;
	Reply: ReferralSpecialtyLinkResponse | GlobalResponse;
}

export interface ReferralSpecialtyUnassignRequest extends RouteGenericInterface {
	Params: ReferralSpecialtyUnassignParams;
	Reply: GlobalResponse;
}
