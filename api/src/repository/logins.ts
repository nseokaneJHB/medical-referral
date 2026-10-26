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
	type WithCount,
	type WithRelations,
} from "./helpers";

interface LoginsRelations {
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

/** Finds multiple `logins` rows with pagination, filtering, and ordering. */
export const loginsMany = async <
	TSelect extends keyof schema.LoginsModelSelect,
	TOptions extends FindAllOptions<schema.LoginsModelSelect, LoginsRelations>,
>(
	database: Executor,
	options: TOptions,
): Promise<
	Pagination<
		WithRelations<
			WithCount<Pick<schema.LoginsModelSelect, TSelect>, TOptions>,
			TOptions,
			LoginsRelations
		>
	>
> => {
	return (await manyRecords(
		database,
		schema.LoginsModel,
		options,
		relationConfigs,
		countConfigs,
	)) as unknown as Pagination<
		WithRelations<
			WithCount<Pick<schema.LoginsModelSelect, TSelect>, TOptions>,
			TOptions,
			LoginsRelations
		>
	>;
};

/** Creates a new `logins` row — written on sign-in; see `modules/authentication/service.ts`. */
export const loginsCreate = async <
	TSelect extends keyof schema.LoginsModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.LoginsModelInsert, schema.LoginsModelSelect>,
		"data"
	>,
	payload: CreateOptions<
		schema.LoginsModelInsert,
		schema.LoginsModelSelect
	>["data"],
): Promise<Pick<schema.LoginsModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.LoginsModel, {
		...options,
		data: payload,
	});
};

/** Updates the `logins` row(s) matching `options.where` — used to stamp `logout` on explicit sign-out. No `delete`; audit rows aren't removable through the app. */
export const loginsUpdate = async <
	TSelect extends keyof schema.LoginsModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.LoginsModelInsert, schema.LoginsModelSelect>,
		"data"
	>,
	payload: UpdateOptions<
		schema.LoginsModelInsert,
		schema.LoginsModelSelect
	>["data"],
): Promise<Pick<schema.LoginsModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.LoginsModel, {
		...options,
		data: payload,
	});
};
