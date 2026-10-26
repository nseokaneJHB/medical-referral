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

export type Database = MySql2Database<Record<string, any>>;

/** The exact type Drizzle hands you inside `database.transaction(async (tx) => ...)`, derived from the connection so it can't drift out of sync with the installed drizzle-orm version. */
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type Executor = Database | Transaction;

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

/** "Only rows not superseded by a later row" for append-only tables — see `buildWhere`'s `NOT_SUPERSEDED_BY` handling. */
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

export type CountOptions<
	TModel,
	TGroupBy extends keyof TModel & string = never,
> = {
	where?: WhereClause<TModel>;
	groupBy?: TGroupBy;
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

/** Adds the relation counts requested through `_count.select` to a record's type, mirroring what `manyRecords`/`oneRecord` attach at runtime. */
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

/** Adds the relations requested through an `include` clause to a record's type, same "shape depends on options" idiom as `WithCount`. */
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
	count: number;
	total: number;
};

type RelationConfig = {
	table: MySqlTable;
	foreignKey: string;
	references: string;
	type: "one" | "many";
};

type CountConfig = Omit<RelationConfig, "type">;

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

/** Builds the Drizzle column-selection map for a `select` clause, throwing on an unknown column or an empty selection. */
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

/** Translates a `WhereClause` (including `OR`/`AND`/`NOT_SUPERSEDED_BY`) into a Drizzle `SQL` condition, or `undefined` if empty. */
export const buildWhere = <TTable extends MySqlTable, TModel>(
	table: TTable,
	where?: WhereClause<TModel>,
): SQL<unknown> | undefined => {
	if (!where) return undefined;

	const conditions: SQL<unknown>[] = [];

	for (const [key, value] of Object.entries(where)) {
		if (key === "OR" && Array.isArray(value)) {
			const orConditions = value
				.map((clause) => buildWhere(table, clause))
				.filter(Boolean);
			if (orConditions.length > 0) {
				conditions.push(or(...orConditions)!);
			}
			continue;
		}

		if (key === "AND" && Array.isArray(value)) {
			const andConditions = value
				.map((clause) => buildWhere(table, clause))
				.filter(Boolean);
			if (andConditions.length > 0) {
				conditions.push(and(...andConditions)!);
			}
			continue;
		}

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

		if (value === null || value === undefined) continue;

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
				const escaped = operator.contains.replace(/[\\%_]/g, "\\$&");
				const pattern = `%${escaped}%`;
				if (operator.mode === "insensitive") {
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

/** A `NOT EXISTS` correlated subquery: true unless a later row (by `orderColumn`) in the same group has `matchColumn` in `matchValues` — the append-only "still current" check `buildWhere`'s `NOT_SUPERSEDED_BY` delegates to. */
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

	return sql`NOT EXISTS (
		SELECT 1 FROM ${sql.identifier(getTableName(table))} AS later
		WHERE ${and(
			...groupConditions,
			inArray(laterColumn(matchColumn), matchValues),
			gt(laterColumn(orderColumn), outerColumn(orderColumn)),
		)}
	)`;
};

/** Builds `ORDER BY` clauses, sorting NULLs to the requested end since MySQL has no `NULLS LAST`/`NULLS FIRST`. */
export const buildOrder = <TTable extends MySqlTable, TModel>(
	table: TTable,
	order?: OrderClause<TModel>,
): SQL<unknown>[] => {
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

/** Resolves a `groupBy` field name to its Drizzle column. */
export const buildGroup = <TTable extends MySqlTable>(
	table: TTable,
	field: string | keyof TTable,
): MySqlColumn => {
	const column = table[field as keyof typeof table] as MySqlColumn;
	if (!column) throw new Error(`Invalid groupBy field: ${String(field)}`);
	return column;
};

/** Resolves a table's single-column primary key — every table in this schema has exactly one, not necessarily named `id`. */
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

/** Batch-counts related rows per main record for an `_count.select` clause, keyed by each main record's primary key. */
export const buildCounts = async <TMain, TRelations = unknown>(
	database: Executor,
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

			const relationCounts = await database
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

/** Batch-attaches the relations requested through an `include` clause to a set of main records, re-querying for any foreign keys not already selected. */
export const buildRelations = async <TMain, TRelations>(
	database: Executor,
	mainRecords: TMain[],
	include: IncludeClause<TRelations> | undefined,
	relationConfigs: Record<string, RelationConfig>,
	mainTable: MySqlTable,
	originalSelect: Record<string, boolean>,
): Promise<TMain[]> => {
	if (!include || mainRecords.length === 0) return mainRecords;

	const pkColumn = getPrimaryKeyColumn(mainTable);
	const pk = pkColumn.name;

	const missingForeignKeys: string[] = [];
	const explicitlyRequestedForeignKeys = new Set<string>();

	for (const [relationName] of Object.entries(include)) {
		const config = relationConfigs[relationName];
		if (!config) continue;

		const foreignKeyField = config.references;

		if (originalSelect[foreignKeyField] === true) {
			explicitlyRequestedForeignKeys.add(foreignKeyField);
		}

		const hasForeignKey = mainRecords.some(
			(r: any) => r[foreignKeyField] !== undefined,
		);

		if (!hasForeignKey) {
			missingForeignKeys.push(foreignKeyField);
		}
	}

	let recordsWithForeignKeys = mainRecords;
	if (missingForeignKeys.length > 0) {
		const ids = mainRecords.map((r: any) => r[pk]).filter(Boolean);

		if (ids.length === 0) return mainRecords;

		const selectWithForeignKeys: Record<string, boolean> = {
			...originalSelect,
			[pk]: true,
		};

		for (const fk of missingForeignKeys) {
			selectWithForeignKeys[fk] = true;
		}

		const select = buildSelect(mainTable, selectWithForeignKeys);

		const reQueried = await database
			.select(select)
			.from(mainTable)
			.where(inArray(pkColumn, ids));

		recordsWithForeignKeys = mainRecords.map((record: any) => {
			const matched = reQueried.find((r: any) => r[pk] === record[pk]);
			if (matched) {
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

			const relationWhere: any = { ...options.where };
			relationWhere[config.foreignKey] = { in: ids };

			const where = buildWhere(config.table, relationWhere);

			const foreignKeyExplicitlyRequested =
				options.select?.[config.foreignKey] === true;

			const baseSelect =
				options.select ??
				Object.fromEntries(
					Object.keys(getTableColumns(config.table)).map((key) => [key, true]),
				);

			const select = buildSelect(config.table, {
				...baseSelect,
				[config.foreignKey]: true,
			});

			const order = buildOrder(config.table, options.order);

			let query = database.select(select).from(config.table).where(where);

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
				const relatedRecord = relatedRecords.find(
					(r: any) => r[config.foreignKey] === record[config.references],
				);

				if (relatedRecord && !foreignKeyExplicitlyRequested) {
					const { [config.foreignKey]: _, ...cleanRecord } = relatedRecord;
					enrichedRecord[relationName] = cleanRecord;
				} else {
					enrichedRecord[relationName] = relatedRecord || null;
				}
			} else {
				const relatedRecordsFiltered = relatedRecords.filter(
					(r: any) => r[config.foreignKey] === record[config.references],
				);

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

		for (const fk of missingForeignKeys) {
			if (!explicitlyRequestedForeignKeys.has(fk)) {
				delete enrichedRecord[fk];
			}
		}

		return enrichedRecord;
	});
};

/** Reads the first row's `count` out of a raw `COUNT(*)` result. */
export const extractCount = (
	result: Array<{ count: number | string }>,
): number => {
	return Number(result[0]?.count || 0);
};

/** Paginated `SELECT`, optionally enriched with `include` relations and `_count` — the shared engine behind every table's `xMany`. */
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

/** `count()`'s return type: a plain `number` without `groupBy`, a `Record<string, number>` (zero-filled by callers) with it. */
export type CountResult<TGroupBy> = TGroupBy extends string
	? Record<string, number>
	: number;

/** `COUNT(*)` matching `where`, optionally `GROUP BY` a single column — one primitive for both a flat total and a per-column breakdown. */
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

/** Fetches a single row by `where`, optionally enriched with `include` relations and `_count`. */
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

/** Inserts one or more rows and re-selects them by primary key — MySQL's Drizzle driver has no `.returning()`. */
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
		ids = explicitIds;
	} else if (result.insertId) {
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

/** Updates rows matching `where` and re-selects them by primary key, stamping `updated_at` when the table has that column. */
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

	const targets = await executor
		.select({ pk: pkColumn })
		.from(table)
		.where(where);

	if (targets.length === 0) return [];

	const ids = targets.map((target) => target.pk as string | number);

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

/** Reads rows matching `where`, deletes them, and returns what was captured beforehand since MySQL gives nothing back on delete. */
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

	const targets = (await executor
		.select(select)
		.from(table)
		.where(where)) as TModel[];

	if (targets.length === 0) return [];

	await executor.delete(table).where(where);

	return targets;
};
