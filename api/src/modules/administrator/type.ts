import type { RouteGenericInterface } from "fastify";

import type {
	UserParams,
	AppealParams,
	UserResponse,
	GlobalResponse,
	FacilityParams,
	FacilityResponse,
	TimelineResponse,
	AppealDecisionBody,
	ApproveActionBody,
	ModerationReasonBody,
	CreateUserByAdminBody,
	TimelineListResponse,
	CreateUserByAdminResponse,
} from "@referral-tracking/shared";

export interface ManagerApproveRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ApproveActionBody;
	Reply: UserResponse | GlobalResponse;
}

export interface ManagerRejectRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

export interface ManagerDisableRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

export interface ManagerFlagRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

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

export interface StaffFlagRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

export interface StaffDisableRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: ModerationReasonBody;
	Reply: UserResponse | GlobalResponse;
}

export interface FacilityApproveRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Body: ApproveActionBody;
	Reply: FacilityResponse | GlobalResponse;
}

export interface FacilityRejectRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Body: ModerationReasonBody;
	Reply: FacilityResponse | GlobalResponse;
}

export interface FacilityFlagRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Body: ModerationReasonBody;
	Reply: FacilityResponse | GlobalResponse;
}

export interface FacilitySuspendRequest extends RouteGenericInterface {
	Params: FacilityParams;
	Body: ModerationReasonBody;
	Reply: FacilityResponse | GlobalResponse;
}

export interface UserCreateRequest extends RouteGenericInterface {
	Body: CreateUserByAdminBody;
	Reply: CreateUserByAdminResponse | GlobalResponse;
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
