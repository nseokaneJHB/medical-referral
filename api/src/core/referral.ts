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
	type WhereClause,
	type CountResult,
	type CreateOptions,
	type UpdateOptions,
	type DeleteOptions,
	type FindAllOptions,
	type FindUniqueOptions,
	type WithCount,
} from "./helpers";

/**
 * Relations available on `ReferralModel` for use with `one()`'s `include`
 * and `_count` options — i.e. what can be eagerly loaded or counted
 * alongside a referral record.
 */
interface ReferralRelations {
	patient: schema.PatientModelSelect;
	referrer: schema.UserModelSelect;
	assignedDoctor: schema.UserModelSelect;
	origin_facility: schema.FacilityModelSelect;
	destination_facility: schema.FacilityModelSelect;
	timeline: schema.TimelineModelSelect;
}

/**
 * Repository for the `referrals` table. Thin wrapper around the shared
 * generic CRUD helpers (`oneRecord`, `manyRecords`, `updateRecords`,
 * `deleteRecords`), pre-bound to `schema.ReferralModel` and this model's
 * relation/count configs.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`.
 */
export class Referral {
	private readonly countConfigs = {
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
		/**
		 * `TimelineModel.entity` is polymorphic (a bare id, not a real FK) —
		 * this join isn't type-narrowed to `type: REFERRAL` rows only, but
		 * `entity` values are UUIDs unique across the whole system, so a
		 * cross-type collision with a USER/FACILITY timeline row isn't a
		 * realistic correctness risk in practice.
		 */
		timeline: {
			foreignKey: "entity",
			table: schema.TimelineModel,
			references: "id",
		},
	};

	private readonly relationConfigs = {
		patient: { ...this.countConfigs.patient, type: "one" as const },
		referrer: { ...this.countConfigs.referrer, type: "one" as const },
		assignedDoctor: {
			...this.countConfigs.assignedDoctor,
			type: "one" as const,
		},
		origin_facility: {
			...this.countConfigs.origin_facility,
			type: "one" as const,
		},
		destination_facility: {
			...this.countConfigs.destination_facility,
			type: "one" as const,
		},
		timeline: {
			...this.countConfigs.timeline,
			type: "many" as const,
		},
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find multiple `referrals` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the query.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <
		TSelect extends keyof schema.ReferralModelSelect,
		TOptions extends FindAllOptions<
			schema.ReferralModelSelect,
			ReferralRelations
		>,
	>(
		options: TOptions,
	): Promise<
		Pagination<WithCount<Pick<schema.ReferralModelSelect, TSelect>, TOptions>>
	> => {
		return (await manyRecords(
			this.executor,
			schema.ReferralModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		)) as unknown as Pagination<
			WithCount<Pick<schema.ReferralModelSelect, TSelect>, TOptions>
		>;
	};

	/**
	 * Find a single `referrals` row by a unique `where` condition, optionally
	 * eager-loading relations (`include`) and/or relation counts (`_count`).
	 *
	 * @param options - `where`/`select` (required) plus optional `include`/`_count`.
	 * @returns The matching referral (with requested relations/counts attached), or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <
		TSelect extends keyof schema.ReferralModelSelect,
		TOptions extends FindUniqueOptions<
			schema.ReferralModelSelect,
			ReferralRelations
		>,
	>(
		options: TOptions,
	): Promise<WithCount<
		Pick<schema.ReferralModelSelect, TSelect>,
		TOptions
	> | null> => {
		const result = await oneRecord(
			this.executor,
			schema.ReferralModel,
			options,
			this.relationConfigs,
			this.countConfigs,
		);

		return result as WithCount<
			Pick<schema.ReferralModelSelect, TSelect>,
			TOptions
		> | null;
	};

	/**
	 * `COUNT(*)` of `referrals` rows matching `where` (or the whole table if
	 * omitted) — for dashboard-style totals that don't need rows back. Pass
	 * `groupBy` (any column name, e.g. `"status"`/`"priority"`) for a
	 * `COUNT(*) ... GROUP BY` breakdown instead of a flat total — only
	 * groups that actually have rows come back, so callers zero-fill any
	 * value (e.g. a `REFERRAL_STATUS`) that returned none.
	 *
	 * @param where - Optional filter, same shape as `many()`'s.
	 * @param groupBy - Optional column to group by.
	 * @returns A flat count, or one count per distinct `groupBy` value.
	 */
	count = async <
		TGroupBy extends keyof schema.ReferralModelSelect & string = never,
	>(
		where?: WhereClause<schema.ReferralModelSelect>,
		groupBy?: TGroupBy,
	): Promise<CountResult<TGroupBy>> => {
		return await countRecords(
			this.executor,
			schema.ReferralModel,
			where,
			groupBy,
		);
	};

	/**
	 * Create a new `referrals` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only), or `null` if the insert returned nothing.
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.ReferralModelSelect>(
		options: CreateOptions<
			schema.ReferralModelInsert,
			schema.ReferralModelSelect
		>,
	): Promise<Pick<schema.ReferralModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.ReferralModel, options);
	};

	/**
	 * Update the `referrals` row(s) matching `where`, stamping `updated` to now.
	 *
	 * @param options - `where`/`data`/`select` for the update.
	 * @returns The updated row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	update = async <TSelect extends keyof schema.ReferralModelSelect>(
		options: UpdateOptions<
			schema.ReferralModelInsert,
			schema.ReferralModelSelect
		>,
	): Promise<Pick<schema.ReferralModelSelect, TSelect>[]> => {
		return await updateRecords(this.executor, schema.ReferralModel, options);
	};

	/**
	 * Delete the `referrals` row(s) matching `where`.
	 *
	 * @param options - `where`/`select` for the delete.
	 * @returns The deleted row (selected fields only), or `null` if no row matched.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	delete = async <TSelect extends keyof schema.ReferralModelSelect>(
		options: DeleteOptions<schema.ReferralModelSelect>,
	): Promise<Pick<schema.ReferralModelSelect, TSelect>[]> => {
		return await deleteRecords(this.executor, schema.ReferralModel, options);
	};
}
