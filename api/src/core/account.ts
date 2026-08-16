import * as schema from "../drizzle/schema";

import {
	oneRecord,
	updateRecords,
	type Executor,
	type UpdateOptions,
	type FindUniqueOptions,
} from "./helpers";

/**
 * Repository for the `account` table (better-auth's credential storage —
 * one row per user for the email/password provider this app uses). Thin
 * wrapper around the shared generic CRUD helpers (`oneRecord`,
 * `updateRecords`), pre-bound to `schema.AccountModel`.
 *
 * Only `one`/`update` exist — nothing yet needs to list, create, or delete
 * account rows directly (creation goes through `auth.api.signUpEmail`).
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Account {
	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find a single `account` row by a unique `where` condition.
	 *
	 * @param options - `where`/`select` (required).
	 * @returns The matching account (selected fields only), or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <TSelect extends keyof schema.AccountModelSelect>(
		options: FindUniqueOptions<schema.AccountModelSelect>,
	): Promise<Pick<schema.AccountModelSelect, TSelect> | null> => {
		const result = await oneRecord(this.executor, schema.AccountModel, options);

		return result as unknown as Pick<schema.AccountModelSelect, TSelect> | null;
	};

	/**
	 * Update the `account` row(s) matching `where`, stamping `updated_at` to now.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.AccountModelSelect>(
		options: UpdateOptions<
			schema.AccountModelInsert,
			schema.AccountModelSelect
		>,
	): Promise<Pick<schema.AccountModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.AccountModel, options);
	};
}
