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

type SpecialtyLinkOwner = "user" | "facility" | "referral";

interface UserSpecialtyRelations {
	user: schema.UserModelSelect;
	specialty: schema.SpecialtyModelSelect;
}

interface FacilitySpecialtyRelations {
	facility: schema.FacilityModelSelect;
	specialty: schema.SpecialtyModelSelect;
}

interface ReferralSpecialtyRelations {
	referral: schema.ReferralModelSelect;
	specialty: schema.SpecialtyModelSelect;
}

const userLinkCountConfigs = {
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

const facilityLinkCountConfigs = {
	facility: {
		foreignKey: "id",
		table: schema.FacilityModel,
		references: "facility_id",
	},
	specialty: {
		foreignKey: "id",
		table: schema.SpecialtyModel,
		references: "specialty_id",
	},
};

const referralLinkCountConfigs = {
	referral: {
		foreignKey: "id",
		table: schema.ReferralModel,
		references: "referral_id",
	},
	specialty: {
		foreignKey: "id",
		table: schema.SpecialtyModel,
		references: "specialty_id",
	},
};

const userLinkRelationConfigs = {
	user: { ...userLinkCountConfigs.user, type: "one" as const },
	specialty: { ...userLinkCountConfigs.specialty, type: "one" as const },
};

const facilityLinkRelationConfigs = {
	facility: { ...facilityLinkCountConfigs.facility, type: "one" as const },
	specialty: { ...facilityLinkCountConfigs.specialty, type: "one" as const },
};

const referralLinkRelationConfigs = {
	referral: { ...referralLinkCountConfigs.referral, type: "one" as const },
	specialty: { ...referralLinkCountConfigs.specialty, type: "one" as const },
};

/** Resolves the `owner`-selected link table — `user_specialties`, `facility_specialties`, or `referral_specialties`. */
const linkTable = (owner: SpecialtyLinkOwner) =>
	owner === "user"
		? schema.UserSpecialtyModel
		: owner === "facility"
			? schema.FacilitySpecialtyModel
			: schema.ReferralSpecialtyModel;

/** Resolves the `owner`-selected link table's relation configs. */
const linkRelationConfigs = (owner: SpecialtyLinkOwner) =>
	owner === "user"
		? userLinkRelationConfigs
		: owner === "facility"
			? facilityLinkRelationConfigs
			: referralLinkRelationConfigs;

/** Resolves the `owner`-selected link table's count configs. */
const linkCountConfigs = (owner: SpecialtyLinkOwner) =>
	owner === "user"
		? userLinkCountConfigs
		: owner === "facility"
			? facilityLinkCountConfigs
			: referralLinkCountConfigs;

/** Finds multiple `specialties` rows with pagination, filtering, and ordering. */
export const specialtyMany = async <
	TSelect extends keyof schema.SpecialtyModelSelect,
	TOptions extends FindAllOptions<schema.SpecialtyModelSelect, object>,
>(
	database: Executor,
	options: TOptions,
): Promise<Pagination<Pick<schema.SpecialtyModelSelect, TSelect>>> => {
	return (await manyRecords(
		database,
		schema.SpecialtyModel,
		options,
	)) as Pagination<Pick<schema.SpecialtyModelSelect, TSelect>>;
};

/** Finds a single `specialties` row by a unique `where` condition. */
export const specialtyOne = async <
	TSelect extends keyof schema.SpecialtyModelSelect,
	TOptions extends FindUniqueOptions<schema.SpecialtyModelSelect, object>,
>(
	database: Executor,
	options: TOptions,
): Promise<Pick<schema.SpecialtyModelSelect, TSelect> | null> => {
	return (await oneRecord(
		database,
		schema.SpecialtyModel,
		options,
	)) as Pick<schema.SpecialtyModelSelect, TSelect> | null;
};

/** Creates a new `specialties` row. */
export const specialtyCreate = async <
	TSelect extends keyof schema.SpecialtyModelSelect,
>(
	database: Executor,
	options: Omit<
		CreateOptions<schema.SpecialtyModelInsert, schema.SpecialtyModelSelect>,
		"data"
	>,
	payload: CreateOptions<
		schema.SpecialtyModelInsert,
		schema.SpecialtyModelSelect
	>["data"],
): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
	return await createRecords(database, schema.SpecialtyModel, {
		...options,
		data: payload,
	});
};

/** Updates the `specialties` row(s) matching `options.where`, stamping `updated_at` to now. */
export const specialtyUpdate = async <
	TSelect extends keyof schema.SpecialtyModelSelect,
>(
	database: Executor,
	options: Omit<
		UpdateOptions<schema.SpecialtyModelInsert, schema.SpecialtyModelSelect>,
		"data"
	>,
	payload: UpdateOptions<
		schema.SpecialtyModelInsert,
		schema.SpecialtyModelSelect
	>["data"],
): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
	return await updateRecords(database, schema.SpecialtyModel, {
		...options,
		data: payload,
	});
};

/** Deletes the `specialties` row(s) matching `options.where`. */
export const specialtyDelete = async <
	TSelect extends keyof schema.SpecialtyModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.SpecialtyModelSelect>,
): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
	return await deleteRecords(database, schema.SpecialtyModel, options);
};

/** Finds multiple rows from whichever link table `options.owner` selects — overloaded per literal owner since TS can't infer a type param nested inside another inferred param's own constraint. */
export function specialtyLinkMany<
	TSelect extends keyof schema.UserSpecialtyModelSelect,
	TOptions extends FindAllOptions<
		schema.UserSpecialtyModelSelect,
		UserSpecialtyRelations
	>,
>(
	database: Executor,
	options: TOptions & { owner: "user" },
): Promise<
	Pagination<
		WithRelations<
			WithCount<Pick<schema.UserSpecialtyModelSelect, TSelect>, TOptions>,
			TOptions,
			UserSpecialtyRelations
		>
	>
>;
export function specialtyLinkMany<
	TSelect extends keyof schema.FacilitySpecialtyModelSelect,
	TOptions extends FindAllOptions<
		schema.FacilitySpecialtyModelSelect,
		FacilitySpecialtyRelations
	>,
>(
	database: Executor,
	options: TOptions & { owner: "facility" },
): Promise<
	Pagination<
		WithRelations<
			WithCount<Pick<schema.FacilitySpecialtyModelSelect, TSelect>, TOptions>,
			TOptions,
			FacilitySpecialtyRelations
		>
	>
>;
export function specialtyLinkMany<
	TSelect extends keyof schema.ReferralSpecialtyModelSelect,
	TOptions extends FindAllOptions<
		schema.ReferralSpecialtyModelSelect,
		ReferralSpecialtyRelations
	>,
>(
	database: Executor,
	options: TOptions & { owner: "referral" },
): Promise<
	Pagination<
		WithRelations<
			WithCount<Pick<schema.ReferralSpecialtyModelSelect, TSelect>, TOptions>,
			TOptions,
			ReferralSpecialtyRelations
		>
	>
>;
export async function specialtyLinkMany(
	database: Executor,
	options: FindAllOptions<Record<string, unknown>, object> & {
		owner: SpecialtyLinkOwner;
	},
): Promise<Pagination<Record<string, unknown>>> {
	const table = linkTable(options.owner);

	return (await manyRecords(
		database,
		table,
		options,
		linkRelationConfigs(options.owner),
		linkCountConfigs(options.owner),
	)) as unknown as Pagination<Record<string, unknown>>;
}

/** Creates a link row in whichever link table `options.owner` selects — see `specialtyLinkMany`'s docstring for why this is overloaded per owner. */
export function specialtyLinkCreate<
	TSelect extends keyof schema.UserSpecialtyModelSelect,
>(
	database: Executor,
	options: { owner: "user"; select: CreateOptions<never, schema.UserSpecialtyModelSelect>["select"] },
	payload: CreateOptions<schema.UserSpecialtyModelInsert, schema.UserSpecialtyModelSelect>["data"],
): Promise<Pick<schema.UserSpecialtyModelSelect, TSelect>[]>;
export function specialtyLinkCreate<
	TSelect extends keyof schema.FacilitySpecialtyModelSelect,
>(
	database: Executor,
	options: { owner: "facility"; select: CreateOptions<never, schema.FacilitySpecialtyModelSelect>["select"] },
	payload: CreateOptions<schema.FacilitySpecialtyModelInsert, schema.FacilitySpecialtyModelSelect>["data"],
): Promise<Pick<schema.FacilitySpecialtyModelSelect, TSelect>[]>;
export function specialtyLinkCreate<
	TSelect extends keyof schema.ReferralSpecialtyModelSelect,
>(
	database: Executor,
	options: { owner: "referral"; select: CreateOptions<never, schema.ReferralSpecialtyModelSelect>["select"] },
	payload: CreateOptions<schema.ReferralSpecialtyModelInsert, schema.ReferralSpecialtyModelSelect>["data"],
): Promise<Pick<schema.ReferralSpecialtyModelSelect, TSelect>[]>;
export async function specialtyLinkCreate(
	database: Executor,
	options: { owner: SpecialtyLinkOwner; select: Record<string, boolean> },
	payload: unknown,
): Promise<Record<string, unknown>[]> {
	const table = linkTable(options.owner);

	return await createRecords(database, table, {
		select: options.select,
		data: payload,
	} as CreateOptions<unknown, Record<string, unknown>>);
}

/** Deletes link row(s) from whichever link table `options.owner` selects — unlinking a specialty has no `update`, only a `delete`; see `specialtyLinkMany`'s docstring for why this is overloaded per owner. */
export function specialtyLinkDelete<
	TSelect extends keyof schema.UserSpecialtyModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.UserSpecialtyModelSelect> & { owner: "user" },
): Promise<Pick<schema.UserSpecialtyModelSelect, TSelect>[]>;
export function specialtyLinkDelete<
	TSelect extends keyof schema.FacilitySpecialtyModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.FacilitySpecialtyModelSelect> & {
		owner: "facility";
	},
): Promise<Pick<schema.FacilitySpecialtyModelSelect, TSelect>[]>;
export function specialtyLinkDelete<
	TSelect extends keyof schema.ReferralSpecialtyModelSelect,
>(
	database: Executor,
	options: DeleteOptions<schema.ReferralSpecialtyModelSelect> & {
		owner: "referral";
	},
): Promise<Pick<schema.ReferralSpecialtyModelSelect, TSelect>[]>;
export async function specialtyLinkDelete(
	database: Executor,
	options: {
		owner: SpecialtyLinkOwner;
		where: unknown;
		select: Record<string, boolean>;
	},
): Promise<Record<string, unknown>[]> {
	const table = linkTable(options.owner);

	return await deleteRecords(
		database,
		table,
		options as unknown as DeleteOptions<Record<string, unknown>>,
	);
}

/** `COUNT(*)` of link rows in whichever link table `options.owner` selects, optionally `groupBy` a column — see `specialtyLinkMany`'s docstring for why this is overloaded per owner. */
export function specialtyLinkCount<
	TGroupBy extends keyof schema.UserSpecialtyModelSelect & string = never,
>(
	database: Executor,
	options: CountOptions<schema.UserSpecialtyModelSelect, TGroupBy> & {
		owner: "user";
	},
): Promise<CountResult<TGroupBy>>;
export function specialtyLinkCount<
	TGroupBy extends keyof schema.FacilitySpecialtyModelSelect & string = never,
>(
	database: Executor,
	options: CountOptions<schema.FacilitySpecialtyModelSelect, TGroupBy> & {
		owner: "facility";
	},
): Promise<CountResult<TGroupBy>>;
export function specialtyLinkCount<
	TGroupBy extends keyof schema.ReferralSpecialtyModelSelect & string = never,
>(
	database: Executor,
	options: CountOptions<schema.ReferralSpecialtyModelSelect, TGroupBy> & {
		owner: "referral";
	},
): Promise<CountResult<TGroupBy>>;
export async function specialtyLinkCount(
	database: Executor,
	options: { owner: SpecialtyLinkOwner; where?: unknown; groupBy?: string },
): Promise<unknown> {
	const table = linkTable(options.owner);

	return await countRecords(
		database,
		table,
		options.where as Record<string, unknown> | undefined,
		options.groupBy,
	);
}
