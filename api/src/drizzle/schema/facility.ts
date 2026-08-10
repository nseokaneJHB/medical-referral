import { sql } from "drizzle-orm";
import {
	text,
	index,
	varchar,
	mysqlEnum,
	timestamp,
	mysqlTable,
} from "drizzle-orm/mysql-core";

import { FACILITY_STATUS } from "@referral-tracking/shared";

/**
 * A facility only ever comes into being `PENDING`, paired with its
 * founding Manager's own application — see `authentication/service.ts`.
 */
export const FacilityModel = mysqlTable(
	"facilities",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		address: text("address"),

		status: mysqlEnum("status", FACILITY_STATUS)
			.default(FACILITY_STATUS.PENDING)
			.notNull(),

		created_at: timestamp("created_at").notNull().defaultNow(),
		updated_at: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
	},
	(table) => [
		index("facilities_name_idx").on(table.name),
		index("facilities_status_idx").on(table.status),
	],
);

export type FacilityModelInsert = typeof FacilityModel.$inferInsert;
export type FacilityModelSelect = typeof FacilityModel.$inferSelect;

export type FacilityModelUniqueWhere = { id: FacilityModelSelect["id"] };
