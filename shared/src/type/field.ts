import { z } from "zod";

import {
	roleSchema,
	userStatusSchema,
	facilityStatusSchema,
	twoFactorMethodSchema,
	referralStatusSchema,
	prioritySchema,
	loginStatusSchema,
} from "../schema/field";

export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type FacilityStatus = z.infer<typeof facilityStatusSchema>;
export type TwoFactorMethod = z.infer<typeof twoFactorMethodSchema>;
export type ReferralStatus = z.infer<typeof referralStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type LoginStatus = z.infer<typeof loginStatusSchema>;
