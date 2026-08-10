import { z } from "zod";

import { globalResponseSchema } from "../schema/global";

export type GlobalResponse = z.infer<typeof globalResponseSchema>;
