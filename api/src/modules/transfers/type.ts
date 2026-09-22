import type { RouteGenericInterface } from "fastify";

import type {
	PaginationQuery,
	PatientParams,
	GlobalResponse,
	TransferParams,
	TransferResponse,
	ApproveActionBody,
	TransferListResponse,
	TransferRequestBody,
	ModerationReasonBody,
} from "@referral-tracking/shared";

export interface TransferRequestRequest extends RouteGenericInterface {
	Params: PatientParams;
	Body: TransferRequestBody;
	Reply: TransferResponse | GlobalResponse;
}

export interface TransferApproveRequest extends RouteGenericInterface {
	Params: TransferParams;
	Body: ApproveActionBody;
	Reply: TransferResponse | GlobalResponse;
}

export interface TransferRejectRequest extends RouteGenericInterface {
	Params: TransferParams;
	Body: ModerationReasonBody;
	Reply: TransferResponse | GlobalResponse;
}

export interface TransfersRequest extends RouteGenericInterface {
	Querystring: PaginationQuery;
	Reply: TransferListResponse | GlobalResponse;
}
