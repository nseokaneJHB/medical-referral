import { createServerFn } from "@tanstack/react-start";

import {
	API_URLS,
	API_PATHS,
	type AppealBody,
	type AcceptNdaBody,
	type GlobalResponse,
	type TimelineResponse,
	type ChangePasswordBody,
	type AccountStatusResponse,
	type TwoFactorEnableResponse,
	type TwoFactorGetTotpUriResponse,
	type TwoFactorPasswordConfirmBody,
	type TwoFactorGenerateBackupCodesResponse,
} from "@referral-tracking/shared";

import { api, forwardedRequestOptions } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).ACCOUNT;

export const accountStatusRequest = createServerFn({ method: "GET" }).handler(
	async (): Promise<AccountStatusResponse> => {
		const url = `${baseUrl}${API_PATHS.ACCOUNT_STATUS}`;
		const { data } = await api.get<AccountStatusResponse>(
			url,
			forwardedRequestOptions(),
		);
		return data;
	},
);

export const submitAppeal = async (
	payload: AppealBody,
): Promise<TimelineResponse> => {
	const url = `${baseUrl}${API_PATHS.ACCOUNT_APPEAL}`;
	const { data } = await api.post<TimelineResponse>(url, payload);
	return data;
};

export const changePassword = async (
	payload: ChangePasswordBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.ACCOUNT_CHANGE_PASSWORD}`;
	const { data } = await api.patch<GlobalResponse>(url, payload);
	return data;
};

export const acceptNda = async (
	payload: AcceptNdaBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.ACCOUNT_ACCEPT_NDA}`;
	const { data } = await api.patch<GlobalResponse>(url, payload);
	return data;
};

/** Not active until confirmed via twoFactorVerifyTotp (see @/api/auth) — see docs/2fa.md decision #5. */
export const twoFactorEnable = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<TwoFactorEnableResponse> => {
	const url = `${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_ENABLE}`;
	const { data } = await api.post<TwoFactorEnableResponse>(url, payload);
	return data;
};

export const twoFactorDisable = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<GlobalResponse> => {
	const url = `${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_DISABLE}`;
	const { data } = await api.post<GlobalResponse>(url, payload);
	return data;
};

/** Re-displays the QR code without regenerating the underlying secret. */
export const twoFactorGetTotpUri = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<TwoFactorGetTotpUriResponse> => {
	const url = `${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_GET_TOTP_URI}`;
	const { data } = await api.post<TwoFactorGetTotpUriResponse>(url, payload);
	return data;
};

/** Invalidates the previous set of backup codes. */
export const twoFactorGenerateBackupCodes = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<TwoFactorGenerateBackupCodesResponse> => {
	const url = `${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_GENERATE_BACKUP_CODES}`;
	const { data } = await api.post<TwoFactorGenerateBackupCodesResponse>(
		url,
		payload,
	);
	return data;
};
