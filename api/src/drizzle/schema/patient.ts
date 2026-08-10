import { sql } from "drizzle-orm";
import {
	date,
	text,
	index,
	varchar,
	mysqlEnum,
	timestamp,
	mysqlTable,
} from "drizzle-orm/mysql-core";

import { GENDER } from "@referral-tracking/shared";

import { UserModel } from "./user";
import { FacilityModel } from "./facility";

export const PatientModel = mysqlTable(
	"patients",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		first_name: varchar("first_name", { length: 100 }).notNull(),
		last_name: varchar("last_name", { length: 100 }).notNull(),
		date_of_birth: date("date_of_birth", { mode: "string" }).notNull(),
		gender: mysqlEnum("gender", GENDER),
		phone: varchar("phone", { length: 20 }),
		address: text("address"),

		creator_id: varchar("creator_id", { length: 36 })
			.notNull()
			.references(() => UserModel.id),

		facility_id: varchar("facility_id", { length: 36 })
			.notNull()
			.references(() => FacilityModel.id),

		created_at: timestamp("created_at").notNull().defaultNow(),
		updated_at: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
	},
	(table) => [
		index("patients_creator_id_idx").on(table.creator_id),
		index("patients_facility_id_idx").on(table.facility_id),
		index("patients_name_idx").on(table.last_name, table.first_name),
	],
);

export type PatientModelInsert = typeof PatientModel.$inferInsert;
export type PatientModelSelect = typeof PatientModel.$inferSelect;

export type PatientModelUniqueWhere = { id: PatientModelSelect["id"] };
