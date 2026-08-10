import type { RouteGenericInterface } from "fastify";

import type {
	GlobalResponse,
	NurseSummaryResponse,
	DoctorSummaryResponse,
	AdminSummaryResponse,
	ManagerSummaryResponse,
} from "@referral-tracking/shared";

export interface NurseSummaryRequest extends RouteGenericInterface {
	Reply: NurseSummaryResponse | GlobalResponse;
}

export interface DoctorSummaryRequest extends RouteGenericInterface {
	Reply: DoctorSummaryResponse | GlobalResponse;
}

export interface AdminSummaryRequest extends RouteGenericInterface {
	Reply: AdminSummaryResponse | GlobalResponse;
}

export interface ManagerSummaryRequest extends RouteGenericInterface {
	Reply: ManagerSummaryResponse | GlobalResponse;
}
