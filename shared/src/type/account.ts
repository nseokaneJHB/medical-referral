import { z } from "zod";

import {
	accountStatusSchema,
	acceptNdaSchema,
	changePasswordSchema,
	accountStatusResponseSchema,
	twoFactorEnableResponseSchema,
	twoFactorPasswordConfirmSchema,
	twoFactorGetTotpUriResponseSchema,
	twoFactorGenerateBackupCodesResponseSchema,
} from "../schema/account";

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type AccountStatusResponse = z.infer<typeof accountStatusResponseSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
export type AcceptNdaBody = z.infer<typeof acceptNdaSchema>;
export type TwoFactorPasswordConfirmBody = z.infer<
	typeof twoFactorPasswordConfirmSchema
>;
export type TwoFactorEnableResponse = z.infer<
	typeof twoFactorEnableResponseSchema
>;
export type TwoFactorGetTotpUriResponse = z.infer<
	typeof twoFactorGetTotpUriResponseSchema
>;
export type TwoFactorGenerateBackupCodesResponse = z.infer<
	typeof twoFactorGenerateBackupCodesResponseSchema
>;
