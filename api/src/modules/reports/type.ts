import type { RouteGenericInterface } from "fastify";

import type {
	GlobalResponse,
	ReferralsReportQuery,
	ReferralsReportResponse,
} from "@referral-tracking/shared";

export interface ReferralsReportRequest extends RouteGenericInterface {
	Querystring: ReferralsReportQuery;
	Reply: ReferralsReportResponse | GlobalResponse;
}
