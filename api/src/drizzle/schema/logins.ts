import {
	text,
	index,
	varchar,
	mysqlEnum,
	timestamp,
	mysqlTable,
} from "drizzle-orm/mysql-core";

import { LOGIN_STATUS } from "@referral-tracking/shared";

import { UserModel } from "./user";

export const LoginsModel = mysqlTable(
	"logins",
	{
		id: varchar("id", { length: 36 }).primaryKey(),

		user_id: varchar("user_id", { length: 36 })
			.notNull()
			.references(() => UserModel.id),

		login_at: timestamp("login_at").notNull(),
		logout_at: timestamp("logout_at"),
		ip: varchar("ip", { length: 100 }),
		device: text("device"),

		status: mysqlEnum("status", LOGIN_STATUS).notNull(),
		reason: text("reason"),
	},
	(table) => [
		index("logins_user_idx").on(table.user_id),
		index("logins_login_at_idx").on(table.login_at),
	],
);

export type LoginsModelInsert = typeof LoginsModel.$inferInsert;
export type LoginsModelSelect = typeof LoginsModel.$inferSelect;

export type LoginsModelUniqueWhere = { id: LoginsModelSelect["id"] };
