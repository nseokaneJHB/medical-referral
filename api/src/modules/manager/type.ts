import type { RouteGenericInterface } from "fastify";

import type {
	UserParams,
	AppealBody,
	AppealParams,
	UserResponse,
	GlobalResponse,
	TimelineResponse,
	AppealDecisionBody,
	ApproveActionBody,
	ModerationReasonBody,
	TimelineListResponse,
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
	Querystring: { page?: string; limit?: string };
	Reply: TimelineListResponse | GlobalResponse;
}

export interface AuditListRequest extends RouteGenericInterface {
	Querystring: { page?: string; limit?: string };
	Reply: ManagerAuditListResponse | GlobalResponse;
}
