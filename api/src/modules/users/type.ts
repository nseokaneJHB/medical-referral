import type { RouteGenericInterface } from "fastify";

import type {
	UsersQuery,
	UserParams,
	GlobalResponse,
	UserListResponse,
	UserDetailResponse,
	TimelineListResponse,
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
