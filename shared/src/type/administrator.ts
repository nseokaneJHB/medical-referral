import { z } from "zod";

import {
	createUserByAdminSchema,
	createUserByAdminResponseSchema,
	resetUserPasswordResponseSchema,
} from "../schema/administrator";

export type CreateUserByAdminBody = z.infer<typeof createUserByAdminSchema>;
export type CreateUserByAdminResponse = z.infer<
	typeof createUserByAdminResponseSchema
>;
export type ResetUserPasswordResponse = z.infer<
	typeof resetUserPasswordResponseSchema
>;
