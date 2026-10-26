import { z } from "zod";

import { loginsSchema, loginsListResponseSchema } from "../schema/logins";

export type Logins = z.infer<typeof loginsSchema>;
export type LoginsListResponse = z.infer<typeof loginsListResponseSchema>;
