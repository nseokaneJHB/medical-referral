import { z } from "zod";

/**
 * Zod schema for validating environment variables.
 * Ensures all required environment variables are present and have correct types.
 */
const envSchema = z.object({
	PORT: z.string().default("8080").transform(Number),
	API_URL: z.string().default("http://localhost:8080"),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
	NODE_ENV: z.enum(["development", "production", "test"]),
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	FRONTEND_URL: z.string().default("http://localhost:3000"),
	CORS_ORIGIN: z
		.string()
		.default("http://localhost:3000")
		.transform((val) =>
			val
				.split(",")
				.map((origin) => origin.trim())
				.filter(Boolean),
		),

	BETTER_AUTH_SECRET: z
		.string()
		.min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

	COOKIE_SECRET: z
		.string()
		.min(32, "COOKIE_SECRET must be at least 32 characters"),

	RATE_LIMIT_MAX: z.string().default("5").transform(Number),
	RATE_LIMIT_WINDOW: z.string().default("60").transform(Number),

	/** Defaults point at the dev-only Mailpit container; SMTP_USER/PASS default empty since Mailpit needs no auth. */
	SMTP_HOST: z.string().default("mailpit"),
	SMTP_PORT: z.string().default("1025").transform(Number),
	SMTP_USER: z.string().default(""),
	SMTP_PASS: z.string().default(""),
	SMTP_FROM: z.string().default("noreply@referral-tracking.local"),

	/**
	 * Seconds. `SESSION_COOKIE_CACHE_MAX_AGE` — how long better-auth caches
	 * session data (role/status/facility_id) in a signed cookie before
	 * re-checking the DB. `SESSION_UPDATE_AGE` — how often an active
	 * session's expiry gets extended. `SESSION_EXPIRES_IN` — total session
	 * lifetime before a fresh sign-in is required.
	 */
	SESSION_COOKIE_CACHE_MAX_AGE: z.string().default("86400").transform(Number),
	SESSION_UPDATE_AGE: z.string().default("86400").transform(Number),
	SESSION_EXPIRES_IN: z.string().default("604800").transform(Number),

	/** Must match twoFactor()'s twoFactorCookieMaxAge in api/src/lib/auth.ts — both read this same env var, so they can't drift out of sync. */
	TWO_FACTOR_COOKIE_MAX_AGE_SECONDS: z
		.string()
		.default("600")
		.transform(Number),

	API_VERSION: z
		.string()
		.regex(
			/^v\d+$/,
			"API_VERSION must follow the 'vX.X' format (e.g., v1, v2)",
		),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

const loadEnv = (): Env => {
	if (_env) return _env;

	/**
	 * Parse and validate environment variables directly from process.env.
	 * Inside Docker, variables are pre-loaded into process memory via the env_file attribute.
	 */
	const parsed = envSchema.safeParse(process.env);
	if (!parsed.success) {
		console.error("❌ Invalid environment variables:");

		for (const issue of parsed.error.issues) {
			console.error(`  - [${String(issue.path[0])}]: ${issue.message}`);
		}

		process.exit(1);
	}

	_env = parsed.data;
	return _env;
};

export const env = loadEnv();
