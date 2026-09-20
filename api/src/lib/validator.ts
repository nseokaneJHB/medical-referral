import type { MySqlTable } from "drizzle-orm/mysql-core";
import { z } from "zod";

import {
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
} from "@referral-tracking/shared";

import type { OrderClause, OrderDirection } from "../core/helpers";

export const parseEnumList = <T extends z.ZodTypeAny>(
	value: string | undefined,
	enumSchema: T,
): Array<z.infer<T>> | undefined => {
	if (!value) return undefined;

	const values = value.split(",");

	return z.array(enumSchema).parse(values);
};

export const parseSortList = <TTable extends MySqlTable>(
	value: string | undefined,
	model: TTable,
	fallback: string,
): string[] => {
	if (!value) return [fallback];

	const columns = value.split(",");
	const validColumns = Object.keys(model);

	const invalid = columns.find((column) => !validColumns.includes(column));
	if (invalid) {
		const error = new Error(`Invalid sort column: ${invalid}`) as Error & {
			statusCode: number;
		};
		error.statusCode = 400;
		throw error;
	}

	return columns;
};

/** Parses page/limit query params, falling back to the app defaults when absent. */
export const parsePagination = (query: {
	page?: string;
	limit?: string;
}): { page: number; limit: number } => ({
	page: query.page ? Number(query.page) : DEFAULT_PAGE_NUMBER,
	limit: query.limit ? Number(query.limit) : DEFAULT_PAGE_LIMIT,
});

/** Pairs `sorts` (column names) with `orders` (directions) positionally, repeating the first/fallback direction once `orders` runs out. */
export const buildOrderClause = <TModel>(
	sorts: string[],
	orders: OrderDirection[],
	fallbackDirection: OrderDirection,
): OrderClause<TModel> =>
	Object.fromEntries(
		sorts.map((sorting, index) => [
			sorting,
			orders[index] || orders[0] || fallbackDirection,
		]),
	) as OrderClause<TModel>;
