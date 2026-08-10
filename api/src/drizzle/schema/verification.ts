import { sql } from "drizzle-orm";
import { index, varchar, timestamp, mysqlTable } from "drizzle-orm/mysql-core";

export const VerificationModel = mysqlTable(
	"verification",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		identifier: varchar("identifier", { length: 255 }).notNull(),
		value: varchar("value", { length: 255 }).notNull(),
		expires_at: timestamp("expires_at").notNull(),

		created_at: timestamp("created_at").notNull().defaultNow(),
		updated_at: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export type VerificationModelInsert = typeof VerificationModel.$inferInsert;
export type VerificationModelSelect = typeof VerificationModel.$inferSelect;

export type VerificationModelUniqueWhere = {
	id: VerificationModelSelect["id"];
};
