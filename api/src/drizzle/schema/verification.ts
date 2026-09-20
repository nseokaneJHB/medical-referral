import { index, varchar, timestamp, mysqlTable } from "drizzle-orm/mysql-core";

import { timestampColumns } from "./helpers";

export const VerificationModel = mysqlTable(
	"verification",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		identifier: varchar("identifier", { length: 255 }).notNull(),
		value: varchar("value", { length: 255 }).notNull(),
		expires_at: timestamp("expires_at").notNull(),

		...timestampColumns(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export type VerificationModelInsert = typeof VerificationModel.$inferInsert;
export type VerificationModelSelect = typeof VerificationModel.$inferSelect;

export type VerificationModelUniqueWhere = {
	id: VerificationModelSelect["id"];
};
