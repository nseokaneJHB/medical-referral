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
	type CountResult,
	type CountOptions,
	type CreateOptions,
	type UpdateOptions,
	type DeleteOptions,
	type FindAllOptions,
	type FindUniqueOptions,
	type WithCount,
	type WithRelations,
} from "./helpers";

/** Relations available on `UserModel` for `userOne`/`userMany`'s `include` and `_count` options. */
interface UserRelations {
	sessions: schema.SessionModelSelect[];
	accounts: schema.AccountModelSelect[];
	facility: schema.FacilityModelSelect;
}

const countConfigs = {
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

const relationConfigs = {
	sessions: { ...countConfigs.sessions, type: "many" as const },
	accounts: { ...countConfigs.accounts, type: "many" as const },
	facility: { ...countConfigs.facility, type: "one" as const },
};

/** `COUNT(*)` of `user` rows matching `options.where`, or a per-`groupBy`-value breakdown. */
export const userCount = async <
	TGroupBy extends keyof schema.UserModelSelect & string = never,
>(
	database: Executor,
	options?: CountOptions<schema.UserModelSelect, TGroupBy>,
): Promise<CountResult<TGroupBy>> => {
	return await countRecords(
		database,
		schema.UserModel,
		options?.where,
		options?.groupBy,
	);
};

/** Finds multiple `user` rows with pagination, filtering, ordering, and optional relation eager-loading/counts. */
export const userMany = async <
	TSelect extends keyof schema.UserModelSelect,
	TOptions extends FindAllOptions<schema.UserModelSelect, UserRelations>,
>(
	database: Executor,
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
		database,
		schema.UserModel,
		options,
		relationConfigs,
		countConfigs,
	)) as unknown as Pagination<
		WithRelations<
			WithCount<Pick<schema.UserModelSelect, TSelect>, TOptions>,
			TOptions,
			UserRelations
		>
	>;
};

/** Finds a single `user` row by a unique `where` condition, optionally eager-loading relations (`include`) and/or relation counts (`_count`). */
export const userOne = async <
	TSelect extends keyof schema.UserModelSelect,
	TOptions extends FindUniqueOptions<schema.UserModelSelect, UserRelations>,
>(
	database: Executor,
	options: TOptions,
): Promise<WithRelations<
	WithCount<Pick<schema.UserModelSelect, TSelect>, TOptions>,
	TOptions,
	UserRelations
> | null> => {
	const result = await oneRecord(
		database,
		schema.UserModel,
		options,
		relationConfigs,
		countConfigs,
	);

	return result as WithRelations<
		WithCount<Pick<schema.UserModelSelect, TSelect>, TOptions>,
		TOptions,
		UserRelations
	> | null;
};

/** Creates a new `user` row. */
export const userCreate = async <TSelect extends keyof schema.UserModelSelect>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.UserModelInsert, schema.UserModelSelect>,
		"data"
	>,
	payload: CreateOptions<schema.UserModelInsert, schema.UserModelSelect>["data"],
): Promise<Pick<schema.UserModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.UserModel, {
		...options,
		data: payload,
	});
};

/** Updates the `user` row(s) matching `options.where`, stamping `updated_at` to now. */
export const userUpdate = async <TSelect extends keyof schema.UserModelSelect>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.UserModelInsert, schema.UserModelSelect>,
		"data"
	>,
	payload: UpdateOptions<schema.UserModelInsert, schema.UserModelSelect>["data"],
): Promise<Pick<schema.UserModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.UserModel, {
		...options,
		data: payload,
	});
};

/** Deletes the `user` row(s) matching `options.where`. */
export const userDelete = async <TSelect extends keyof schema.UserModelSelect>(
	database: Executor,
	options: DeleteOptions<schema.UserModelSelect>,
): Promise<Pick<schema.UserModelSelect, TSelect>[]> => {
	return await deleteRecords(database, schema.UserModel, options);
};
