import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import {
	ROLES,
	APP_NAME,
	API_URLS,
	USER_STATUS,
} from "@referral-tracking/shared";

import * as schema from "../drizzle/schema";

import { env } from "./env";
import { generateUuid } from "./util";
import { connection } from "./database";

/**
 * Better Auth instance — plain email/password sign-up/sign-in, cookie
 * sessions, extended with the `role` field the registration form collects
 * (build-spec.md section 2.1 / the PDF's Registration Page).
 */
export const auth = betterAuth({
	appName: APP_NAME,
	baseURL: env.API_URL,
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: env.CORS_ORIGIN,
	basePath: API_URLS(env.API_VERSION).AUTH,
	protocol: env.NODE_ENV === "production" ? "https" : "http",
	database: drizzleAdapter(connection, {
		provider: "mysql",
		usePlural: false,
		schema: {
			user: schema.UserModel,
			account: schema.AccountModel,
			session: schema.SessionModel,
			verification: schema.VerificationModel,
		},
	}),

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
	},

	user: {
		modelName: "user",
		fields: {
			id: "id",
			name: "name",
			email: "email",
			image: "image",
			createdAt: "created_at",
			updatedAt: "updated_at",
			emailVerified: "verified",
		},
		additionalFields: {
			role: {
				input: true,
				type: "string",
				required: true,
				defaultValue: ROLES.NURSE,
			},
			/**
			 * Server-controlled, never client input. Every self-registered
			 * account starts `PENDING` (Administrator self-registration is no
			 * longer possible at all — see `signUpRoleSchema` — so this can
			 * default uniformly with no per-role branching). Moved to `ACTIVE`
			 * only by an approval action (`administrator`/`manager` modules)
			 * or a follow-up update for accounts an Administrator vouches for
			 * directly (`POST /administrator/users`) or seed/bootstrap data.
			 */
			status: {
				input: false,
				type: "string",
				required: false,
				defaultValue: USER_STATUS.PENDING,
			},
			facility_id: {
				input: true,
				type: "string",
				required: false,
			},
			/**
			 * Server-controlled. Only ever set `true` by `POST
			 * /administrator/users` and `bootstrap-admin.ts` (accounts issued
			 * a one-time generated password) — never by self-registration.
			 */
			must_change_password: {
				input: false,
				type: "boolean",
				required: false,
				defaultValue: false,
			},
		},
	},

	account: {
		modelName: "account",
		fields: {
			id: "id",
			userId: "user_id",
			password: "password",
			accountId: "account_id",
			createdAt: "created_at",
			updatedAt: "updated_at",
			providerId: "provider",
		},
	},

	session: {
		modelName: "session",
		updateAge: env.SESSION_UPDATE_AGE,
		expiresIn: env.SESSION_EXPIRES_IN,
		cookieCache: {
			version: "1",
			enabled: true,
			strategy: "jwe",
			maxAge: env.SESSION_COOKIE_CACHE_MAX_AGE,
		},
		fields: {
			id: "id",
			token: "token",
			userId: "user_id",
			expiresAt: "expires_at",
			ipAddress: "ip",
			userAgent: "agent",
			createdAt: "created_at",
			updatedAt: "updated_at",
		},
	},

	/**
	 * Adopted as-is per build-spec.md section 2.1, even though nothing
	 * currently issues verification tokens.
	 */
	verification: {
		modelName: "verification",
		fields: {
			id: "id",
			value: "value",
			expiresAt: "expires_at",
			createdAt: "created_at",
			updatedAt: "updated_at",
			identifier: "identifier",
		},
	},

	rateLimit: {
		enabled: true,
		max: env.RATE_LIMIT_MAX,
		window: env.RATE_LIMIT_WINDOW,
	},

	advanced: {
		cookiePrefix: "referral-tracking-better-auth",
		database: {
			generateId: () => generateUuid(),
		},
		defaultCookieAttributes: {
			path: "/",
			httpOnly: true,
			secure: env.NODE_ENV === "production",
			sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
		},
	},
});
