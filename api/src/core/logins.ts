import * as schema from "../drizzle/schema";

import {
	manyRecords,
	createRecords,
	updateRecords,
	type Executor,
	type Pagination,
	type CreateOptions,
	type UpdateOptions,
	type FindAllOptions,
} from "./helpers";

interface LoginsRelations {
	user: schema.UserModelSelect;
}

/**
 * Repository for the `logins` table. Written to on sign-in (create) and
 * sign-out (update, to stamp `logout`) — see
 * modules/authentication/service.ts. No `delete`; audit rows aren't meant
 * to be removable through the app.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Logins {
	private readonly countConfigs = {
		user: {
			foreignKey: "id",
			table: schema.UserModel,
			references: "user_id",
		},
	};

	private readonly relationConfigs = {
		user: { ...this.countConfigs.user, type: "one" as const },
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find multiple `logins` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the query.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <
		TSelect extends keyof schema.LoginsModelSelect,
		TOptions extends FindAllOptions<schema.LoginsModelSelect, LoginsRelations>,
	>(
		options: TOptions,
	): Promise<Pagination<Pick<schema.LoginsModelSelect, TSelect>>> => {
		return (await manyRecords(
			this.executor,
			schema.LoginsModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		)) as unknown as Pagination<Pick<schema.LoginsModelSelect, TSelect>>;
	};

	/**
	 * Create a new `logins` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only).
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.LoginsModelSelect>(
		options: CreateOptions<schema.LoginsModelInsert, schema.LoginsModelSelect>,
	): Promise<Pick<schema.LoginsModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.LoginsModel, options);
	};

	/**
	 * Update the `logins` row(s) matching `where` — used to stamp `logout`
	 * on explicit sign-out.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only).
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.LoginsModelSelect>(
		options: UpdateOptions<schema.LoginsModelInsert, schema.LoginsModelSelect>,
	): Promise<Pick<schema.LoginsModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.LoginsModel, options);
	};
}
