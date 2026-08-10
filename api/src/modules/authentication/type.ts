import type { RouteGenericInterface } from "fastify";

import type {
	SignUpBody,
	SignInBody,
	GlobalResponse,
	SessionResponse,
} from "@referral-tracking/shared";

export interface SignUpRequest extends RouteGenericInterface {
	Body: SignUpBody;
	Reply: GlobalResponse;
}

export interface SignInRequest extends RouteGenericInterface {
	Body: SignInBody;
	Reply: GlobalResponse;
}

export interface SignOutRequest extends RouteGenericInterface {
	Reply: GlobalResponse;
}

export interface SessionRequest extends RouteGenericInterface {
	Reply: SessionResponse | GlobalResponse;
}
