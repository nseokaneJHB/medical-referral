import * as schema from "../drizzle/schema";

import {
	oneRecord,
	manyRecords,
	createRecords,
	updateRecords,
	type Executor,
	type Pagination,
	type CreateOptions,
	type UpdateOptions,
	type FindAllOptions,
	type FindUniqueOptions,
} from "./helpers";

/**
 * Repository for the `facilities` table. No `delete` — removing a facility
 * already referenced by users/patients/referrals is a separate design
 * problem (reassignment or soft-delete) left out of this iteration.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Facility {
	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find multiple `facilities` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the query.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <
		TSelect extends keyof schema.FacilityModelSelect,
		TOptions extends FindAllOptions<schema.FacilityModelSelect, object>,
	>(
		options: TOptions,
	): Promise<Pagination<Pick<schema.FacilityModelSelect, TSelect>>> => {
		return (await manyRecords(
			this.executor,
			schema.FacilityModel,
			options,
		)) as unknown as Pagination<Pick<schema.FacilityModelSelect, TSelect>>;
	};

	/**
	 * Find a single `facilities` row by a unique `where` condition.
	 *
	 * @param options - `where`/`select` for the query.
	 * @returns The matching facility, or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <
		TSelect extends keyof schema.FacilityModelSelect,
		TOptions extends FindUniqueOptions<schema.FacilityModelSelect, object>,
	>(
		options: TOptions,
	): Promise<Pick<schema.FacilityModelSelect, TSelect> | null> => {
		return (await oneRecord(
			this.executor,
			schema.FacilityModel,
			options,
		)) as Pick<schema.FacilityModelSelect, TSelect> | null;
	};

	/**
	 * Create a new `facilities` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only).
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.FacilityModelSelect>(
		options: CreateOptions<
			schema.FacilityModelInsert,
			schema.FacilityModelSelect
		>,
	): Promise<Pick<schema.FacilityModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.FacilityModel, options);
	};

	/**
	 * Update the `facilities` row(s) matching `where`, stamping `updated` to now.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only).
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.FacilityModelSelect>(
		options: UpdateOptions<
			schema.FacilityModelInsert,
			schema.FacilityModelSelect
		>,
	): Promise<Pick<schema.FacilityModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.FacilityModel, options);
	};
}
