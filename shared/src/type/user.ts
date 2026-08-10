import { z } from "zod";

import {
	UserSchema,
	UserDetailSchema,
	userParamsSchema,
	usersQuerySchema,
	userResponseSchema,
	userDetailResponseSchema,
	userListResponseSchema,
} from "../schema/user";

export type User = z.infer<typeof UserSchema>;
export type UserDetail = z.infer<typeof UserDetailSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type UserDetailResponse = z.infer<typeof userDetailResponseSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
