import {
	index,
	boolean,
	varchar,
	timestamp,
	mysqlEnum,
	mysqlTable,
	uniqueIndex,
} from "drizzle-orm/mysql-core";

import { ROLES, USER_STATUS } from "@referral-tracking/shared";

import { FacilityModel } from "./facility";
import { timestampColumns } from "./helpers";

export const UserModel = mysqlTable(
	"user",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		name: varchar("name", { length: 255 }),
		email: varchar("email", { length: 255 }).unique().notNull(),
		verified: boolean("verified").default(false).notNull(),
		image: varchar("image", { length: 255 }),

		role: mysqlEnum("role", ROLES).default(ROLES.NURSE).notNull(),
		/**
		 * Matches better-auth's `additionalFields.status.defaultValue`
		 * (`lib/auth.ts`) — kept in sync so any row created outside that path
		 * still defaults to the safe, non-active state.
		 */
		status: mysqlEnum("status", USER_STATUS)
			.default(USER_STATUS.PENDING)
			.notNull(),
		/**
		 * Set on admin-created accounts and `bootstrap-admin.ts`-generated
		 * passwords. Surfaced via `GET /account/status`; not yet enforced —
		 * no self-service password-change endpoint exists this pass.
		 */
		must_change_password: boolean("must_change_password")
			.default(false)
			.notNull(),

		/** null means never accepted, or the NDA text has since been bumped past what they signed. */
		nda_accepted_version: varchar("nda_accepted_version", { length: 32 }),
		nda_accepted_at: timestamp("nda_accepted_at"),

		/** Mirrors better-auth's own twoFactorEnabled field, remapped via twoFactor()'s schema option in lib/auth.ts. */
		two_factor_enabled: boolean("two_factor_enabled").default(false).notNull(),

		facility_id: varchar("facility_id", { length: 36 }).references(
			() => FacilityModel.id,
		),

		...timestampColumns(),
	},
	(table) => [
		index("user_role_idx").on(table.role),
		index("user_updated_at_idx").on(table.updated_at),
		index("user_facility_id_idx").on(table.facility_id),

		uniqueIndex("user_email_uq_idx").on(table.email),
	],
);

export type UserModelInsert = typeof UserModel.$inferInsert;
export type UserModelSelect = typeof UserModel.$inferSelect;

export type UserModelUniqueWhere =
	| { id: UserModelSelect["id"] }
	| { email: UserModelSelect["email"] };
