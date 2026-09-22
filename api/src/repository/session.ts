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

/** Relations available on `SessionModel` (better-auth's own session storage) for `sessionOne`/`sessionMany`'s `include` and `_count` options. */
interface SessionRelations {
	user: schema.UserModelSelect;
}

const countConfigs = {
	user: {
		foreignKey: "id",
		table: schema.UserModel,
		references: "user_id",
	},
};

const relationConfigs = {
	user: { ...countConfigs.user, type: "one" as const },
};

/** Finds multiple `session` rows with pagination, filtering, and ordering. */
export const sessionMany = async <
	TSelect extends keyof schema.SessionModelSelect,
	TOptions extends FindAllOptions<schema.SessionModelSelect, SessionRelations>,
>(
	database: Executor,
	options: TOptions,
): Promise<
	Pagination<WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>>
> => {
	return (await manyRecords(
		database,
		schema.SessionModel,
		options,
	)) as unknown as Pagination<
		WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>
	>;
};

/** Finds a single `session` row by a unique `where` condition, optionally eager-loading relations (`include`) and/or relation counts (`_count`). */
export const sessionOne = async <
	TSelect extends keyof schema.SessionModelSelect,
	TOptions extends FindUniqueOptions<
		schema.SessionModelSelect,
		SessionRelations
	>,
>(
	database: Executor,
	options: TOptions,
): Promise<WithRelations<
	WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>,
	TOptions,
	SessionRelations
> | null> => {
	const result = await oneRecord(
		database,
		schema.SessionModel,
		options,
		relationConfigs,
		countConfigs,
	);

	return result as WithRelations<
		WithCount<Pick<schema.SessionModelSelect, TSelect>, TOptions>,
		TOptions,
		SessionRelations
	> | null;
};

/** Creates a new `session` row. */
export const sessionCreate = async <
	TSelect extends keyof schema.SessionModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.SessionModelInsert, schema.SessionModelSelect>,
		"data"
	>,
	payload: CreateOptions<
		schema.SessionModelInsert,
		schema.SessionModelSelect
	>["data"],
): Promise<Pick<schema.SessionModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.SessionModel, {
		...options,
		data: payload,
	});
};

/** Updates the `session` row(s) matching `options.where`, stamping `updated_at` to now. */
export const sessionUpdate = async <
	TSelect extends keyof schema.SessionModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.SessionModelInsert, schema.SessionModelSelect>,
		"data"
	>,
	payload: UpdateOptions<
		schema.SessionModelInsert,
		schema.SessionModelSelect
	>["data"],
): Promise<Pick<schema.SessionModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.SessionModel, {
		...options,
		data: payload,
	});
};

/** Deletes the `session` row(s) matching `options.where`. */
export const sessionDelete = async <
	TSelect extends keyof schema.SessionModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.SessionModelSelect>,
): Promise<Pick<schema.SessionModelSelect, TSelect>[]> => {
	return await deleteRecords(database, schema.SessionModel, options);
};
