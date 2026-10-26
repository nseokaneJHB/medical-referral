import type { RouteGenericInterface } from "fastify";

import type {
	PaginationQuery,
	UserParams,
	AppealBody,
	AppealParams,
	UserResponse,
	GlobalResponse,
	TimelineResponse,
	AppealListResponse,
	AppealDecisionBody,
	ApproveActionBody,
	ModerationReasonBody,
	ManagerAuditListResponse,
} from "@referral-tracking/shared";

export interface StaffApproveRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ApproveActionBody;
	Reply: UserResponse | GlobalResponse;
}

export interface StaffRejectRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

export interface StaffDisableRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

export interface StaffFlagRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

export interface FacilityAppealSubmitRequest extends RouteGenericInterface {
	Body: AppealBody;
	Reply: TimelineResponse | GlobalResponse;
}

export interface AppealApproveRequest extends RouteGenericInterface {
	Params: AppealParams;
	Body: AppealDecisionBody;
	Reply: TimelineResponse | GlobalResponse;
}

export interface AppealDenyRequest extends RouteGenericInterface {
	Params: AppealParams;
	Body: AppealDecisionBody;
	Reply: TimelineResponse | GlobalResponse;
}

export interface AppealsRequest extends RouteGenericInterface {
	Querystring: PaginationQuery;
	Reply: AppealListResponse | GlobalResponse;
}

export interface AuditListRequest extends RouteGenericInterface {
	Querystring: PaginationQuery;
	Reply: ManagerAuditListResponse | GlobalResponse;
}
