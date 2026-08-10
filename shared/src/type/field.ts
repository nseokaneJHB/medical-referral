import { z } from "zod";

import {
	roleSchema,
	userStatusSchema,
	facilityStatusSchema,
} from "../schema/field";

export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type FacilityStatus = z.infer<typeof facilityStatusSchema>;
