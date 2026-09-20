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

/** Column names are the snake_case remap targets configured via twoFactor()'s own schema option in lib/auth.ts, not invented independently. */
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
