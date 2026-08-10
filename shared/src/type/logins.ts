import { z } from "zod";

import { LoginsSchema, loginsListResponseSchema } from "../schema/logins";

export type Logins = z.infer<typeof LoginsSchema>;
export type LoginsListResponse = z.infer<typeof loginsListResponseSchema>;
