import { varchar, mysqlTable, uniqueIndex } from "drizzle-orm/mysql-core";

import { ReferralModel } from "./referral";
import { SpecialtyModel } from "./specialty";
import { createdAtColumn } from "./helpers";

/** Many-to-many link — a referral can need multiple specialties. */
export const ReferralSpecialtyModel = mysqlTable(
	"referral_specialties",
	{
		id: varchar("id", { length: 36 }).primaryKey(),

		referral_id: varchar("referral_id", { length: 36 })
			.notNull()
			.references(() => ReferralModel.id),
		specialty_id: varchar("specialty_id", { length: 36 })
			.notNull()
			.references(() => SpecialtyModel.id),

		...createdAtColumn(),
	},
	(table) => [
		uniqueIndex("referral_specialties_uq_idx").on(
			table.referral_id,
			table.specialty_id,
		),
	],
);

export type ReferralSpecialtyModelInsert =
	typeof ReferralSpecialtyModel.$inferInsert;
export type ReferralSpecialtyModelSelect =
	typeof ReferralSpecialtyModel.$inferSelect;

export type ReferralSpecialtyModelUniqueWhere = {
	id: ReferralSpecialtyModelSelect["id"];
};
