import type { MySqlTable } from "drizzle-orm/mysql-core";
import { z } from "zod";

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
	if (invalid) throw new Error(`Invalid sort column: ${invalid}`);

	return columns;
};
