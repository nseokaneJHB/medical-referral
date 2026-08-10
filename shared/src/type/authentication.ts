import { z } from "zod";

import {
	SignUpSchema,
	SignInSchema,
	sessionResponseSchema,
} from "../schema/authentication";

export type SignUpBody = z.infer<typeof SignUpSchema>;
export type SignInBody = z.infer<typeof SignInSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
