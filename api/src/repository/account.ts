import * as schema from "../drizzle/schema";

import {
	oneRecord,
	updateRecords,
	type Executor,
	type UpdateOptions,
	type FindUniqueOptions,
} from "./helpers";

/** Finds a single `account` row (better-auth's credential storage) by a unique `where` condition. */
export const accountOne = async <
	TSelect extends keyof schema.AccountModelSelect,
>(
	database: Executor,
	options: FindUniqueOptions<schema.AccountModelSelect>,
): Promise<Pick<schema.AccountModelSelect, TSelect> | null> => {
	const result = await oneRecord(database, schema.AccountModel, options);

	return result as unknown as Pick<schema.AccountModelSelect, TSelect> | null;
};

/** Updates the `account` row(s) matching `options.where`, stamping `updated_at` to now. */
export const accountUpdate = async <
	TSelect extends keyof schema.AccountModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.AccountModelInsert, schema.AccountModelSelect>,
		"data"
	>,
	payload: UpdateOptions<
		schema.AccountModelInsert,
		schema.AccountModelSelect
	>["data"],
): Promise<Pick<schema.AccountModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.AccountModel, {
		...options,
		data: payload,
	});
};
