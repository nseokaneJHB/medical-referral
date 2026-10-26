import type { RouteGenericInterface } from "fastify";

import type {
	AppealBody,
	GlobalResponse,
	AcceptNdaBody,
	TimelineResponse,
	ChangePasswordBody,
	AccountStatusResponse,
	TwoFactorEnableResponse,
	TwoFactorPasswordConfirmBody,
	TwoFactorGetTotpUriResponse,
	TwoFactorGenerateBackupCodesResponse,
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

export interface AcceptNdaRequest extends RouteGenericInterface {
	Body: AcceptNdaBody;
	Reply: GlobalResponse;
}

export interface TwoFactorEnableRequest extends RouteGenericInterface {
	Body: TwoFactorPasswordConfirmBody;
	Reply: TwoFactorEnableResponse | GlobalResponse;
}

export interface TwoFactorDisableRequest extends RouteGenericInterface {
	Body: TwoFactorPasswordConfirmBody;
	Reply: GlobalResponse;
}

export interface TwoFactorGetTotpUriRequest extends RouteGenericInterface {
	Body: TwoFactorPasswordConfirmBody;
	Reply: TwoFactorGetTotpUriResponse | GlobalResponse;
}

export interface TwoFactorGenerateBackupCodesRequest
	extends RouteGenericInterface {
	Body: TwoFactorPasswordConfirmBody;
	Reply: TwoFactorGenerateBackupCodesResponse | GlobalResponse;
}
