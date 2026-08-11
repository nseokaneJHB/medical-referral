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
} from "./helpers";

/**
 * Relations available on `TimelineModel` for use with `many()`'s
 * `include`/`_count` options. No `referral`/`user`/`facility` relation here
 * — `TimelineModel.entity` is polymorphic (its `type` column says which
 * table it points at), so it can't be unconditionally joined to any one
 * table the way `changer` can.
 */
interface TimelineRelations {
	changer: schema.UserModelSelect;
}

/**
 * Repository for the `timeline` table — a generalized append-only audit
 * log covering User, Facility, and Referral status/moderation history in
 * one shared shape (`type` + `entity` identify which record a row is
 * about). Intentionally exposes only `many` (read) and `create` (write a
 * new entry); there's no `update`/`delete` because history rows must never
 * be mutated after the fact.
 *
 * Bound to a single `Executor` (a `Database` or an open Drizzle transaction)
 * at construction time. The singleton instance on `CoreService` is bound to
 * the outer connection; `CoreService.withTransaction(tx)` constructs a
 * fresh, transaction-bound instance for use inside `connection.transaction(...)`
 * — the natural place to call `create` from, alongside the entity's own
 * `status` update, so both writes commit together.
 */
export class Timeline {
	private readonly countConfigs = {
		changer: {
			foreignKey: "id",
			table: schema.UserModel,
			references: "changer_id",
		},
	};

	private readonly relationConfigs = {
		changer: { ...this.countConfigs.changer, type: "one" as const },
	};

	private readonly executor: Executor;

	constructor(executor: Executor) {
		this.executor = executor;
	}

	/**
	 * Find multiple `timeline` rows with pagination, filtering, and ordering.
	 *
	 * @param options - `where`/`order`/`select`/`page`/`limit` for the
	 * query. `supersededBy`, if passed, restricts results to rows that are
	 * still the *current* row for their `(type, entity)` — i.e. no later
	 * row whose action is in `supersededBy` exists for the same entity.
	 * The `timeline` table is append-only, so "is this row still current"
	 * isn't a property of one row — it depends on comparing it against
	 * every later row for the same entity, which the generic `WhereClause`
	 * builder (a flat filter, no cross-row comparison) can't express on its
	 * own; a `NOT EXISTS` subquery over the existing
	 * `timeline_type_entity_idx` index handles it as a genuine DB-level
	 * filter — real `LIMIT`/`OFFSET` pagination and `COUNT(*)`, not an
	 * app-level fetch-everything-then-filter that only works by assuming
	 * volume stays small forever. Generic (not aware of what any particular
	 * `supersededBy` set means for a given workflow — deciding an appeal,
	 * deciding a transfer, ...) — callers supply that meaning.
	 * @returns A paginated result containing only the selected fields.
	 */
	many = async <
		TSelect extends keyof schema.TimelineModelSelect,
		TOptions extends FindAllOptions<
			schema.TimelineModelSelect,
			TimelineRelations
		>,
	>(
		options: TOptions & { supersededBy?: TimelineAction[] },
	): Promise<Pagination<Pick<schema.TimelineModelSelect, TSelect>>> => {
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
			this.executor,
			schema.TimelineModel,
			{ ...options, where },
			this.relationConfigs,
			this.countConfigs,
		)) as unknown as Pagination<Pick<schema.TimelineModelSelect, TSelect>>;
	};

	/**
	 * Find a single `timeline` row by a unique `where` condition — e.g.
	 * looking up one specific appeal by id before deciding it. A pure read,
	 * so it doesn't conflict with this repo's append-only (no
	 * `update`/`delete`) design.
	 *
	 * @param options - `where`/`select` for the query.
	 * @returns The matching row, or `null` if not found.
	 * @throws If no `where` condition or no `select` fields are provided.
	 */
	one = async <
		TSelect extends keyof schema.TimelineModelSelect,
		TOptions extends FindUniqueOptions<
			schema.TimelineModelSelect,
			TimelineRelations
		>,
	>(
		options: TOptions,
	): Promise<Pick<schema.TimelineModelSelect, TSelect> | null> => {
		return (await oneRecord(
			this.executor,
			schema.TimelineModel,
			options,
		)) as Pick<schema.TimelineModelSelect, TSelect> | null;
	};

	/**
	 * Create a new `timeline` row.
	 *
	 * @param options - `data`/`select` for the insert.
	 * @returns The created row (selected fields only).
	 * @throws If no `select` fields are provided.
	 */
	create = async <TSelect extends keyof schema.TimelineModelSelect>(
		options: CreateOptions<
			schema.TimelineModelInsert,
			schema.TimelineModelSelect
		>,
	): Promise<Pick<schema.TimelineModelSelect, TSelect>[]> => {
		return await createRecords(this.executor, schema.TimelineModel, options);
	};
}
