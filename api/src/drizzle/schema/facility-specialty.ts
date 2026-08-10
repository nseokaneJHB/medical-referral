import {
	timestamp,
	varchar,
	mysqlTable,
	uniqueIndex,
} from "drizzle-orm/mysql-core";

import { FacilityModel } from "./facility";
import { SpecialtyModel } from "./specialty";

/** Many-to-many link — a facility can have multiple specialties. */
export const FacilitySpecialtyModel = mysqlTable(
	"facility_specialties",
	{
		id: varchar("id", { length: 36 }).primaryKey(),

		facility_id: varchar("facility_id", { length: 36 })
			.notNull()
			.references(() => FacilityModel.id),
		specialty_id: varchar("specialty_id", { length: 36 })
			.notNull()
			.references(() => SpecialtyModel.id),

		created_at: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("facility_specialties_uq_idx").on(
			table.facility_id,
			table.specialty_id,
		),
	],
);

export type FacilitySpecialtyModelInsert =
	typeof FacilitySpecialtyModel.$inferInsert;
export type FacilitySpecialtyModelSelect =
	typeof FacilitySpecialtyModel.$inferSelect;

export type FacilitySpecialtyModelUniqueWhere = {
	id: FacilitySpecialtyModelSelect["id"];
};
