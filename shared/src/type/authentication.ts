import { z } from "zod";

import {
	signUpSchema,
	signInSchema,
	sessionResponseSchema,
	signInResponseSchema,
	twoFactorSendOtpSchema,
	twoFactorVerifyCodeSchema,
} from "../schema/authentication";

export type SignUpBody = z.infer<typeof signUpSchema>;
export type SignInBody = z.infer<typeof signInSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SignInResponse = z.infer<typeof signInResponseSchema>;
export type TwoFactorVerifyCodeBody = z.infer<typeof twoFactorVerifyCodeSchema>;
export type TwoFactorSendOtpBody = z.infer<typeof twoFactorSendOtpSchema>;
