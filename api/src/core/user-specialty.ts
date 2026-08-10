import * as schema from "../drizzle/schema";

import {
	manyRecords,
	createRecords,
	deleteRecords,
	type Executor,
	type Pagination,
	type CreateOptions,
	type DeleteOptions,
	type FindAllOptions,
} from "./helpers";

interface UserSpecialtyRelations {
	user: schema.UserModelSelect;
	specialty: schema.SpecialtyModelSelect;
}

/**
 * Repository for the `user_specialties` link table (a Doctor or Nurse can
 * have multiple specialties). No `update` — a link either exists or
 * doesn't; unlinking is a `delete`.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class UserSpecialty {
	private readonly countConfigs = {
		user: {
			foreignKey: "id",
			table: schema.UserModel,
			references: "user_id",
		},
		specialty: {
			foreignKey: "id",
			table: schema.SpecialtyModel,
			references: "specialty_id",
		},
	};

	private readonly relationConfigs = {
		user: { ...this.countConfigs.user, type: "one" as const },
		specialty: { ...this.countConfigs.specialty, type: "one" as const },
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	many = async <
		TSelect extends keyof schema.UserSpecialtyModelSelect,
		TOptions extends FindAllOptions<
			schema.UserSpecialtyModelSelect,
			UserSpecialtyRelations
		>,
	>(
		options: TOptions,
	): Promise<Pagination<Pick<schema.UserSpecialtyModelSelect, TSelect>>> => {
		return (await manyRecords(
			this.executor,
			schema.UserSpecialtyModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		)) as unknown as Pagination<Pick<schema.UserSpecialtyModelSelect, TSelect>>;
	};

	create = async <TSelect extends keyof schema.UserSpecialtyModelSelect>(
		options: CreateOptions<
			schema.UserSpecialtyModelInsert,
			schema.UserSpecialtyModelSelect
		>,
	): Promise<Pick<schema.UserSpecialtyModelSelect, TSelect>[]> => {
		return await createRecords(
			this.executor,
			schema.UserSpecialtyModel,
			options,
		);
	};

	delete = async <TSelect extends keyof schema.UserSpecialtyModelSelect>(
		options: DeleteOptions<schema.UserSpecialtyModelSelect>,
	): Promise<Pick<schema.UserSpecialtyModelSelect, TSelect>[]> => {
		return await deleteRecords(
			this.executor,
			schema.UserSpecialtyModel,
			options,
		);
	};
}
