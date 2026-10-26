import { fromNodeHeaders } from "better-auth/node";

import { USER_STATUS, type Role } from "@referral-tracking/shared";

import { auth } from "../../lib/auth";

import type { UserModelSelect } from "../../drizzle/schema";

type BetterAuthSessionUser = NonNullable<
	Awaited<ReturnType<typeof auth.api.getSession>>
>["user"];

/** Maps better-auth's session user shape to a full `UserModelSelect`; fields absent from an older session default to their least-privileged value (e.g. `status` defaults to `PENDING`, not `ACTIVE`). */
export const sessionMapUser = (
	user: BetterAuthSessionUser,
): UserModelSelect => {
	const { emailVerified, createdAt, updatedAt, ...rest } = user;

	return {
		...rest,
		created_at: createdAt,
		updated_at: updatedAt,
		role: rest.role as Role,
		image: rest.image ?? null,
		verified: emailVerified,
		status: ((rest as { status?: string }).status ??
			USER_STATUS.PENDING) as UserModelSelect["status"],
		facility_id: (rest as { facility_id?: string | null }).facility_id ?? null,
		must_change_password:
			(rest as { must_change_password?: boolean }).must_change_password ??
			false,
		two_factor_enabled:
			(rest as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false,
		nda_accepted_version:
			(rest as { nda_accepted_version?: string | null })
				.nda_accepted_version ?? null,
		nda_accepted_at: null,
	};
};

/** Resolves a request's session straight to a `UserModelSelect`, or `null` if there isn't a valid one — never rejects. No `Executor` param: better-auth owns its own connection. */
export const sessionResolveUser = async (
	headers: Headers,
): Promise<UserModelSelect | null> => {
	const userSession = await auth.api.getSession({ headers });
	if (!userSession?.session || !userSession.user) return null;

	return sessionMapUser(userSession.user);
};

/** Convenience wrapper — resolves directly from Fastify's raw Node headers. */
export const sessionResolveUserFromNodeHeaders = (
	headers: Parameters<typeof fromNodeHeaders>[0],
): Promise<UserModelSelect | null> =>
	sessionResolveUser(fromNodeHeaders(headers));
