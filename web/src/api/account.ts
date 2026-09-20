import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

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

import { api } from "@/api";

import { env } from "@/lib/env";

const baseUrl = API_URLS(env.VITE_API_VERSION).ACCOUNT;

export const accountStatusRequest = createServerFn({ method: "GET" }).handler(
	async (): Promise<AccountStatusResponse> => {
		const request = getRequest();
		const cookie = request.headers.get("cookie");
		const options = cookie ? { headers: { cookie } } : {};

		const { data } = await api.get<AccountStatusResponse>(
			`${baseUrl}${API_PATHS.ACCOUNT_STATUS}`,
			options,
		);
		return data;
	},
);

export const submitAppeal = async (
	payload: AppealBody,
): Promise<TimelineResponse> => {
	const { data } = await api.post<TimelineResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_APPEAL}`,
		payload,
	);
	return data;
};

export const changePassword = async (
	payload: ChangePasswordBody,
): Promise<GlobalResponse> => {
	const { data } = await api.patch<GlobalResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_CHANGE_PASSWORD}`,
		payload,
	);
	return data;
};

export const acceptNda = async (
	payload: AcceptNdaBody,
): Promise<GlobalResponse> => {
	const { data } = await api.patch<GlobalResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_ACCEPT_NDA}`,
		payload,
	);
	return data;
};

/** Not active until confirmed via twoFactorVerifyTotp (see @/api/auth) — see docs/2fa.md decision #5. */
export const twoFactorEnable = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<TwoFactorEnableResponse> => {
	const { data } = await api.post<TwoFactorEnableResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_ENABLE}`,
		payload,
	);
	return data;
};

export const twoFactorDisable = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<GlobalResponse> => {
	const { data } = await api.post<GlobalResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_DISABLE}`,
		payload,
	);
	return data;
};

/** Re-displays the QR code without regenerating the underlying secret. */
export const twoFactorGetTotpUri = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<TwoFactorGetTotpUriResponse> => {
	const { data } = await api.post<TwoFactorGetTotpUriResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_GET_TOTP_URI}`,
		payload,
	);
	return data;
};

/** Invalidates the previous set of backup codes. */
export const twoFactorGenerateBackupCodes = async (
	payload: TwoFactorPasswordConfirmBody,
): Promise<TwoFactorGenerateBackupCodesResponse> => {
	const { data } = await api.post<TwoFactorGenerateBackupCodesResponse>(
		`${baseUrl}${API_PATHS.ACCOUNT_TWO_FACTOR_GENERATE_BACKUP_CODES}`,
		payload,
	);
	return data;
};
