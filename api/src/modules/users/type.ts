import type { RouteGenericInterface } from "fastify";

import type {
	UsersQuery,
	UserParams,
	GlobalResponse,
	UserListResponse,
	UserDetailResponse,
	TimelineListResponse,
	UserSpecialtyListResponse,
	UserSpecialtyLinkResponse,
	AssignUserSpecialtyBody,
	UserSpecialtyUnassignParams,
} from "@referral-tracking/shared";

export interface UsersRequest extends RouteGenericInterface {
	Querystring: UsersQuery;
	Reply: UserListResponse | GlobalResponse;
}

export interface UserRequest extends RouteGenericInterface {
	Params: UserParams;
	Reply: UserDetailResponse | GlobalResponse;
}

export interface UserHistoryRequest extends RouteGenericInterface {
	Params: UserParams;
	Querystring: {
		page?: string;
		limit?: string;
	};
	Reply: TimelineListResponse | GlobalResponse;
}

export interface UserSpecialtiesRequest extends RouteGenericInterface {
	Params: UserParams;
	Reply: UserSpecialtyListResponse | GlobalResponse;
}

export interface UserSpecialtyAssignRequest extends RouteGenericInterface {
	Params: UserParams;
	Body: AssignUserSpecialtyBody;
	Reply: UserSpecialtyLinkResponse | GlobalResponse;
}

export interface UserSpecialtyUnassignRequest extends RouteGenericInterface {
	Params: UserSpecialtyUnassignParams;
	Reply: GlobalResponse;
}
