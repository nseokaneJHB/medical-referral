import { sql } from "drizzle-orm";
import { timestamp } from "drizzle-orm/mysql-core";

/** created_at only, for append-only join tables that are never updated in place. */
export const createdAtColumn = () => ({
	created_at: timestamp("created_at").notNull().defaultNow(),
});

/** Standard created_at/updated_at pair used by every mutable table. */
export const timestampColumns = () => ({
	...createdAtColumn(),
	updated_at: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => sql`now()`),
});
