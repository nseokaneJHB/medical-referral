import type { RouteGenericInterface } from "fastify";

import type {
	AppealBody,
	GlobalResponse,
	TimelineResponse,
	ChangePasswordBody,
	AccountStatusResponse,
} from "@referral-tracking/shared";

export interface AccountStatusRequest extends RouteGenericInterface {
	Reply: AccountStatusResponse | GlobalResponse;
}

export interface AppealSubmitRequest extends RouteGenericInterface {
	Body: AppealBody;
	Reply: TimelineResponse | GlobalResponse;
}

export interface ChangePasswordRequest extends RouteGenericInterface {
	Body: ChangePasswordBody;
	Reply: GlobalResponse;
}
