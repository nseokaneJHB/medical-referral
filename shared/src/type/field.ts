import { z } from "zod";

import {
	roleSchema,
	userStatusSchema,
	facilityStatusSchema,
	twoFactorMethodSchema,
} from "../schema/field";

export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type FacilityStatus = z.infer<typeof facilityStatusSchema>;
export type TwoFactorMethod = z.infer<typeof twoFactorMethodSchema>;
