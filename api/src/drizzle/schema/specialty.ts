import { index, varchar, text, mysqlTable } from "drizzle-orm/mysql-core";

import { timestampColumns } from "./helpers";

/**
 * Reference table for clinical specialties (e.g. "Cardiology", "Orthopedics")
 * — a controlled vocabulary a Facility or a Doctor/Nurse can be associated
 * with, many-to-many, via `FacilitySpecialtyModel`/`UserSpecialtyModel`.
 */
export const SpecialtyModel = mysqlTable(
	"specialties",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		name: varchar("name", { length: 255 }).notNull().unique(),
		description: text("description").notNull(),

		...timestampColumns(),
	},
	(table) => [index("specialties_name_idx").on(table.name)],
);

export type SpecialtyModelInsert = typeof SpecialtyModel.$inferInsert;
export type SpecialtyModelSelect = typeof SpecialtyModel.$inferSelect;

export type SpecialtyModelUniqueWhere = { id: SpecialtyModelSelect["id"] };
