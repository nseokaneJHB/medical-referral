import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	buildUrlWithParams,
	type ApproveActionBody,
	type TransferResponse,
	type ModerationReasonBody,
	type TransferListResponse,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

/**
 * Transfer decisions are exposed identically under both `/manager/transfers`
 * and `/administrator/transfers` (the latter is the orphan-facility
 * fallback — see `docs/roles-permissions.md`) — same shapes, different base
 * URL, so one parameterized module here instead of two near-duplicate ones.
 */
type TransferNamespace = "MANAGER" | "ADMINISTRATOR";

const PATHS = {
	MANAGER: {
		LIST: API_PATHS.MANAGER_TRANSFER_LIST,
		ORIGIN_APPROVE: API_PATHS.MANAGER_TRANSFER_ORIGIN_APPROVE,
		ORIGIN_REJECT: API_PATHS.MANAGER_TRANSFER_ORIGIN_REJECT,
		DESTINATION_APPROVE: API_PATHS.MANAGER_TRANSFER_DESTINATION_APPROVE,
		DESTINATION_REJECT: API_PATHS.MANAGER_TRANSFER_DESTINATION_REJECT,
	},
	ADMINISTRATOR: {
		LIST: API_PATHS.ADMINISTRATOR_TRANSFER_LIST,
		ORIGIN_APPROVE: API_PATHS.ADMINISTRATOR_TRANSFER_ORIGIN_APPROVE,
		ORIGIN_REJECT: API_PATHS.ADMINISTRATOR_TRANSFER_ORIGIN_REJECT,
		DESTINATION_APPROVE: API_PATHS.ADMINISTRATOR_TRANSFER_DESTINATION_APPROVE,
		DESTINATION_REJECT: API_PATHS.ADMINISTRATOR_TRANSFER_DESTINATION_REJECT,
	},
} as const;

const baseUrl = (namespace: TransferNamespace): string =>
	API_URLS(env.VITE_API_VERSION)[namespace];

// Read (server-side, cookie-forwarded — used in the route loader)
export const transfersRequest = createServerFn({ method: "GET" })
	.inputValidator((data: { namespace: TransferNamespace }) => data)
	.handler(async ({ data }): Promise<TransferListResponse> => {
		const { data: response } = await api.get<TransferListResponse>(
			`${baseUrl(data.namespace)}${PATHS[data.namespace].LIST}`,
			forwardedRequestOptions(),
		);
		return response;
	});

// Write (client-side)

export const approveTransferOrigin = async (
	namespace: TransferNamespace,
	id: string,
	payload: ApproveActionBody,
): Promise<TransferResponse> => {
	const { data } = await api.patch<TransferResponse>(
		`${baseUrl(namespace)}${buildUrlWithParams(PATHS[namespace].ORIGIN_APPROVE, { id })}`,
		payload,
	);
	return data;
};

export const rejectTransferOrigin = async (
	namespace: TransferNamespace,
	id: string,
	payload: ModerationReasonBody,
): Promise<TransferResponse> => {
	const { data } = await api.patch<TransferResponse>(
		`${baseUrl(namespace)}${buildUrlWithParams(PATHS[namespace].ORIGIN_REJECT, { id })}`,
		payload,
	);
	return data;
};

export const approveTransferDestination = async (
	namespace: TransferNamespace,
	id: string,
	payload: ApproveActionBody,
): Promise<TransferResponse> => {
	const { data } = await api.patch<TransferResponse>(
		`${baseUrl(namespace)}${buildUrlWithParams(PATHS[namespace].DESTINATION_APPROVE, { id })}`,
		payload,
	);
	return data;
};

export const rejectTransferDestination = async (
	namespace: TransferNamespace,
	id: string,
	payload: ModerationReasonBody,
): Promise<TransferResponse> => {
	const { data } = await api.patch<TransferResponse>(
		`${baseUrl(namespace)}${buildUrlWithParams(PATHS[namespace].DESTINATION_REJECT, { id })}`,
		payload,
	);
	return data;
};
