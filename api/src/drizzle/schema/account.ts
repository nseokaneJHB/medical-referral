import { sql } from "drizzle-orm";
import { index, varchar, timestamp, mysqlTable } from "drizzle-orm/mysql-core";

import { UserModel } from "./user";

export const AccountModel = mysqlTable(
	"account",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		password: varchar("password", { length: 255 }),
		account_id: varchar("account_id", { length: 255 }).notNull(),
		provider: varchar("provider", { length: 255 }).notNull(),

		created_at: timestamp("created_at").notNull().defaultNow(),
		updated_at: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),

		user_id: varchar("user_id", { length: 36 })
			.notNull()
			.references(() => UserModel.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("account_user_id_idx").on(table.user_id),
		index("account_updated_at_idx").on(table.updated_at),
	],
);

export type AccountModelInsert = typeof AccountModel.$inferInsert;
export type AccountModelSelect = typeof AccountModel.$inferSelect;

export type AccountModelUniqueWhere = { id: AccountModelSelect["id"] };
