import { eq } from "drizzle-orm";

import { ROLES, USER_STATUS } from "@referral-tracking/shared";

import { auth } from "../src/lib/auth";
import { generateTemporaryPassword } from "../src/lib/util";
import { client, connection } from "../src/lib/database";

import { UserModel } from "../src/drizzle/schema";

/**
 * Creates the very first Administrator, entirely outside the public API —
 * `POST /sign-up` can never create one (see `signUpRoleSchema`), so
 * without this there'd be no way to get a working Administrator account at
 * all on a fresh deployment. Idempotent: no-ops if any Administrator
 * already exists, so it's safe to run on every deploy rather than only
 * once by hand.
 *
 * Env vars: `BOOTSTRAP_ADMIN_EMAIL` (required), `BOOTSTRAP_ADMIN_NAME`
 * (optional, defaults to "Administrator"), `BOOTSTRAP_ADMIN_PASSWORD`
 * (optional — if omitted, a one-time password is generated and printed
 * once; save it, it's never shown again).
 *
 * Every *subsequent* Administrator is created by an existing one, via
 * `POST /administrator/users` — this script is only for the chicken-and-egg
 * first one.
 */
async function bootstrapAdmin(): Promise<void> {
	console.log("🔐 Checking for an existing Administrator...");

	const [existing] = await connection
		.select({ id: UserModel.id })
		.from(UserModel)
		.where(eq(UserModel.role, ROLES.ADMINISTRATOR))
		.limit(1);

	if (existing) {
		console.log("↷ An Administrator already exists — nothing to do.");
		return;
	}

	const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
	const name = process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrator";

	if (!email) {
		console.error("❌ BOOTSTRAP_ADMIN_EMAIL is required.");
		process.exitCode = 1;
		return;
	}

	const generatedPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD
		? null
		: generateTemporaryPassword();
	const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? generatedPassword!;

	const created = await auth.api.signUpEmail({
		body: { name, email, password, role: ROLES.ADMINISTRATOR },
	});

	await connection
		.update(UserModel)
		.set({ status: USER_STATUS.ACTIVE })
		.where(eq(UserModel.id, created.user.id));

	console.log(`✅ Administrator created — ${email}`);
	if (generatedPassword) {
		console.log(`   Generated password (shown once, save it now): ${generatedPassword}`);
	}
}

bootstrapAdmin()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await client.end();
	});
