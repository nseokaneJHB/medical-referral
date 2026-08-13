import { z } from "zod";

import { uuidSchema, emailSchema, stringSchema } from "./field";

import { paginatedGlobalResponseSchema } from "./global";

import { LoginStatusEnum } from "./referral";

export const LoginsSchema = z.object({
	id: uuidSchema,
	user_id: uuidSchema,
	login_at: z.date(),
	logout_at: z.date().nullable(),
	ip: stringSchema.nullable(),
	device: stringSchema.nullable(),
	status: LoginStatusEnum,
	reason: stringSchema.nullable(),
	user: z.object({ email: emailSchema, name: stringSchema.nullable() }).nullable(),
});

export const loginsListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(LoginsSchema),
});
