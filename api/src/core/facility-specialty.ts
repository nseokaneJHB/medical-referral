import * as schema from "../drizzle/schema";

import {
	manyRecords,
	createRecords,
	deleteRecords,
	type Executor,
	type Pagination,
	type CreateOptions,
	type DeleteOptions,
	type FindAllOptions,
} from "./helpers";

interface FacilitySpecialtyRelations {
	facility: schema.FacilityModelSelect;
	specialty: schema.SpecialtyModelSelect;
}

/**
 * Repository for the `facility_specialties` link table (a facility can have
 * multiple specialties). No `update` — a link either exists or doesn't,
 * there's no in-between state to change; unlinking is a `delete`.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class FacilitySpecialty {
	private readonly countConfigs = {
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

	private readonly relationConfigs = {
		facility: { ...this.countConfigs.facility, type: "one" as const },
		specialty: { ...this.countConfigs.specialty, type: "one" as const },
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	many = async <
		TSelect extends keyof schema.FacilitySpecialtyModelSelect,
		TOptions extends FindAllOptions<
			schema.FacilitySpecialtyModelSelect,
			FacilitySpecialtyRelations
		>,
	>(
		options: TOptions,
	): Promise<
		Pagination<Pick<schema.FacilitySpecialtyModelSelect, TSelect>>
	> => {
		return (await manyRecords(
			this.executor,
			schema.FacilitySpecialtyModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		)) as unknown as Pagination<
			Pick<schema.FacilitySpecialtyModelSelect, TSelect>
		>;
	};

	create = async <TSelect extends keyof schema.FacilitySpecialtyModelSelect>(
		options: CreateOptions<
			schema.FacilitySpecialtyModelInsert,
			schema.FacilitySpecialtyModelSelect
		>,
	): Promise<Pick<schema.FacilitySpecialtyModelSelect, TSelect>[]> => {
		return await createRecords(
			this.executor,
			schema.FacilitySpecialtyModel,
			options,
		);
	};

	delete = async <TSelect extends keyof schema.FacilitySpecialtyModelSelect>(
		options: DeleteOptions<schema.FacilitySpecialtyModelSelect>,
	): Promise<Pick<schema.FacilitySpecialtyModelSelect, TSelect>[]> => {
		return await deleteRecords(
			this.executor,
			schema.FacilitySpecialtyModel,
			options,
		);
	};
}
