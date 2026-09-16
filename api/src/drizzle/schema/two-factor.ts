import { sql } from "drizzle-orm";
import {
	text,
	index,
	boolean,
	varchar,
	timestamp,
	mysqlTable,
} from "drizzle-orm/mysql-core";

import { UserModel } from "./user";

/**
 * Owned by better-auth's `twoFactor()` plugin (`lib/auth.ts`) — column names
 * here are the snake_case remap targets configured via that plugin's own
 * `schema` option, not names this app invented independently. `created_at`/
 * `updated_at` aren't part of the plugin's own schema (it never sets them),
 * but are safe to keep for consistency with every other table — MySQL's
 * own column defaults populate them regardless of what the adapter's
 * INSERT statement explicitly lists.
 */
export const TwoFactorModel = mysqlTable(
	"two_factor",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		secret: text("secret").notNull(),
		backup_codes: text("backup_codes").notNull(),
		verified: boolean("verified").default(true).notNull(),

		created_at: timestamp("created_at").notNull().defaultNow(),
		updated_at: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),

		user_id: varchar("user_id", { length: 36 })
			.notNull()
			.references(() => UserModel.id, { onDelete: "cascade" }),
	},
	(table) => [index("two_factor_user_id_idx").on(table.user_id)],
);

export type TwoFactorModelInsert = typeof TwoFactorModel.$inferInsert;
export type TwoFactorModelSelect = typeof TwoFactorModel.$inferSelect;

export type TwoFactorModelUniqueWhere = { id: TwoFactorModelSelect["id"] };
