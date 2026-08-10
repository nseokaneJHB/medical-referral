import type { RouteGenericInterface } from "fastify";

import type {
	GlobalResponse,
	LoginsListResponse,
} from "@referral-tracking/shared";

export interface LoginsRequest extends RouteGenericInterface {
	Querystring: {
		page?: string;
		limit?: string;
	};
	Reply: LoginsListResponse | GlobalResponse;
}
