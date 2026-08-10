import {
	text,
	index,
	varchar,
	mysqlEnum,
	timestamp,
	mysqlTable,
} from "drizzle-orm/mysql-core";

import { TIMELINE_TYPE, TIMELINE_ACTION } from "@referral-tracking/shared";

import { UserModel } from "./user";

/**
 * Generalized append-only audit log — covers User, Facility, and Referral
 * status/moderation history in one shared shape. `type` says which table
 * `entity` points at; `entity` is deliberately not a real foreign key —
 * a polymorphic column can't be DB-enforced against more than one table.
 * `changer_id` stays a real FK since it always points at exactly one
 * type, a person. `previous`/`next` are both nullable since
 * `APPEAL_SUBMITTED`/`APPEAL_DENIED` don't represent a value transition.
 */
export const TimelineModel = mysqlTable(
	"timeline",
	{
		id: varchar("id", { length: 36 }).primaryKey(),

		type: mysqlEnum("type", TIMELINE_TYPE).notNull(),
		entity: varchar("entity", { length: 36 }).notNull(),
		action: mysqlEnum("action", TIMELINE_ACTION).notNull(),

		previous: varchar("previous", { length: 50 }),
		next: varchar("next", { length: 50 }),

		changer_id: varchar("changer_id", { length: 36 })
			.notNull()
			.references(() => UserModel.id),

		notes: text("notes"),

		changed_at: timestamp("changed_at").notNull().defaultNow(),
	},
	(table) => [
		index("timeline_type_entity_idx").on(table.type, table.entity),
		index("timeline_changed_at_idx").on(table.changed_at),
	],
);

export type TimelineModelInsert = typeof TimelineModel.$inferInsert;
export type TimelineModelSelect = typeof TimelineModel.$inferSelect;

export type TimelineModelUniqueWhere = { id: TimelineModelSelect["id"] };
