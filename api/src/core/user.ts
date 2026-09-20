import * as schema from "../drizzle/schema";

import {
	oneRecord,
	manyRecords,
	countRecords,
	createRecords,
	updateRecords,
	deleteRecords,
	type Executor,
	type Pagination,
	type WhereClause,
	type CountResult,
	type CreateOptions,
	type UpdateOptions,
	type DeleteOptions,
	type FindAllOptions,
	type FindUniqueOptions,
	type WithCount,
	type WithRelations,
} from "./helpers";

/**
 * Relations available on `UserModel` for use with `one()`'s `include` and
 * `_count` options — i.e. what can be eagerly loaded or counted alongside
 * a user record.
 */
interface UserRelations {
	sessions: schema.SessionModelSelect[];
	accounts: schema.AccountModelSelect[];
	facility: schema.FacilityModelSelect;
}

/**
 * Repository for the `user` table. Thin wrapper around the shared generic
 * CRUD helpers (`oneRecord`, `manyRecords`, `updateRecords`, `deleteRecords`),
 * pre-bound to `schema.UserModel` and this model's relation/count configs.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class User {
	/**
	 * Foreign-key configuration for `_count` aggregation — a subset of
	 * `relationConfigs` (no `type`, since counts don't distinguish
	 * "one" vs "many").
	 */
	private readonly countConfigs = {
		sessions: {
			foreignKey: "user_id",
			table: schema.SessionModel,
			references: "id",
		},
		accounts: {
			foreignKey: "user_id",
			table: schema.AccountModel,
			references: "id",
		},
		facility: {
			foreignKey: "id",
			table: schema.FacilityModel,
			references: "facility_id",
		},
	};

	/**
	 * Foreign-key configuration for `include` (eager-loading relations),
	 * built from `countConfigs` plus each relation's cardinality.
	 */
	private readonly relationConfigs = {
		sessions: { ...this.countConfigs.sessions, type: "many" as const },
		accounts: { ...this.countConfigs.accounts, type: "many" as const },
		facility: { ...this.countConfigs.facility, type: "one" as const },
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * `COUNT(*)` of `user` rows matching `where` (or the whole table if
	 * omitted) — for dashboard-style totals that don't need rows back.
	 * Pass `groupBy` (any column name) for a `COUNT(*) ... GROUP BY`
	 * breakdown instead of a flat total — e.g. `count(where, "role")`.
	 *
	 * @param where - Optional filter, same shape as `many()`'s.
	 * @param groupBy - Optional column to group by.
	 * @returns A flat count, or one count per distinct `groupBy` value.
	 */
	count = async <
		TGroupBy extends keyof schema.UserModelSelect & string = never,
	>(
		where?: WhereClause<schema.UserModelSelect>,
		groupBy?: TGroupBy,
	): Promise<CountResult<TGroupBy>> => {
		return await countRecords(this.executor, schema.UserModel, where, groupBy);
	};

	/**
	 * Find multiple `user` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the query.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <
		TSelect extends keyof schema.UserModelSelect,
		TOptions extends FindAllOptions<schema.UserModelSelect, UserRelations>,
	>(
		options: TOptions,
	): Promise<
		Pagination<
			WithRelations<
				WithCount<Pick<schema.UserModelSelect, TSelect>, TOptions>,
				TOptions,
				UserRelations
			>
		>
	> => {
		return (await manyRecords(
			this.executor,
			schema.UserModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		)) as unknown as Pagination<
			WithRelations<
				WithCount<Pick<schema.UserModelSelect, TSelect>, TOptions>,
				TOptions,
				UserRelations
			>
		>;
	};

	/**
	 * Find a single `user` row by a unique `where` condition, optionally
	 * eager-loading relations (`include`) and/or relation counts (`_count`).
	 *
	 * @param options - `where`/`select` (required) plus optional `include`/`_count`.
	 * @returns The matching user (with requested relations/counts attached), or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <
		TSelect extends keyof schema.UserModelSelect,
		TOptions extends FindUniqueOptions<schema.UserModelSelect, UserRelations>,
	>(
		options: TOptions,
	): Promise<WithRelations<
		WithCount<Pick<schema.UserModelSelect, TSelect>, TOptions>,
		TOptions,
		UserRelations
	> | null> => {
		const result = await oneRecord(
			this.executor,
			schema.UserModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		);

		return result as WithRelations<
			WithCount<Pick<schema.UserModelSelect, TSelect>, TOptions>,
			TOptions,
			UserRelations
		> | null;
	};

	/**
	 * Create a new `user` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only), or `null` if the insert returned nothing.
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.UserModelSelect>(
		options: CreateOptions<schema.UserModelInsert, schema.UserModelSelect>,
	): Promise<Pick<schema.UserModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.UserModel, options);
	};

	/**
	 * Update the `user` row(s) matching `where`, stamping `updated` to now.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.UserModelSelect>(
		options: UpdateOptions<schema.UserModelInsert, schema.UserModelSelect>,
	): Promise<Pick<schema.UserModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.UserModel, options);
	};

	/**
	 * Delete the `user` row(s) matching `where`.
	 *
	 * @param options - `where`/`select` for the delete.
	 * @returns The deleted row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	delete = async <TSelect extends keyof schema.UserModelSelect>(
		options: DeleteOptions<schema.UserModelSelect>,
	): Promise<Pick<schema.UserModelSelect, TSelect>[]> => {
		return await deleteRecords(this.executor, schema.UserModel, options);
	};
}
