import * as schema from "../drizzle/schema";

import {
	oneRecord,
	manyRecords,
	countRecords,
	createRecords,
	updateRecords,
	type Executor,
	type Pagination,
	type CountResult,
	type CountOptions,
	type CreateOptions,
	type UpdateOptions,
	type FindAllOptions,
	type FindUniqueOptions,
} from "./helpers";

/** `COUNT(*)` of `facilities` rows matching `options.where`, or a per-`groupBy`-value breakdown. */
export const facilityCount = async <
	TGroupBy extends keyof schema.FacilityModelSelect & string = never,
>(
	database: Executor,
	options?: CountOptions<schema.FacilityModelSelect, TGroupBy>,
): Promise<CountResult<TGroupBy>> => {
	return await countRecords(
		database,
		schema.FacilityModel,
		options?.where,
		options?.groupBy,
	);
};

/** Finds multiple `facilities` rows with pagination, filtering, and ordering. */
export const facilityMany = async <
	TSelect extends keyof schema.FacilityModelSelect,
	TOptions extends FindAllOptions<schema.FacilityModelSelect, object>,
>(
	database: Executor,
	options: TOptions,
): Promise<Pagination<Pick<schema.FacilityModelSelect, TSelect>>> => {
	return (await manyRecords(
		database,
		schema.FacilityModel,
		options,
	)) as Pagination<Pick<schema.FacilityModelSelect, TSelect>>;
};

/** Finds a single `facilities` row by a unique `where` condition. */
export const facilityOne = async <
	TSelect extends keyof schema.FacilityModelSelect,
	TOptions extends FindUniqueOptions<schema.FacilityModelSelect, object>,
>(
	database: Executor,
	options: TOptions,
): Promise<Pick<schema.FacilityModelSelect, TSelect> | null> => {
	return (await oneRecord(
		database,
		schema.FacilityModel,
		options,
	)) as Pick<schema.FacilityModelSelect, TSelect> | null;
};

/** Creates a new `facilities` row. No `delete` — removing a facility already referenced elsewhere is a separate reassignment/soft-delete design left for later. */
export const facilityCreate = async <
	TSelect extends keyof schema.FacilityModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.FacilityModelInsert, schema.FacilityModelSelect>,
		"data"
	>,
	payload: CreateOptions<
		schema.FacilityModelInsert,
		schema.FacilityModelSelect
	>["data"],
): Promise<Pick<schema.FacilityModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.FacilityModel, {
		...options,
		data: payload,
	});
};

/** Updates the `facilities` row(s) matching `options.where`, stamping `updated_at` to now. */
export const facilityUpdate = async <
	TSelect extends keyof schema.FacilityModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.FacilityModelInsert, schema.FacilityModelSelect>,
		"data"
	>,
	payload: UpdateOptions<
		schema.FacilityModelInsert,
		schema.FacilityModelSelect
	>["data"],
): Promise<Pick<schema.FacilityModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.FacilityModel, {
		...options,
		data: payload,
	});
};
