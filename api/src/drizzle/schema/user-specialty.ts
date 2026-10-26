import { varchar, mysqlTable, uniqueIndex } from "drizzle-orm/mysql-core";

import { UserModel } from "./user";
import { SpecialtyModel } from "./specialty";
import { createdAtColumn } from "./helpers";

/**
 * Many-to-many link — a Doctor or Nurse can have multiple specialties.
 * Not restricted to those two roles at the DB level; enforced by whatever
 * assignment endpoint writes here, same as other role-shaped business
 * rules in this codebase.
 */
export const UserSpecialtyModel = mysqlTable(
	"user_specialties",
	{
		id: varchar("id", { length: 36 }).primaryKey(),

		user_id: varchar("user_id", { length: 36 })
			.notNull()
			.references(() => UserModel.id),
		specialty_id: varchar("specialty_id", { length: 36 })
			.notNull()
			.references(() => SpecialtyModel.id),

		...createdAtColumn(),
	},
	(table) => [
		uniqueIndex("user_specialties_uq_idx").on(
			table.user_id,
			table.specialty_id,
		),
	],
);

export type UserSpecialtyModelInsert = typeof UserSpecialtyModel.$inferInsert;
export type UserSpecialtyModelSelect = typeof UserSpecialtyModel.$inferSelect;

export type UserSpecialtyModelUniqueWhere = {
	id: UserSpecialtyModelSelect["id"];
};
