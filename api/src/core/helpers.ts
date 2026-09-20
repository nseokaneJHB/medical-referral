/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	eq,
	gt,
	lt,
	or,
	gte,
	sql,
	lte,
	and,
	asc,
	not,
	desc,
	like,
	isNull,
	inArray,
	isNotNull,
	type SQL,
	getTableName,
	getTableColumns,
} from "drizzle-orm";

import {
	alias,
	type MySqlColumn,
	type MySqlTable,
} from "drizzle-orm/mysql-core";

import type { MySql2Database } from "drizzle-orm/mysql2";

import {
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	orderDirectionSchema,
} from "@referral-tracking/shared";

import { parseEnumList, parseSortList } from "../lib/validator";

/* ═══════════════════════════════════════════════════════════════
   EXECUTOR - db connection OR an open transaction, interchangeably
   ═══════════════════════════════════════════════════════════════ */
export type Database = MySql2Database<Record<string, any>>;

// The exact type Drizzle hands you inside `db.transaction(async (tx) => ...)`.
// Derived from the connection itself rather than hardcoded, so it can't
// drift out of sync with the installed drizzle-orm version.
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type Executor = Database | Transaction;

/* ═══════════════════════════════════════════════════════════════
   CORE TYPES - What repositories work with
   ═══════════════════════════════════════════════════════════════ */

export type WhereOperator<T> = {
	lt?: T;
	gt?: T;
	not?: T;
	lte?: T;
	gte?: T;
	in?: T[];
	notIn?: T[];
	isNull?: boolean;
	isNotNull?: boolean;
	contains?: string;
	mode?: "insensitive" | "default";
	between?: T extends Date ? [Date, Date] : [T, T];
	notBetween?: T extends Date ? [Date, Date] : [T, T];
};

/**
 * "Only rows not superseded by a later row" — for append-only tables where
 * whether a row still applies depends on comparing it against every later
 * row for the same group, not on the row's own columns. See
 * `buildWhere`'s `NOT_SUPERSEDED_BY` handling and
 * `Timeline.many()`'s `supersededBy` option, its only current caller.
 */
export type SupersededCondition<TModel> = {
	groupBy: (keyof TModel & string)[];
	orderBy: keyof TModel & string;
	matchColumn: keyof TModel & string;
	matchValues: string[];
};

export type WhereClause<TModel> = {
	[K in keyof TModel]?: TModel[K] | WhereOperator<TModel[K]>;
} & {
	OR?: WhereClause<TModel>[];
	AND?: WhereClause<TModel>[];
	NOT_SUPERSEDED_BY?: SupersededCondition<TModel>;
};

export type OrderDirection = "asc" | "desc";

export type OrderClause<TModel> = {
	[K in keyof TModel]?: OrderDirection;
};

export type SelectClause<TModel> = {
	[K in keyof TModel]?: boolean;
};

export type CountOptions<TModel> = {
	where?: WhereClause<TModel>;
};

export type GenericManyOptions<
	TModel,
	TSelect extends keyof TModel = keyof TModel,
> = {
	page?: number;
	limit?: number;
	where?: WhereClause<TModel>;
	order?: OrderClause<TModel>;
	select: SelectClause<Pick<TModel, TSelect>>;
};

export type IncludeRelation<TModel> = GenericManyOptions<TModel> | boolean;

export type IncludeClause<TRelations> = {
	[K in keyof TRelations]?: IncludeRelation<TRelations[K]>;
};

export type CountClause<TRelations> = {
	select: {
		[K in keyof TRelations]?:
			| boolean
			| {
					where?: WhereClause<TRelations[K]>;
			  };
	};
};

/**
 * Adds the relation counts requested through an `_count.select` clause to a
 * record's type. Both `manyRecords` and `oneRecord` add this property at
 * runtime, so repository return types must model it as well.
 */
export type WithCount<TRecord, TOptions> = TOptions extends {
	_count: { select: infer TSelect };
}
	? TRecord & {
			_count: {
				[K in keyof TSelect as TSelect[K] extends false | undefined
					? never
					: K]: number;
			};
		}
	: TRecord;

/**
 * Adds the relations requested through an `include` clause to a record's
 * type — same "shape depends on the options passed" idiom as `WithCount`.
 * `TRelations[K]` already encodes cardinality per relation (each repo's own
 * `XRelations` interface types a "many" relation as an array, a "one" as a
 * bare object), so this doesn't need the runtime relation-type info
 * `buildRelations` uses — it just looks it up.
 */
export type WithRelations<TRecord, TOptions, TRelations> = TOptions extends {
	include: infer TInclude;
}
	? TRecord & {
			[K in keyof TInclude as TInclude[K] extends false | undefined
				? never
				: K extends keyof TRelations
					? K
					: never]: K extends keyof TRelations ? TRelations[K] : never;
		}
	: TRecord;

export type Pagination<T> = {
	data: T[];
	page: number;
	limit: number;
	/** Number of items returned in this page (i.e. `data.length`). */
	count: number;
	/** Total number of items matching the filter, across all pages. */
	total: number;
};

type RelationConfig = {
	table: MySqlTable;
	foreignKey: string;
	references: string;
	type: "one" | "many";
};

type CountConfig = Omit<RelationConfig, "type">;

/* ═══════════════════════════════════════════════════════════════
   REPOSITORY METHOD OPTIONS - Prisma-like API
   ═══════════════════════════════════════════════════════════════ */

export type FindAllOptions<
	TModel,
	TRelations = unknown,
> = GenericManyOptions<TModel> & {
	_count?: CountClause<TRelations>;
	include?: IncludeClause<TRelations>;
};

export type FindUniqueOptions<TModel, TRelations = unknown> = {
	where: WhereClause<TModel>;
	include?: IncludeClause<TRelations>;
	select: SelectClause<TModel>;
	_count?: CountClause<TRelations>;
};

export type CreateOptions<TInsert, TModel> = {
	data: TInsert | TInsert[];
	select: SelectClause<TModel>;
};

export type UpdateOptions<TInsert, TModel> = {
	data: Partial<TInsert>;
	where: WhereClause<TModel>;
	select: SelectClause<TModel>;
};

export type DeleteOptions<TModel> = {
	where: WhereClause<TModel>;
	select: SelectClause<TModel>;
};

export type AggregateOptions<TModel> = {
	by: keyof TModel;
	where?: WhereClause<TModel>;
};

/* ═══════════════════════════════════════════════════════════════
   QUERY PARAM PARSING - turns a request's raw sort/order strings
   into the OrderClause<TModel> repositories accept
   ═══════════════════════════════════════════════════════════════ */

/** Resolves `?sort=&order=` into an `OrderClause<TModel>`, pairing each sort column with its positional direction and repeating the first/fallback direction once `order` runs out. */
export const buildOrderClause = <
	TModel,
	TTable extends MySqlTable = MySqlTable,
>(
	sortValue: string | undefined,
	orderValue: string | undefined,
	model: TTable,
	fallbackColumn: string,
	fallbackDirection: OrderDirection,
): OrderClause<TModel> => {
	const sorts = parseSortList(sortValue, model, fallbackColumn);
	const orders = parseEnumList(orderValue, orderDirectionSchema) ?? [
		fallbackDirection,
	];

	return Object.fromEntries(
		sorts.map((sorting, index) => [
			sorting,
			orders[index] || orders[0] || fallbackDirection,
		]),
	) as OrderClause<TModel>;
};

/* ═══════════════════════════════════════════════════════════════
   INTERNAL BUILDERS - Drizzle SQL construction (hidden from repos)
   ═══════════════════════════════════════════════════════════════ */

export const buildSelect = <TTable extends MySqlTable, TModel>(
	table: TTable,
	select: SelectClause<TModel>,
): Record<string, MySqlColumn> => {
	const selectedFields: Record<string, MySqlColumn> = {};

	for (const [key, value] of Object.entries(select)) {
		if (value === true) {
			const column = table[key as keyof typeof table] as MySqlColumn;
			if (!column) throw new Error(`Invalid column: ${key}`);
			selectedFields[key] = column;
		}
	}

	if (Object.keys(selectedFields).length === 0) {
		throw new Error("At least one field must be selected.");
	}

	return selectedFields;
};

export const buildWhere = <TTable extends MySqlTable, TModel>(
	table: TTable,
	where?: WhereClause<TModel>,
): SQL<unknown> | undefined => {
	if (!where) return undefined;

	const conditions: SQL<unknown>[] = [];

	for (const [key, value] of Object.entries(where)) {
		// Handle OR operator
		if (key === "OR" && Array.isArray(value)) {
			const orConditions = value
				.map((clause) => buildWhere(table, clause))
				.filter(Boolean);
			if (orConditions.length > 0) {
				conditions.push(or(...orConditions)!);
			}
			continue;
		}

		// Handle AND operator
		if (key === "AND" && Array.isArray(value)) {
			const andConditions = value
				.map((clause) => buildWhere(table, clause))
				.filter(Boolean);
			if (andConditions.length > 0) {
				conditions.push(and(...andConditions)!);
			}
			continue;
		}

		// Handle "not superseded by a later row" (see `SupersededCondition`)
		if (key === "NOT_SUPERSEDED_BY" && value) {
			const condition = value as SupersededCondition<unknown>;
			conditions.push(
				buildSupersededCondition(
					table,
					condition.groupBy,
					condition.orderBy,
					condition.matchColumn,
					condition.matchValues,
				),
			);
			continue;
		}

		const column = table[key as keyof typeof table] as MySqlColumn;
		if (!column) throw new Error(`Invalid column: ${key}`);

		// Handle null/undefined
		if (value === null || value === undefined) continue;

		// Handle operator objects
		const isPlainObject =
			typeof value === "object" &&
			!Array.isArray(value) &&
			Object.prototype.toString.call(value) === "[object Object]";

		if (isPlainObject) {
			const operator = value as WhereOperator<unknown>;

			if (operator.isNull === true) {
				conditions.push(isNull(column));
			}
			if (operator.isNotNull === true) {
				conditions.push(isNotNull(column));
			}
			if (operator.lt !== undefined) {
				conditions.push(lt(column, operator.lt));
			}
			if (operator.lte !== undefined) {
				conditions.push(lte(column, operator.lte));
			}
			if (operator.gt !== undefined) {
				conditions.push(gt(column, operator.gt));
			}
			if (operator.gte !== undefined) {
				conditions.push(gte(column, operator.gte));
			}
			if (operator.not !== undefined) {
				conditions.push(not(eq(column, operator.not)));
			}
			if (operator.in && operator.in.length > 0) {
				conditions.push(inArray(column, operator.in));
			}
			if (operator.notIn && operator.notIn.length > 0) {
				conditions.push(not(inArray(column, operator.notIn)));
			}
			if (operator.contains !== undefined) {
				// Escape LIKE metacharacters so literal %, _, and \ in user input
				// are matched literally instead of acting as wildcards.
				const escaped = operator.contains.replace(/[\\%_]/g, "\\$&");
				const pattern = `%${escaped}%`;
				if (operator.mode === "insensitive") {
					// MySQL has no ILIKE operator — LOWER() on both sides keeps
					// this case-insensitive regardless of column collation.
					conditions.push(sql`LOWER(${column}) LIKE LOWER(${pattern})`);
				} else {
					conditions.push(like(column, pattern));
				}
			}
		} else {
			conditions.push(eq(column, value));
		}
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
};

/**
 * A `NOT EXISTS` correlated subquery: `true` for a row unless a *later* row
 * (by `orderColumn`) exists on the same table, matching the same
 * `groupColumns` values, whose `matchColumn` is one of `matchValues`. Used
 * for append-only tables where "is this row still current" isn't a
 * property of one row — it depends on comparing it against every later row
 * for the same group, which the flat `WhereClause` builder above can't
 * express (see `Timeline.many()`'s `supersededBy` option, its only current
 * caller). Fully generic — table-agnostic, like the rest of this file;
 * doesn't know what "current" means for any particular table, only how to
 * ask the question.
 *
 * Builds a proper Drizzle table alias (`alias()`) rather than raw SQL
 * table/column name strings, so the self-join stays tied to the real
 * schema instead of a hand-maintained table name.
 */
export const buildSupersededCondition = <TTable extends MySqlTable>(
	table: TTable,
	groupColumns: (keyof TTable & string)[],
	orderColumn: keyof TTable & string,
	matchColumn: keyof TTable & string,
	matchValues: string[],
): SQL => {
	const later = alias(table, "later");

	const laterColumn = (name: keyof TTable & string): MySqlColumn =>
		later[name as keyof typeof later] as MySqlColumn;
	const outerColumn = (name: keyof TTable & string): MySqlColumn =>
		table[name as keyof typeof table] as MySqlColumn;

	const groupConditions = groupColumns.map((column) =>
		eq(laterColumn(column), outerColumn(column)),
	);

	// `${later}` alone (interpolated directly as a `FROM` target) renders
	// only the alias's quoted name, not `` `<table>` AS `later` `` — MySQL
	// then has no idea what `later` refers to. `getTableName(table)` +
	// `sql.identifier` spells the real table name out explicitly instead;
	// `later`'s column refs (used below in the `WHERE`) still render
	// correctly qualified by the alias regardless.
	return sql`NOT EXISTS (
		SELECT 1 FROM ${sql.identifier(getTableName(table))} AS later
		WHERE ${and(
			...groupConditions,
			inArray(laterColumn(matchColumn), matchValues),
			gt(laterColumn(orderColumn), outerColumn(orderColumn)),
		)}
	)`;
};

export const buildOrder = <TTable extends MySqlTable, TModel>(
	table: TTable,
	order?: OrderClause<TModel>,
): SQL<unknown>[] => {
	// MySQL has no `NULLS LAST`/`NULLS FIRST` clause — `(column IS NULL)`
	// evaluates to 0/1, so ordering by it first pushes NULLs to the requested
	// end regardless of the column's own sort direction.
	if (!order || Object.keys(order).length === 0) {
		const defaultColumn = table["created_at" as keyof typeof table] as
			| MySqlColumn
			| undefined;
		return defaultColumn
			? [sql`${defaultColumn} IS NULL`, desc(defaultColumn)]
			: [];
	}

	return Object.entries(order)
		.filter(([key]) => key !== "_sql")
		.flatMap((entry): SQL<unknown>[] => {
			const [key, direction] = entry;
			const column = table[key as keyof typeof table] as MySqlColumn;
			if (!column) throw new Error(`Invalid sort column: ${key}`);

			const dir = direction as unknown as OrderDirection;
			return dir === "desc"
				? [sql`${column} IS NULL`, desc(column)]
				: [sql`${column} IS NOT NULL`, asc(column)];
		});
};

export const buildGroup = <TTable extends MySqlTable>(
	table: TTable,
	field: string | keyof TTable,
): MySqlColumn => {
	const column = table[field as keyof typeof table] as MySqlColumn;
	if (!column) throw new Error(`Invalid groupBy field: ${String(field)}`);
	return column;
};

/**
 * Resolves a table's single-column primary key. Every table in this schema
 * has one (`id`, `patient_id`, `referral_id`, `history_id`, `audit_id`, ...)
 * — nothing here assumes the column is literally named `id`.
 */
export const getPrimaryKeyColumn = (table: MySqlTable): MySqlColumn => {
	const columns = getTableColumns(table);
	const pk = Object.values(columns).find(
		(column) => (column as MySqlColumn).primary,
	);

	if (!pk) {
		throw new Error(
			"Table has no primary key column — cannot key off it for counts/relations/writes.",
		);
	}

	return pk as MySqlColumn;
};

export const buildCounts = async <TMain, TRelations = unknown>(
	db: Executor,
	mainRecords: TMain[],
	countSelect: CountClause<TRelations>["select"],
	countConfigs: Record<string, CountConfig>,
	mainIdField: string = "id",
): Promise<Record<string, Record<string, number>>> => {
	const counts: Record<string, Record<string, number>> = {};

	const mainIds = mainRecords
		.map((r) => (r as Record<string, unknown>)[mainIdField])
		.filter(Boolean);

	if (mainIds.length === 0) return counts;

	const entries = Object.entries(countSelect ?? {}) as [
		string,
		boolean | { where?: Record<string, unknown> },
	][];

	await Promise.all(
		entries.map(async ([relationName, countConfig]) => {
			const shouldCount =
				countConfig === true ||
				(typeof countConfig === "object" && countConfig !== null);

			if (!shouldCount) return;

			const config = countConfigs[relationName];
			if (!config) return;

			const { table, foreignKey } = config;

			const whereConditions: Record<string, unknown> = {
				[foreignKey]: { in: mainIds },
			};

			if (typeof countConfig === "object" && countConfig.where) {
				Object.assign(whereConditions, countConfig.where);
			}

			const where = buildWhere(table, whereConditions);

			const relationCounts = await db
				.select({
					ref_id: table[foreignKey as keyof typeof table] as MySqlColumn,
					count: sql<number>`count(*)`,
				})
				.from(table)
				.where(where)
				.groupBy(table[foreignKey as keyof typeof table] as MySqlColumn);

			for (const { ref_id, count } of relationCounts) {
				const id = String(ref_id);
				if (!counts[id]) counts[id] = {};
				counts[id][relationName] = Number(count);
			}
		}),
	);

	for (const id of mainIds) {
		const strId = String(id);
		if (!counts[strId]) counts[strId] = {};
		for (const [relationName, shouldCount] of entries) {
			if (shouldCount && counts[strId][relationName] === undefined) {
				counts[strId][relationName] = 0;
			}
		}
	}

	return counts;
};

export const buildRelations = async <TMain, TRelations>(
	db: Executor,
	mainRecords: TMain[],
	include: IncludeClause<TRelations> | undefined,
	relationConfigs: Record<string, RelationConfig>,
	mainTable: MySqlTable,
	originalSelect: Record<string, boolean>,
): Promise<TMain[]> => {
	if (!include || mainRecords.length === 0) return mainRecords;

	const pkColumn = getPrimaryKeyColumn(mainTable);
	const pk = pkColumn.name;

	// Check which foreign keys are missing and which were explicitly requested
	const missingForeignKeys: string[] = [];
	const explicitlyRequestedForeignKeys = new Set<string>();

	for (const [relationName] of Object.entries(include)) {
		const config = relationConfigs[relationName];
		if (!config) continue;

		const foreignKeyField = config.references;

		// Check if it was explicitly requested in the original select
		if (originalSelect[foreignKeyField] === true) {
			explicitlyRequestedForeignKeys.add(foreignKeyField);
		}

		// Check if the foreign key exists in the records
		const hasForeignKey = mainRecords.some(
			(r: any) => r[foreignKeyField] !== undefined,
		);

		if (!hasForeignKey) {
			missingForeignKeys.push(foreignKeyField);
		}
	}

	// Re-query to get missing foreign keys if needed
	let recordsWithForeignKeys = mainRecords;
	if (missingForeignKeys.length > 0) {
		const ids = mainRecords.map((r: any) => r[pk]).filter(Boolean);

		if (ids.length === 0) return mainRecords;

		// Build select with original fields + missing foreign keys
		const selectWithForeignKeys: Record<string, boolean> = {
			...originalSelect,
			[pk]: true, // Always need the PK to match back
		};

		for (const fk of missingForeignKeys) {
			selectWithForeignKeys[fk] = true;
		}

		const select = buildSelect(mainTable, selectWithForeignKeys);

		const reQueried = await db
			.select(select)
			.from(mainTable)
			.where(inArray(pkColumn, ids));

		// Merge the foreign keys back into original records
		recordsWithForeignKeys = mainRecords.map((record: any) => {
			const matched = reQueried.find((r: any) => r[pk] === record[pk]);
			if (matched) {
				// Only add the missing foreign keys
				const merged = { ...record };
				for (const fk of missingForeignKeys) {
					merged[fk] = matched[fk];
				}
				return merged;
			}
			return record;
		});
	}

	const results = await Promise.all(
		Object.entries(include).map(async ([relationName, relationOptions]) => {
			const config = relationConfigs[relationName];
			if (!config) return null;

			const ids = recordsWithForeignKeys
				.map((r: any) => r[config.references])
				.filter(Boolean);

			// Every record's FK is null (e.g. no referral in this batch has an
			// assigned doctor) — skip the query, but still report an empty
			// result so the attach step below sets null/[] instead of omitting
			// the key entirely (which fails response-schema validation).
			if (ids.length === 0) {
				return {
					relationName,
					config,
					relatedRecords: [] as any[],
					foreignKeyExplicitlyRequested: false,
				};
			}

			const isBoolean = typeof relationOptions === "boolean";
			const options = isBoolean
				? ({} as Partial<GenericManyOptions<any>>)
				: (relationOptions as GenericManyOptions<any>);

			// Build where clause for the relation
			const relationWhere: any = { ...options.where };
			relationWhere[config.foreignKey] = { in: ids };

			const where = buildWhere(config.table, relationWhere);

			// Track if foreign key was explicitly requested
			const foreignKeyExplicitlyRequested =
				options.select?.[config.foreignKey] === true;

			// `include: { relation: true }` (bare boolean, no explicit `select`)
			// means "give me the whole related record" — without this fallback,
			// only the foreign key itself gets selected, and since it's then
			// stripped as "not explicitly requested" below, the relation would
			// always resolve to `{}`.
			const baseSelect =
				options.select ??
				Object.fromEntries(
					Object.keys(getTableColumns(config.table)).map((key) => [key, true]),
				);

			// IMPORTANT: Always include the foreign key in the selection for matching
			const select = buildSelect(config.table, {
				...baseSelect,
				[config.foreignKey]: true, // Force include foreign key
			});

			const order = buildOrder(config.table, options.order);

			let query = db.select(select).from(config.table).where(where);

			if (order.length > 0) {
				query = query.orderBy(...order) as any;
			}

			const limit =
				options.limit !== undefined ? Number(options.limit) : undefined;

			const page =
				options.page !== undefined ? Number(options.page) : undefined;

			const offset =
				page !== undefined && limit !== undefined
					? (page - DEFAULT_PAGE_NUMBER) * limit
					: undefined;

			if (limit !== undefined) query = query.limit(limit) as any;
			if (offset !== undefined) query = query.offset(offset) as any;

			const relatedRecords = await query;

			return {
				relationName,
				relatedRecords,
				config,
				foreignKeyExplicitlyRequested,
			};
		}),
	);

	// Attach relations to main records
	return recordsWithForeignKeys.map((record: any) => {
		const enrichedRecord = { ...record };

		for (const result of results) {
			if (!result) continue;

			const {
				relationName,
				relatedRecords,
				config,
				foreignKeyExplicitlyRequested,
			} = result;

			if (config.type === "one") {
				// For 'one' relations: e.g. referral.doctor matches user.id
				const relatedRecord = relatedRecords.find(
					(r: any) => r[config.foreignKey] === record[config.references],
				);

				// Remove foreign key if it wasn't explicitly requested
				if (relatedRecord && !foreignKeyExplicitlyRequested) {
					const { [config.foreignKey]: _, ...cleanRecord } = relatedRecord;
					enrichedRecord[relationName] = cleanRecord;
				} else {
					enrichedRecord[relationName] = relatedRecord || null;
				}
			} else {
				// For 'many' relations: e.g. referral.patient_id matches patient.patient_id
				const relatedRecordsFiltered = relatedRecords.filter(
					(r: any) => r[config.foreignKey] === record[config.references],
				);

				// Remove foreign key from each record if it wasn't explicitly requested
				if (!foreignKeyExplicitlyRequested) {
					enrichedRecord[relationName] = relatedRecordsFiltered.map(
						(r: any) => {
							const { [config.foreignKey]: _, ...cleanRecord } = r;
							return cleanRecord;
						},
					);
				} else {
					enrichedRecord[relationName] = relatedRecordsFiltered;
				}
			}
		}

		// Remove auto-included foreign keys that weren't explicitly requested
		for (const fk of missingForeignKeys) {
			if (!explicitlyRequestedForeignKeys.has(fk)) {
				delete enrichedRecord[fk];
			}
		}

		return enrichedRecord;
	});
};

/* ═══════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

export const extractCount = (
	result: Array<{ count: number | string }>,
): number => {
	return Number(result[0]?.count || 0);
};

/* ═══════════════════════════════════════════════════════════════
   GENERIC REPOSITORY OPERATIONS - shared CRUD shape, reused by
   every repo class (User, Session, Verification, and future ones)
   ═══════════════════════════════════════════════════════════════ */

export const manyRecords = async <TModel>(
	executor: Executor,
	table: MySqlTable,
	options: FindAllOptions<TModel>,
	relationConfigs?: Record<string, RelationConfig>,
	countConfigs?: Record<string, CountConfig>,
): Promise<Pagination<TModel>> => {
	const where = buildWhere(table, options.where);
	const order = buildOrder(table, options.order);
	const select = buildSelect(table, options.select);

	const limit = options.limit ?? DEFAULT_PAGE_LIMIT;
	const page = options.page ?? DEFAULT_PAGE_NUMBER;
	const offset = (page - DEFAULT_PAGE_NUMBER) * limit;

	const [filteredResult, records] = await Promise.all([
		executor
			.select({ count: sql<number>`count(*)` })
			.from(table)
			.where(where),
		executor
			.select(select)
			.from(table)
			.where(where)
			.orderBy(...order)
			.limit(limit)
			.offset(offset),
	]);

	let enriched: Record<string, unknown>[] = records;

	if (options.include && relationConfigs && enriched.length > 0) {
		enriched = await buildRelations(
			executor,
			enriched,
			options.include,
			relationConfigs,
			table,
			options.select as Record<string, boolean>,
		);
	}

	if (options._count && countConfigs && enriched.length > 0) {
		const pk = getPrimaryKeyColumn(table).name;

		const counts = await buildCounts(
			executor,
			enriched,
			options._count.select,
			countConfigs,
			pk,
		);

		enriched = enriched.map((record) => ({
			...record,
			_count: counts[record[pk] as string] ?? {},
		}));
	}

	return {
		page,
		limit,
		total: extractCount(filteredResult),
		count: enriched.length,
		data: enriched as TModel[],
	};
};

/**
 * `count()`'s return type depends on whether `groupBy` was passed — a plain
 * `number` without it, a `Record<string, number>` (one entry per distinct
 * value actually present — callers zero-fill any values that returned no
 * rows) with it. Same "shape depends on the options passed" idiom as
 * `WithCount` above.
 */
export type CountResult<TGroupBy> = TGroupBy extends string
	? Record<string, number>
	: number;

/**
 * `COUNT(*)` matching `where` (or the whole table if omitted), optionally
 * `GROUP BY` a single column — one generic primitive for both a flat
 * dashboard total and a per-status/per-priority breakdown, rather than a
 * separate named method per grouped column.
 */
export const countRecords = async <
	TModel,
	TGroupBy extends keyof TModel & string = never,
>(
	executor: Executor,
	table: MySqlTable,
	where?: WhereClause<TModel>,
	groupBy?: TGroupBy,
): Promise<CountResult<TGroupBy>> => {
	const condition = buildWhere(table, where);

	if (!groupBy) {
		const result = await executor
			.select({ count: sql<number>`count(*)` })
			.from(table)
			.where(condition);

		return extractCount(result) as CountResult<TGroupBy>;
	}

	const column = table[groupBy as keyof typeof table] as MySqlColumn;
	if (!column) throw new Error(`Invalid column: ${groupBy}`);

	const rows = await executor
		.select({ key: column, count: sql<number>`count(*)` })
		.from(table)
		.where(condition)
		.groupBy(column);

	const counts: Record<string, number> = {};
	for (const row of rows as { key: unknown; count: number }[]) {
		counts[String(row.key)] = Number(row.count);
	}

	return counts as CountResult<TGroupBy>;
};

export const oneRecord = async <TModel, TRelations = unknown>(
	executor: Executor,
	table: MySqlTable,
	options: FindUniqueOptions<TModel, TRelations>,
	relationConfigs?: Record<string, RelationConfig>,
	countConfigs?: Record<string, CountConfig>,
): Promise<Record<string, unknown> | null> => {
	const where = buildWhere(table, options.where);
	if (!where) {
		throw new Error("At least one where condition is required for findUnique");
	}

	const select = buildSelect(table, options.select);

	const [record] = await executor
		.select(select)
		.from(table)
		.where(where)
		.limit(1);

	if (!record) return null;

	let enriched: Record<string, unknown> = record;

	if (options.include && relationConfigs) {
		const [result] = await buildRelations(
			executor,
			[enriched],
			options.include,
			relationConfigs,
			table,
			options.select as Record<string, boolean>,
		);
		enriched = result;
	}

	if (options._count && countConfigs) {
		const pk = getPrimaryKeyColumn(table).name;

		const counts = await buildCounts(
			executor,
			[enriched],
			options._count.select,
			countConfigs,
			pk,
		);
		enriched = { ...enriched, _count: counts[enriched[pk] as string] ?? {} };
	}

	return enriched;
};

// MySQL's Drizzle driver has no `.returning()` — every write below does a
// plain write, then a re-select keyed off `getPrimaryKeyColumn(table)`.

export const createRecords = async <TInsert, TModel>(
	executor: Executor,
	table: MySqlTable,
	options: CreateOptions<TInsert, TModel>,
): Promise<TModel[]> => {
	const select = buildSelect(table, options.select);
	const data = Array.isArray(options.data) ? options.data : [options.data];

	const pkColumn = getPrimaryKeyColumn(table);
	const pk = pkColumn.name;

	const explicitIds = data
		.map((row) => (row as Record<string, unknown>)[pk])
		.filter((id): id is string | number => id !== undefined && id !== null);

	const [result] = (await executor.insert(table).values(data)) as unknown as [
		{ insertId: number },
	];

	let ids: (string | number)[];

	if (explicitIds.length === data.length) {
		// Caller supplied the primary key explicitly (e.g. a generated uuid).
		ids = explicitIds;
	} else if (result.insertId) {
		// Autoincrement PK — MySQL guarantees consecutive ids within a single
		// batch INSERT statement, so a window from insertId is safe.
		ids = Array.from({ length: data.length }, (_, i) => result.insertId + i);
	} else {
		throw new Error(
			"Insert returned no insertId and no explicit primary key was supplied.",
		);
	}

	return (await executor
		.select(select)
		.from(table)
		.where(inArray(pkColumn, ids))) as TModel[];
};

export const updateRecords = async <TInsert, TModel>(
	executor: Executor,
	table: MySqlTable,
	options: UpdateOptions<TInsert, TModel>,
): Promise<TModel[]> => {
	const where = buildWhere(table, options.where);
	if (!where) {
		throw new Error("At least one where condition is required for update");
	}

	const pkColumn = getPrimaryKeyColumn(table);

	// Capture which rows match *before* writing — the update itself might
	// change the very columns `where` filtered on.
	const targets = await executor
		.select({ pk: pkColumn })
		.from(table)
		.where(where);

	if (targets.length === 0) return [];

	const ids = targets.map((target) => target.pk as string | number);

	/**
	 * Not every table has an `updated_at` column (e.g. `logins`) — only
	 * stamp it when the column actually exists.
	 */
	const columns = getTableColumns(table);
	const data =
		"updated_at" in columns
			? { ...options.data, updated_at: new Date() }
			: options.data;

	await executor.update(table).set(data).where(where);

	const select = buildSelect(table, options.select);

	return (await executor
		.select(select)
		.from(table)
		.where(inArray(pkColumn, ids))) as TModel[];
};

export const deleteRecords = async <TModel>(
	executor: Executor,
	table: MySqlTable,
	options: DeleteOptions<TModel>,
): Promise<TModel[]> => {
	const where = buildWhere(table, options.where);
	if (!where) {
		throw new Error("At least one where condition is required for delete");
	}

	const select = buildSelect(table, options.select);

	// Capture the rows before they're gone — there's nothing left to
	// re-select afterward.
	const targets = (await executor
		.select(select)
		.from(table)
		.where(where)) as TModel[];

	if (targets.length === 0) return [];

	await executor.delete(table).where(where);

	return targets;
};
