import { fromNodeHeaders } from "better-auth/node";

import { USER_STATUS, type Role } from "@referral-tracking/shared";

import { auth } from "../lib/auth";

import type { UserModelSelect } from "../drizzle/schema";

type BetterAuthSessionUser = NonNullable<
	Awaited<ReturnType<typeof auth.api.getSession>>
>["user"];

/**
 * Resolves a request's session to a full `UserModelSelect` — composes
 * better-auth's own session API (which talks to the DB through its own
 * adapter, not `core`), so it lives here rather than `lib/`, which must
 * stay DB-free.
 */
export class SessionManager {
	/**
	 * Maps better-auth's session user shape to a full `UserModelSelect`.
	 * Pure — no fetching. Better-auth's session payload only carries the
	 * fields registered as `additionalFields` in `lib/auth.ts`
	 * (`role`/`status`/`facility_id`/`must_change_password`) — the
	 * defensive fallbacks below only matter for a session issued before
	 * one of those fields existed; `status` in particular defaults to
	 * `PENDING`, not `ACTIVE`, matching this pass's "unknown status is the
	 * least-privileged one" stance.
	 */
	mapUser = (user: BetterAuthSessionUser): UserModelSelect => {
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
			facility_id:
				(rest as { facility_id?: string | null }).facility_id ?? null,
			must_change_password:
				(rest as { must_change_password?: boolean }).must_change_password ??
				false,
			two_factor_enabled:
				(rest as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false,
			nda_accepted_version:
				(rest as { nda_accepted_version?: string | null })
					.nda_accepted_version ?? null,
			/** Audit-only, never registered as a better-auth additionalField, so never present on the session user. */
			nda_accepted_at: null,
		};
	};

	/**
	 * Resolves a request's session straight to a `UserModelSelect`, or
	 * `null` if there isn't a valid one — never rejects. For routes/checks
	 * that need to know "who's asking, if anyone" without a full session
	 * object — `facilities/service.ts`'s `listFacilities` visibility
	 * filter changes by caller role, but the route stays reachable
	 * unauthenticated for the public sign-up picker.
	 * `middleware/authenticate.ts` does its own `getSession` call instead
	 * of this, since it also needs the raw session fields
	 * (`token`/`expiresAt`/...) this method doesn't return.
	 */
	resolveUser = async (headers: Headers): Promise<UserModelSelect | null> => {
		const userSession = await auth.api.getSession({ headers });
		if (!userSession?.session || !userSession.user) return null;

		return this.mapUser(userSession.user);
	};

	/** Convenience wrapper — resolves directly from Fastify's raw Node headers. */
	resolveUserFromNodeHeaders = (
		headers: Parameters<typeof fromNodeHeaders>[0],
	): Promise<UserModelSelect | null> =>
		this.resolveUser(fromNodeHeaders(headers));
}
