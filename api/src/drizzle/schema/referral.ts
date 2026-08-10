import { sql } from "drizzle-orm";
import {
	text,
	index,
	varchar,
	mysqlEnum,
	timestamp,
	mysqlTable,
} from "drizzle-orm/mysql-core";

import { PRIORITY, REFERRAL_STATUS } from "@referral-tracking/shared";

import { UserModel } from "./user";
import { PatientModel } from "./patient";
import { FacilityModel } from "./facility";

export const ReferralModel = mysqlTable(
	"referrals",
	{
		id: varchar("id", { length: 36 }).primaryKey(),

		patient_id: varchar("patient_id", { length: 36 })
			.notNull()
			.references(() => PatientModel.id),

		origin_facility_id: varchar("origin_facility_id", { length: 36 })
			.notNull()
			.references(() => FacilityModel.id),
		destination_facility_id: varchar("destination_facility_id", {
			length: 36,
		})
			.notNull()
			.references(() => FacilityModel.id),
		visit_reason: text("visit_reason").notNull(),
		referral_reason: text("referral_reason").notNull(),

		priority: mysqlEnum("priority", PRIORITY)
			.default(PRIORITY.MEDIUM)
			.notNull(),
		status: mysqlEnum("status", REFERRAL_STATUS)
			.default(REFERRAL_STATUS.PENDING)
			.notNull(),

		referrer_id: varchar("referrer_id", { length: 36 })
			.notNull()
			.references(() => UserModel.id),
		doctor: varchar("doctor", { length: 36 }).references(() => UserModel.id),

		created_at: timestamp("created_at").notNull().defaultNow(),
		updated_at: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
	},
	(table) => [
		index("referrals_patient_idx").on(table.patient_id),
		index("referrals_status_idx").on(table.status),
		index("referrals_referrer_id_idx").on(table.referrer_id),
		index("referrals_doctor_idx").on(table.doctor),
		index("referrals_origin_facility_idx").on(table.origin_facility_id),
		index("referrals_destination_facility_idx").on(
			table.destination_facility_id,
		),
	],
);

export type ReferralModelInsert = typeof ReferralModel.$inferInsert;
export type ReferralModelSelect = typeof ReferralModel.$inferSelect;

export type ReferralModelUniqueWhere = { id: ReferralModelSelect["id"] };
