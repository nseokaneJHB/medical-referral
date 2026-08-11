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

type SpecialtyLinkOwner = "user" | "facility";

interface UserSpecialtyRelations {
	user: schema.UserModelSelect;
	specialty: schema.SpecialtyModelSelect;
}

interface FacilitySpecialtyRelations {
	facility: schema.FacilityModelSelect;
	specialty: schema.SpecialtyModelSelect;
}

type LinkSelect<TOwner extends SpecialtyLinkOwner> = TOwner extends "user"
	? schema.UserSpecialtyModelSelect
	: schema.FacilitySpecialtyModelSelect;

type LinkInsert<TOwner extends SpecialtyLinkOwner> = TOwner extends "user"
	? schema.UserSpecialtyModelInsert
	: schema.FacilitySpecialtyModelInsert;

type LinkRelations<TOwner extends SpecialtyLinkOwner> = TOwner extends "user"
	? UserSpecialtyRelations
	: FacilitySpecialtyRelations;

/**
 * Repository for the `specialties` reference table, plus the two link
 * tables that exist only to attach a specialty to something else —
 * `user_specialties` (Doctor/Nurse) and `facility_specialties`. Both link
 * tables are structurally identical (owner ↔ specialty, no `update` — a
 * link either exists or doesn't) and have no reason to exist independently
 * of `specialties`, which is why they're handled here as `link*` methods
 * (keyed by an `owner: "user" | "facility"` argument that conditionally
 * selects the table/relation config) rather than their own top-level
 * `core/*.ts` classes.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Specialty {
	private readonly userLinkCountConfigs = {
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

	private readonly facilityLinkCountConfigs = {
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

	private readonly userLinkRelationConfigs = {
		user: { ...this.userLinkCountConfigs.user, type: "one" as const },
		specialty: { ...this.userLinkCountConfigs.specialty, type: "one" as const },
	};

	private readonly facilityLinkRelationConfigs = {
		facility: {
			...this.facilityLinkCountConfigs.facility,
			type: "one" as const,
		},
		specialty: {
			...this.facilityLinkCountConfigs.specialty,
			type: "one" as const,
		},
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	many = async <
		TSelect extends keyof schema.SpecialtyModelSelect,
		TOptions extends FindAllOptions<schema.SpecialtyModelSelect, object>,
	>(
		options: TOptions,
	): Promise<Pagination<Pick<schema.SpecialtyModelSelect, TSelect>>> => {
		return (await manyRecords(
			this.executor,
			schema.SpecialtyModel,
			options,
		)) as unknown as Pagination<Pick<schema.SpecialtyModelSelect, TSelect>>;
	};

	one = async <
		TSelect extends keyof schema.SpecialtyModelSelect,
		TOptions extends FindUniqueOptions<schema.SpecialtyModelSelect, object>,
	>(
		options: TOptions,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect> | null> => {
		return (await oneRecord(
			this.executor,
			schema.SpecialtyModel,
			options,
		)) as Pick<schema.SpecialtyModelSelect, TSelect> | null;
	};

	create = async <TSelect extends keyof schema.SpecialtyModelSelect>(
		options: CreateOptions<
			schema.SpecialtyModelInsert,
			schema.SpecialtyModelSelect
		>,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.SpecialtyModel, options);
	};

	update = async <TSelect extends keyof schema.SpecialtyModelSelect>(
		options: UpdateOptions<
			schema.SpecialtyModelInsert,
			schema.SpecialtyModelSelect
		>,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.SpecialtyModel, options);
	};

	delete = async <TSelect extends keyof schema.SpecialtyModelSelect>(
		options: DeleteOptions<schema.SpecialtyModelSelect>,
	): Promise<Pick<schema.SpecialtyModelSelect, TSelect>[]> => {
		return await deleteRecords(this.executor, schema.SpecialtyModel, options);
	};

	/**
	 * Find multiple rows from `user_specialties` or `facility_specialties`,
	 * whichever `owner` selects.
	 */
	linkMany = async <
		TOwner extends SpecialtyLinkOwner,
		TSelect extends keyof LinkSelect<TOwner>,
		TOptions extends FindAllOptions<LinkSelect<TOwner>, LinkRelations<TOwner>>,
	>(
		owner: TOwner,
		options: TOptions,
	): Promise<Pagination<Pick<LinkSelect<TOwner>, TSelect>>> => {
		const table =
			owner === "user" ? schema.UserSpecialtyModel : schema.FacilitySpecialtyModel;
		const relationConfigs =
			owner === "user"
				? this.userLinkRelationConfigs
				: this.facilityLinkRelationConfigs;
		const countConfigs =
			owner === "user"
				? this.userLinkCountConfigs
				: this.facilityLinkCountConfigs;

		return (await manyRecords(
			this.executor,
			table,
			options,
			relationConfigs,
			countConfigs,
		)) as unknown as Pagination<Pick<LinkSelect<TOwner>, TSelect>>;
	};

	/** Create a link row in `user_specialties` or `facility_specialties`. */
	linkCreate = async <
		TOwner extends SpecialtyLinkOwner,
		TSelect extends keyof LinkSelect<TOwner>,
	>(
		owner: TOwner,
		options: CreateOptions<LinkInsert<TOwner>, LinkSelect<TOwner>>,
	): Promise<Pick<LinkSelect<TOwner>, TSelect>[]> => {
		const table =
			owner === "user" ? schema.UserSpecialtyModel : schema.FacilitySpecialtyModel;

		return await createRecords(this.executor, table, options);
	};

	/**
	 * Delete link row(s) from `user_specialties` or `facility_specialties`
	 * — unlinking a specialty either has no `update`, it's a `delete`.
	 */
	linkDelete = async <
		TOwner extends SpecialtyLinkOwner,
		TSelect extends keyof LinkSelect<TOwner>,
	>(
		owner: TOwner,
		options: DeleteOptions<LinkSelect<TOwner>>,
	): Promise<Pick<LinkSelect<TOwner>, TSelect>[]> => {
		const table =
			owner === "user" ? schema.UserSpecialtyModel : schema.FacilitySpecialtyModel;

		return await deleteRecords(this.executor, table, options);
	};
}
