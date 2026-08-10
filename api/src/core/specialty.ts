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
 * Repository for the `specialties` reference table. Thin wrapper around
 * the shared generic CRUD helpers, pre-bound to `schema.SpecialtyModel`.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Specialty {
	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	many = async <
		TSelect extends keyof schema.SpecialtyModelSelect,
		TOptions extends FindAllOptions<schema.SpecialtyModelSelect, object>,
	>(
		options: TOptions,
	): Promise<Pagination<Pick<schema.SpecialtyModelSelect, TSelect>>> => {
		return (await manyRecords(
			this.executor,
			schema.SpecialtyModel,
			options,
		)) as unknown as Pagination<Pick<schema.SpecialtyModelSelect, TSelect>>;
	};

	one = async <
		TSelect extends keyof schema.SpecialtyModelSelect,
		TOptions extends FindUniqueOptions<schema.SpecialtyModelSelect, object>,
	>(
		options: TOptions,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect> | null> => {
		return (await oneRecord(
			this.executor,
			schema.SpecialtyModel,
			options,
		)) as Pick<schema.SpecialtyModelSelect, TSelect> | null;
	};

	create = async <TSelect extends keyof schema.SpecialtyModelSelect>(
		options: CreateOptions<
			schema.SpecialtyModelInsert,
			schema.SpecialtyModelSelect
		>,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.SpecialtyModel, options);
	};

	update = async <TSelect extends keyof schema.SpecialtyModelSelect>(
		options: UpdateOptions<
			schema.SpecialtyModelInsert,
			schema.SpecialtyModelSelect
		>,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.SpecialtyModel, options);
	};

	delete = async <TSelect extends keyof schema.SpecialtyModelSelect>(
		options: DeleteOptions<schema.SpecialtyModelSelect>,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
		return await deleteRecords(this.executor, schema.SpecialtyModel, options);
	};
}
