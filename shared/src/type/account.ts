import { z } from "zod";

import {
	accountStatusSchema,
	accountStatusResponseSchema,
} from "../schema/account";

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type AccountStatusResponse = z.infer<typeof accountStatusResponseSchema>;
