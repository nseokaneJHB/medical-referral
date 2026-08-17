import { z } from "zod";

import {
	accountStatusSchema,
	changePasswordSchema,
	accountStatusResponseSchema,
} from "../schema/account";

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type AccountStatusResponse = z.infer<typeof accountStatusResponseSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
