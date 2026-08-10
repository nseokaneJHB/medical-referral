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
} from "./helpers";

/**
 * Repository for the `verification` table. Thin wrapper around the shared generic
 * CRUD helpers (`oneRecord`, `manyRecords`, `updateRecords`, `deleteRecords`),
 * pre-bound to `schema.VerificationModel` and this model's relation/count configs.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Verification {
	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find multiple `verification` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the query.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <TSelect extends keyof schema.VerificationModelSelect>(
		options: FindAllOptions<schema.VerificationModelSelect>,
	): Promise<Pagination<Pick<schema.VerificationModelSelect, TSelect>>> => {
		return await manyRecords(this.executor, schema.VerificationModel, options);
	};

	/**
	 * Find a single `verification` row by a unique `where` condition, optionally
	 * eager-loading relations (`include`) and/or relation counts (`_count`).
	 *
	 * @param options - `where`/`select` (required) plus optional `include`/`_count`.
	 * @returns The matching verification (with requested relations/counts attached), or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <TSelect extends keyof schema.VerificationModelSelect>(
		options: FindUniqueOptions<schema.VerificationModelSelect>,
	): Promise<Pick<schema.VerificationModelSelect, TSelect> | null> => {
		const result = await oneRecord(
			this.executor,
			schema.VerificationModel,
			options,
		);

		return result as unknown as Pick<
			schema.VerificationModelSelect,
			TSelect
		> | null;
	};

	/**
	 * Create a new `verification` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only), or `null` if the insert returned nothing.
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.VerificationModelSelect>(
		options: CreateOptions<
			schema.VerificationModelInsert,
			schema.VerificationModelSelect
		>,
	): Promise<Pick<schema.VerificationModelSelect, TSelect>[]> => {
		return await createRecords(
			this.executor,
			schema.VerificationModel,
			options,
		);
	};

	/**
	 * Update the `verification` row(s) matching `where`, stamping `updated` to now.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.VerificationModelSelect>(
		options: UpdateOptions<
			schema.VerificationModelInsert,
			schema.VerificationModelSelect
		>,
	): Promise<Pick<schema.VerificationModelSelect, TSelect>[]> => {
		return await updateRecords(
			this.executor,
			schema.VerificationModel,
			options,
		);
	};

	/**
	 * Delete the `verification` row(s) matching `where`.
	 *
	 * @param options - `where`/`select` for the delete.
	 * @returns The deleted row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	delete = async <TSelect extends keyof schema.VerificationModelSelect>(
		options: DeleteOptions<schema.VerificationModelSelect>,
	): Promise<Pick<schema.VerificationModelSelect, TSelect>[]> => {
		return await deleteRecords(
			this.executor,
			schema.VerificationModel,
			options,
		);
	};
}
