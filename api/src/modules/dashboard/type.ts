import type { RouteGenericInterface } from "fastify";

import type {
	GlobalResponse,
	ReferralsReportQuery,
	NurseSummaryResponse,
	DoctorSummaryResponse,
	AdminSummaryResponse,
	ManagerSummaryResponse,
} from "@referral-tracking/shared";

export interface NurseSummaryRequest extends RouteGenericInterface {
	Querystring: ReferralsReportQuery;
	Reply: NurseSummaryResponse | GlobalResponse;
}

export interface DoctorSummaryRequest extends RouteGenericInterface {
	Querystring: ReferralsReportQuery;
	Reply: DoctorSummaryResponse | GlobalResponse;
}

export interface AdminSummaryRequest extends RouteGenericInterface {
	Querystring: ReferralsReportQuery;
	Reply: AdminSummaryResponse | GlobalResponse;
}

export interface ManagerSummaryRequest extends RouteGenericInterface {
	Querystring: ReferralsReportQuery;
	Reply: ManagerSummaryResponse | GlobalResponse;
}
