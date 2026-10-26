import { index, varchar, mysqlTable } from "drizzle-orm/mysql-core";

import { UserModel } from "./user";
import { timestampColumns } from "./helpers";

export const AccountModel = mysqlTable(
	"account",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		password: varchar("password", { length: 255 }),
		account_id: varchar("account_id", { length: 255 }).notNull(),
		provider: varchar("provider", { length: 255 }).notNull(),

		...timestampColumns(),

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
