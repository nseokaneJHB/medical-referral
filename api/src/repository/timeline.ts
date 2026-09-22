import { type TimelineAction } from "@referral-tracking/shared";

import * as schema from "../drizzle/schema";

import {
	oneRecord,
	manyRecords,
	createRecords,
	type Executor,
	type Pagination,
	type CreateOptions,
	type FindAllOptions,
	type FindUniqueOptions,
	type WithCount,
	type WithRelations,
} from "./helpers";

/** Relations available on `TimelineModel` for `timelineMany`'s `include`/`_count` options — no `referral`/`user`/`facility` relation since `entity` is polymorphic. */
interface TimelineRelations {
	changer: schema.UserModelSelect;
}

const countConfigs = {
	changer: {
		foreignKey: "id",
		table: schema.UserModel,
		references: "changer_id",
	},
};

const relationConfigs = {
	changer: { ...countConfigs.changer, type: "one" as const },
};

/** Finds multiple `timeline` rows with pagination/filtering/ordering; `options.supersededBy` restricts to rows still current for their `(type, entity)` via a `NOT EXISTS` subquery. No `timelineUpdate`/`timelineDelete` — history rows are append-only. */
export const timelineMany = async <
	TSelect extends keyof schema.TimelineModelSelect,
	TOptions extends FindAllOptions<
		schema.TimelineModelSelect,
		TimelineRelations
	>,
>(
	database: Executor,
	options: TOptions & { supersededBy?: TimelineAction[] },
): Promise<
	Pagination<
		WithRelations<
			WithCount<Pick<schema.TimelineModelSelect, TSelect>, TOptions>,
			TOptions,
			TimelineRelations
		>
	>
> => {
	const where = options.supersededBy
		? {
				...options.where,
				NOT_SUPERSEDED_BY: {
					groupBy: ["type", "entity"],
					orderBy: "changed_at",
					matchColumn: "action",
					matchValues: options.supersededBy,
				},
			}
		: options.where;

	return (await manyRecords(
		database,
		schema.TimelineModel,
		{ ...options, where },
		relationConfigs,
		countConfigs,
	)) as unknown as Pagination<
		WithRelations<
			WithCount<Pick<schema.TimelineModelSelect, TSelect>, TOptions>,
			TOptions,
			TimelineRelations
		>
	>;
};

/** Finds a single `timeline` row by a unique `where` condition — e.g. looking up one specific appeal by id before deciding it. */
export const timelineOne = async <
	TSelect extends keyof schema.TimelineModelSelect,
	TOptions extends FindUniqueOptions<
		schema.TimelineModelSelect,
		TimelineRelations
	>,
>(
	database: Executor,
	options: TOptions,
): Promise<Pick<schema.TimelineModelSelect, TSelect> | null> => {
	return (await oneRecord(
		database,
		schema.TimelineModel,
		options,
	)) as Pick<schema.TimelineModelSelect, TSelect> | null;
};

/** Creates a new `timeline` row — typically inside `database.transaction(async (tx) => {...})` alongside the entity's own status update, so both writes commit together. */
export const timelineCreate = async <
	TSelect extends keyof schema.TimelineModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.TimelineModelInsert, schema.TimelineModelSelect>,
		"data"
	>,
	payload: CreateOptions<
		schema.TimelineModelInsert,
		schema.TimelineModelSelect
	>["data"],
): Promise<Pick<schema.TimelineModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.TimelineModel, {
		...options,
		data: payload,
	});
};
