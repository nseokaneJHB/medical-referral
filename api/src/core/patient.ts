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
} from "./helpers";

/**
 * Relations available on `PatientModel` for use with `one()`'s `include`
 * and `_count` options — i.e. what can be eagerly loaded or counted
 * alongside a patient record.
 */
interface PatientRelations {
	creator: schema.UserModelSelect;
	facility: schema.FacilityModelSelect;
	referrals: schema.ReferralModelSelect;
}

/**
 * Repository for the `patients` table. Thin wrapper around the shared
 * generic CRUD helpers (`oneRecord`, `manyRecords`, `updateRecords`,
 * `deleteRecords`), pre-bound to `schema.PatientModel` and this model's
 * relation/count configs.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Patient {
	private readonly countConfigs = {
		creator: {
			foreignKey: "id",
			table: schema.UserModel,
			references: "creator_id",
		},
		facility: {
			foreignKey: "id",
			table: schema.FacilityModel,
			references: "facility_id",
		},
		referrals: {
			foreignKey: "patient_id",
			table: schema.ReferralModel,
			references: "id",
		},
	};

	private readonly relationConfigs = {
		creator: { ...this.countConfigs.creator, type: "one" as const },
		facility: { ...this.countConfigs.facility, type: "one" as const },
		referrals: { ...this.countConfigs.referrals, type: "many" as const },
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find multiple `patients` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the query.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <
		TSelect extends keyof schema.PatientModelSelect,
		TOptions extends FindAllOptions<
			schema.PatientModelSelect,
			PatientRelations
		>,
	>(
		options: TOptions,
	): Promise<
		Pagination<WithCount<Pick<schema.PatientModelSelect, TSelect>, TOptions>>
	> => {
		return (await manyRecords(
			this.executor,
			schema.PatientModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		)) as unknown as Pagination<
			WithCount<Pick<schema.PatientModelSelect, TSelect>, TOptions>
		>;
	};

	/**
	 * Find a single `patients` row by a unique `where` condition, optionally
	 * eager-loading relations (`include`) and/or relation counts (`_count`).
	 *
	 * @param options - `where`/`select` (required) plus optional `include`/`_count`.
	 * @returns The matching patient (with requested relations/counts attached), or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <
		TSelect extends keyof schema.PatientModelSelect,
		TOptions extends FindUniqueOptions<
			schema.PatientModelSelect,
			PatientRelations
		>,
	>(
		options: TOptions,
	): Promise<WithCount<
		Pick<schema.PatientModelSelect, TSelect>,
		TOptions
	> | null> => {
		const result = await oneRecord(
			this.executor,
			schema.PatientModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		);

		return result as WithCount<
			Pick<schema.PatientModelSelect, TSelect>,
			TOptions
		> | null;
	};

	/**
	 * `COUNT(*)` of `patients` rows matching `where` (or the whole table if
	 * omitted) — for dashboard-style totals that don't need rows back. Pass
	 * `groupBy` (any column name) for a `COUNT(*) ... GROUP BY` breakdown
	 * instead of a flat total.
	 *
	 * @param where - Optional filter, same shape as `many()`'s.
	 * @param groupBy - Optional column to group by.
	 * @returns A flat count, or one count per distinct `groupBy` value.
	 */
	count = async <
		TGroupBy extends keyof schema.PatientModelSelect & string = never,
	>(
		where?: WhereClause<schema.PatientModelSelect>,
		groupBy?: TGroupBy,
	): Promise<CountResult<TGroupBy>> => {
		return await countRecords(
			this.executor,
			schema.PatientModel,
			where,
			groupBy,
		);
	};

	/**
	 * Create a new `patients` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only), or `null` if the insert returned nothing.
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.PatientModelSelect>(
		options: CreateOptions<
			schema.PatientModelInsert,
			schema.PatientModelSelect
		>,
	): Promise<Pick<schema.PatientModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.PatientModel, options);
	};

	/**
	 * Update the `patients` row(s) matching `where`, stamping `updated` to now.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.PatientModelSelect>(
		options: UpdateOptions<
			schema.PatientModelInsert,
			schema.PatientModelSelect
		>,
	): Promise<Pick<schema.PatientModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.PatientModel, options);
	};

	/**
	 * Delete the `patients` row(s) matching `where`.
	 *
	 * @param options - `where`/`select` for the delete.
	 * @returns The deleted row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	delete = async <TSelect extends keyof schema.PatientModelSelect>(
		options: DeleteOptions<schema.PatientModelSelect>,
	): Promise<Pick<schema.PatientModelSelect, TSelect>[]> => {
		return await deleteRecords(this.executor, schema.PatientModel, options);
	};
}
