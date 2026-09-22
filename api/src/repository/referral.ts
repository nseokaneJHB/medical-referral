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

/** Relations available on `ReferralModel` for `referralOne`/`referralMany`'s `include` and `_count` options. */
interface ReferralRelations {
	patient: schema.PatientModelSelect;
	referrer: schema.UserModelSelect;
	assignedDoctor: schema.UserModelSelect;
	origin_facility: schema.FacilityModelSelect;
	destination_facility: schema.FacilityModelSelect;
	timeline: schema.TimelineModelSelect[];
}

const countConfigs = {
	patient: {
		foreignKey: "id",
		table: schema.PatientModel,
		references: "patient_id",
	},
	referrer: {
		foreignKey: "id",
		table: schema.UserModel,
		references: "referrer_id",
	},
	assignedDoctor: {
		foreignKey: "id",
		table: schema.UserModel,
		references: "doctor",
	},
	origin_facility: {
		foreignKey: "id",
		table: schema.FacilityModel,
		references: "origin_facility_id",
	},
	destination_facility: {
		foreignKey: "id",
		table: schema.FacilityModel,
		references: "destination_facility_id",
	},
	/** `TimelineModel.entity` is polymorphic (a bare id, not a real FK); a cross-type id collision isn't realistic since entity values are globally unique UUIDs. */
	timeline: {
		foreignKey: "entity",
		table: schema.TimelineModel,
		references: "id",
	},
};

const relationConfigs = {
	patient: { ...countConfigs.patient, type: "one" as const },
	referrer: { ...countConfigs.referrer, type: "one" as const },
	assignedDoctor: { ...countConfigs.assignedDoctor, type: "one" as const },
	origin_facility: { ...countConfigs.origin_facility, type: "one" as const },
	destination_facility: {
		...countConfigs.destination_facility,
		type: "one" as const,
	},
	timeline: { ...countConfigs.timeline, type: "many" as const },
};

/** `COUNT(*)` of `referrals` rows matching `options.where`, or a per-`groupBy`-value breakdown (e.g. `status`/`priority`) — only groups with rows come back, so callers zero-fill the rest. */
export const referralCount = async <
	TGroupBy extends keyof schema.ReferralModelSelect & string = never,
>(
	database: Executor,
	options?: CountOptions<schema.ReferralModelSelect, TGroupBy>,
): Promise<CountResult<TGroupBy>> => {
	return await countRecords(
		database,
		schema.ReferralModel,
		options?.where,
		options?.groupBy,
	);
};

/** Finds multiple `referrals` rows with pagination, filtering, ordering, and optional relation eager-loading/counts. */
export const referralMany = async <
	TSelect extends keyof schema.ReferralModelSelect,
	TOptions extends FindAllOptions<
		schema.ReferralModelSelect,
		ReferralRelations
	>,
>(
	database: Executor,
	options: TOptions,
): Promise<
	Pagination<
		WithRelations<
			WithCount<Pick<schema.ReferralModelSelect, TSelect>, TOptions>,
			TOptions,
			ReferralRelations
		>
	>
> => {
	return (await manyRecords(
		database,
		schema.ReferralModel,
		options,
		relationConfigs,
		countConfigs,
	)) as unknown as Pagination<
		WithRelations<
			WithCount<Pick<schema.ReferralModelSelect, TSelect>, TOptions>,
			TOptions,
			ReferralRelations
		>
	>;
};

/** Finds a single `referrals` row by a unique `where` condition, optionally eager-loading relations (`include`) and/or relation counts (`_count`). */
export const referralOne = async <
	TSelect extends keyof schema.ReferralModelSelect,
	TOptions extends FindUniqueOptions<
		schema.ReferralModelSelect,
		ReferralRelations
	>,
>(
	database: Executor,
	options: TOptions,
): Promise<WithRelations<
	WithCount<Pick<schema.ReferralModelSelect, TSelect>, TOptions>,
	TOptions,
	ReferralRelations
> | null> => {
	const result = await oneRecord(
		database,
		schema.ReferralModel,
		options,
		relationConfigs,
		countConfigs,
	);

	return result as WithRelations<
		WithCount<Pick<schema.ReferralModelSelect, TSelect>, TOptions>,
		TOptions,
		ReferralRelations
	> | null;
};

/** Creates a new `referrals` row. */
export const referralCreate = async <
	TSelect extends keyof schema.ReferralModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.ReferralModelInsert, schema.ReferralModelSelect>,
		"data"
	>,
	payload: CreateOptions<
		schema.ReferralModelInsert,
		schema.ReferralModelSelect
	>["data"],
): Promise<Pick<schema.ReferralModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.ReferralModel, {
		...options,
		data: payload,
	});
};

/** Updates the `referrals` row(s) matching `options.where`, stamping `updated_at` to now. */
export const referralUpdate = async <
	TSelect extends keyof schema.ReferralModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.ReferralModelInsert, schema.ReferralModelSelect>,
		"data"
	>,
	payload: UpdateOptions<
		schema.ReferralModelInsert,
		schema.ReferralModelSelect
	>["data"],
): Promise<Pick<schema.ReferralModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.ReferralModel, {
		...options,
		data: payload,
	});
};

/** Deletes the `referrals` row(s) matching `options.where`. */
export const referralDelete = async <
	TSelect extends keyof schema.ReferralModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.ReferralModelSelect>,
): Promise<Pick<schema.ReferralModelSelect, TSelect>[]> => {
	return await deleteRecords(database, schema.ReferralModel, options);
};
