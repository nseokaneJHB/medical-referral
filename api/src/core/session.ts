import * as schema from "../drizzle/schema";

import {
	oneRecord,
	manyRecords,
	createRecords,
	updateRecords,
	deleteRecords,
	type Executor,
	type Pagination,
	type CreateOptions,
	type UpdateOptions,
	type DeleteOptions,
	type FindAllOptions,
	type FindUniqueOptions,
	type WithCount,
	type WithRelations,
} from "./helpers";

/**
 * Relations available on `SessionModel` for use with `one()`'s `include` and
 * `_count` options — i.e. what can be eagerly loaded or counted alongside
 * a session record.
 */
interface SessionRelations {
	user: schema.UserModelSelect;
}

/**
 * Repository for the `session` table. Thin wrapper around the shared generic
 * CRUD helpers (`oneRecord`, `manyRecords`, `updateRecords`, `deleteRecords`),
 * pre-bound to `schema.SessionModel` and this model's relation configs.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Session {
	/**
	 * Foreign-key configuration for `_count` aggregation — a subset of
	 * `relationConfigs` (no `type`, since counts don't distinguish
	 * "one" vs "many").
	 */
	private readonly countConfigs = {
		user: {
			foreignKey: "id",
			table: schema.UserModel,
			references: "user_id",
		},
	};

	/**
	 * Foreign-key configuration for `include` (eager-loading relations),
	 * built from `countConfigs` plus each relation's cardinality.
	 */
	private readonly relationConfigs = {
		user: { ...this.countConfigs.user, type: "one" as const },
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find multiple `session` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the query.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <
		TSelect extends keyof schema.SessionModelSelect,
		TOptions extends FindAllOptions<
			schema.SessionModelSelect,
			SessionRelations
		>,
	>(
		options: TOptions,
	): Promise<
		Pagination<WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>>
	> => {
		return (await manyRecords(
			this.executor,
			schema.SessionModel,
			options,
		)) as unknown as Pagination<
			WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>
		>;
	};

	/**
	 * Find a single `session` row by a unique `where` condition, optionally
	 * eager-loading relations (`include`) and/or relation counts (`_count`).
	 *
	 * @param options - `where`/`select` (required) plus optional `include`/`_count`.
	 * @returns The matching session (with requested relations/counts attached), or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <
		TSelect extends keyof schema.SessionModelSelect,
		TOptions extends FindUniqueOptions<
			schema.SessionModelSelect,
			SessionRelations
		>,
	>(
		options: TOptions,
	): Promise<WithRelations<
		WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>,
		TOptions,
		SessionRelations
	> | null> => {
		const result = await oneRecord(
			this.executor,
			schema.SessionModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		);

		return result as WithRelations<
			WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>,
			TOptions,
			SessionRelations
		> | null;
	};

	/**
	 * Create a new `session` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only), or `null` if the insert returned nothing.
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.SessionModelSelect>(
		options: CreateOptions<
			schema.SessionModelInsert,
			schema.SessionModelSelect
		>,
	): Promise<Pick<schema.SessionModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.SessionModel, options);
	};

	/**
	 * Update the `session` row(s) matching `where`, stamping `updated` to now.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.SessionModelSelect>(
		options: UpdateOptions<
			schema.SessionModelInsert,
			schema.SessionModelSelect
		>,
	): Promise<Pick<schema.SessionModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.SessionModel, options);
	};

	/**
	 * Delete the `session` row(s) matching `where`.
	 *
	 * @param options - `where`/`select` for the delete.
	 * @returns The deleted row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	delete = async <TSelect extends keyof schema.SessionModelSelect>(
		options: DeleteOptions<schema.SessionModelSelect>,
	): Promise<Pick<schema.SessionModelSelect, TSelect>[]> => {
		return await deleteRecords(this.executor, schema.SessionModel, options);
	};
}
