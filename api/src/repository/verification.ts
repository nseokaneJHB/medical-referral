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

/** Finds multiple `verification` rows with pagination, filtering, and ordering. */
export const verificationMany = async <
	TSelect extends keyof schema.VerificationModelSelect,
>(
	database: Executor,
	options: FindAllOptions<schema.VerificationModelSelect>,
): Promise<Pagination<Pick<schema.VerificationModelSelect, TSelect>>> => {
	return await manyRecords(database, schema.VerificationModel, options);
};

/** Finds a single `verification` row by a unique `where` condition. */
export const verificationOne = async <
	TSelect extends keyof schema.VerificationModelSelect,
>(
	database: Executor,
	options: FindUniqueOptions<schema.VerificationModelSelect>,
): Promise<Pick<schema.VerificationModelSelect, TSelect> | null> => {
	const result = await oneRecord(database, schema.VerificationModel, options);

	return result as unknown as Pick<
		schema.VerificationModelSelect,
		TSelect
	> | null;
};

/** Creates a new `verification` row. */
export const verificationCreate = async <
	TSelect extends keyof schema.VerificationModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<
			schema.VerificationModelInsert,
			schema.VerificationModelSelect
		>,
		"data"
	>,
	payload: CreateOptions<
		schema.VerificationModelInsert,
		schema.VerificationModelSelect
	>["data"],
): Promise<Pick<schema.VerificationModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.VerificationModel, {
		...options,
		data: payload,
	});
};

/** Updates the `verification` row(s) matching `options.where`, stamping `updated_at` to now. */
export const verificationUpdate = async <
	TSelect extends keyof schema.VerificationModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<
			schema.VerificationModelInsert,
			schema.VerificationModelSelect
		>,
		"data"
	>,
	payload: UpdateOptions<
		schema.VerificationModelInsert,
		schema.VerificationModelSelect
	>["data"],
): Promise<Pick<schema.VerificationModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.VerificationModel, {
		...options,
		data: payload,
	});
};

/** Deletes the `verification` row(s) matching `options.where`. */
export const verificationDelete = async <
	TSelect extends keyof schema.VerificationModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.VerificationModelSelect>,
): Promise<Pick<schema.VerificationModelSelect, TSelect>[]> => {
	return await deleteRecords(database, schema.VerificationModel, options);
};
