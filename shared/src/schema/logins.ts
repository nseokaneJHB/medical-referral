import { z } from "zod";

import {
	uuidSchema,
	emailSchema,
	stringSchema,
	loginStatusSchema,
} from "./field";

import { paginatedGlobalResponseSchema } from "./global";

export const LoginsSchema = z.object({
	id: uuidSchema,
	user_id: uuidSchema,
	login_at: z.date(),
	logout_at: z.date().nullable(),
	ip: stringSchema.nullable(),
	device: stringSchema.nullable(),
	status: loginStatusSchema,
	reason: stringSchema.nullable(),
	user: z
		.object({ email: emailSchema, name: stringSchema.nullable() })
		.nullable(),
});

export const loginsListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(LoginsSchema),
});
