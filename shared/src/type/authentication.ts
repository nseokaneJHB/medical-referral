import { z } from "zod";

import {
	SignUpSchema,
	SignInSchema,
	sessionResponseSchema,
	signInResponseSchema,
	TwoFactorSendOtpSchema,
	TwoFactorVerifyOtpSchema,
	TwoFactorVerifyTotpSchema,
	TwoFactorVerifyBackupCodeSchema,
} from "../schema/authentication";

export type SignUpBody = z.infer<typeof SignUpSchema>;
export type SignInBody = z.infer<typeof SignInSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SignInResponse = z.infer<typeof signInResponseSchema>;
export type TwoFactorVerifyTotpBody = z.infer<typeof TwoFactorVerifyTotpSchema>;
export type TwoFactorVerifyBackupCodeBody = z.infer<
	typeof TwoFactorVerifyBackupCodeSchema
>;
export type TwoFactorSendOtpBody = z.infer<typeof TwoFactorSendOtpSchema>;
export type TwoFactorVerifyOtpBody = z.infer<typeof TwoFactorVerifyOtpSchema>;
