import type { RouteGenericInterface } from "fastify";

import type {
	PaginationQuery,
	GlobalResponse,
	LoginsListResponse,
} from "@referral-tracking/shared";

export interface LoginsRequest extends RouteGenericInterface {
	Querystring: PaginationQuery;
	Reply: LoginsListResponse | GlobalResponse;
}
