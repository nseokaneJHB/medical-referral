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

/** Relations available on `PatientModel` for `patientOne`/`patientMany`'s `include` and `_count` options. */
interface PatientRelations {
	creator: schema.UserModelSelect;
	facility: schema.FacilityModelSelect;
	referrals: schema.ReferralModelSelect[];
}

const countConfigs = {
	creator: {
		foreignKey: "id",
		table: schema.UserModel,
		references: "creator_id",
	},
	facility: {
		foreignKey: "id",
		table: schema.FacilityModel,
		references: "facility_id",
	},
	referrals: {
		foreignKey: "patient_id",
		table: schema.ReferralModel,
		references: "id",
	},
};

const relationConfigs = {
	creator: { ...countConfigs.creator, type: "one" as const },
	facility: { ...countConfigs.facility, type: "one" as const },
	referrals: { ...countConfigs.referrals, type: "many" as const },
};

/** `COUNT(*)` of `patients` rows matching `options.where`, or a per-`groupBy`-value breakdown. */
export const patientCount = async <
	TGroupBy extends keyof schema.PatientModelSelect & string = never,
>(
	database: Executor,
	options?: CountOptions<schema.PatientModelSelect, TGroupBy>,
): Promise<CountResult<TGroupBy>> => {
	return await countRecords(
		database,
		schema.PatientModel,
		options?.where,
		options?.groupBy,
	);
};

/** Finds multiple `patients` rows with pagination, filtering, ordering, and optional relation eager-loading/counts. */
export const patientMany = async <
	TSelect extends keyof schema.PatientModelSelect,
	TOptions extends FindAllOptions<schema.PatientModelSelect, PatientRelations>,
>(
	database: Executor,
	options: TOptions,
): Promise<
	Pagination<
		WithRelations<
			WithCount<Pick<schema.PatientModelSelect, TSelect>, TOptions>,
			TOptions,
			PatientRelations
		>
	>
> => {
	return (await manyRecords(
		database,
		schema.PatientModel,
		options,
		relationConfigs,
		countConfigs,
	)) as unknown as Pagination<
		WithRelations<
			WithCount<Pick<schema.PatientModelSelect, TSelect>, TOptions>,
			TOptions,
			PatientRelations
		>
	>;
};

/** Finds a single `patients` row by a unique `where` condition, optionally eager-loading relations (`include`) and/or relation counts (`_count`). */
export const patientOne = async <
	TSelect extends keyof schema.PatientModelSelect,
	TOptions extends FindUniqueOptions<
		schema.PatientModelSelect,
		PatientRelations
	>,
>(
	database: Executor,
	options: TOptions,
): Promise<WithRelations<
	WithCount<Pick<schema.PatientModelSelect, TSelect>, TOptions>,
	TOptions,
	PatientRelations
> | null> => {
	const result = await oneRecord(
		database,
		schema.PatientModel,
		options,
		relationConfigs,
		countConfigs,
	);

	return result as WithRelations<
		WithCount<Pick<schema.PatientModelSelect, TSelect>, TOptions>,
		TOptions,
		PatientRelations
	> | null;
};

/** Creates a new `patients` row. */
export const patientCreate = async <
	TSelect extends keyof schema.PatientModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.PatientModelInsert, schema.PatientModelSelect>,
		"data"
	>,
	payload: CreateOptions<
		schema.PatientModelInsert,
		schema.PatientModelSelect
	>["data"],
): Promise<Pick<schema.PatientModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.PatientModel, {
		...options,
		data: payload,
	});
};

/** Updates the `patients` row(s) matching `options.where`, stamping `updated_at` to now. */
export const patientUpdate = async <
	TSelect extends keyof schema.PatientModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.PatientModelInsert, schema.PatientModelSelect>,
		"data"
	>,
	payload: UpdateOptions<
		schema.PatientModelInsert,
		schema.PatientModelSelect
	>["data"],
): Promise<Pick<schema.PatientModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.PatientModel, {
		...options,
		data: payload,
	});
};

/** Deletes the `patients` row(s) matching `options.where`. */
export const patientDelete = async <
	TSelect extends keyof schema.PatientModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.PatientModelSelect>,
): Promise<Pick<schema.PatientModelSelect, TSelect>[]> => {
	return await deleteRecords(database, schema.PatientModel, options);
};
