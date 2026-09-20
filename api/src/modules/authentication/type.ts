import type { RouteGenericInterface } from "fastify";

import type {
	SignUpBody,
	SignInBody,
	GlobalResponse,
	SignInResponse,
	SessionResponse,
	TwoFactorSendOtpBody,
	TwoFactorVerifyCodeBody,
} from "@referral-tracking/shared";

export interface SignUpRequest extends RouteGenericInterface {
	Body: SignUpBody;
	Reply: GlobalResponse;
}

export interface SignInRequest extends RouteGenericInterface {
	Body: SignInBody;
	Reply: SignInResponse;
}

export interface SignOutRequest extends RouteGenericInterface {
	Reply: GlobalResponse;
}

export interface SessionRequest extends RouteGenericInterface {
	Reply: SessionResponse | GlobalResponse;
}

export interface TwoFactorVerifyTotpRequest extends RouteGenericInterface {
	Body: TwoFactorVerifyCodeBody;
	Reply: GlobalResponse;
}

export interface TwoFactorVerifyBackupCodeRequest extends RouteGenericInterface {
	Body: TwoFactorVerifyCodeBody;
	Reply: GlobalResponse;
}

export interface TwoFactorSendOtpRequest extends RouteGenericInterface {
	Body: TwoFactorSendOtpBody;
	Reply: GlobalResponse;
}

export interface TwoFactorVerifyOtpRequest extends RouteGenericInterface {
	Body: TwoFactorVerifyCodeBody;
	Reply: GlobalResponse;
}
