import { z } from "zod";

import {
	createUserByAdminSchema,
	createUserByAdminResponseSchema,
} from "../schema/administrator";

export type CreateUserByAdminBody = z.infer<typeof createUserByAdminSchema>;
export type CreateUserByAdminResponse = z.infer<
	typeof createUserByAdminResponseSchema
>;
