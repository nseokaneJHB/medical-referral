import { sql } from "drizzle-orm";
import { index, varchar, timestamp, mysqlTable } from "drizzle-orm/mysql-core";

import { UserModel } from "./user";

export const SessionModel = mysqlTable(
	"session",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		token: varchar("token", { length: 255 }).notNull().unique(),
		expires_at: timestamp("expires_at").notNull(),
		ip: varchar("ip", { length: 100 }),
		agent: varchar("agent", { length: 512 }),

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
		index("session_user_id_idx").on(table.user_id),
		index("session_expires_at_idx").on(table.expires_at),
	],
);

export type SessionModelInsert = typeof SessionModel.$inferInsert;
export type SessionModelSelect = typeof SessionModel.$inferSelect;

export type SessionModelUniqueWhere = { id: SessionModelSelect["id"] };
