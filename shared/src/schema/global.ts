import { z } from "zod";

import { DEFAULT_PAGE_LIMIT, DEFAULT_PAGE_NUMBER } from "../constant";

import {
	stringSchema,
	numberSchema,
	httpCodeSchema,
	orderDirectionSchema,
} from "./field";

/**
 * Generic global pagination query schema
 */
export const paginationSortAndSearchQuerySchema = z
	.object({
		to: z.string().optional().describe("End date for filtering results"),
		from: z.string().optional().describe("Start date for filtering results"),
		sort: stringSchema.optional().describe("Field to sort results by"),
		order: orderDirectionSchema.optional().describe("Sort order (ASC or DESC)"),
		search: stringSchema.optional().describe("Search string to filter results"),
		page: z
			.string()
			.default(`${DEFAULT_PAGE_NUMBER}`)
			.describe("Page number of the results"),
		limit: z
			.string()
			.default(`${DEFAULT_PAGE_LIMIT}`)
			.describe("Number of items per page"),
	})
	.refine(
		(data) =>
			!data.from || !data.to || new Date(data.from) <= new Date(data.to),
		"`from` must be before or equal to `to`",
	);

/**
 * Generic global response schema
 */
export const globalResponseSchema = z.object({
	code: httpCodeSchema,
	message: stringSchema.describe(
		"Human-readable message describing the result",
	),
	redirectUrl: stringSchema
		.optional()
		.describe("URL to redirect the client, if applicable"),
	errors: z
		.array(
			z.object({
				field: stringSchema.describe("Field that failed validation"),
				message: stringSchema.describe("Validation error description"),
			}),
		)
		.optional()
		.describe("List of error details"),
});

export const paginatedGlobalResponseSchema = globalResponseSchema.extend({
	count: numberSchema.describe("Number of items returned in this page"),
	total: numberSchema.describe(
		"Total number of items matching the filter, across all pages",
	),
	page: numberSchema
		.default(DEFAULT_PAGE_NUMBER)
		.describe("Current page number"),
	limit: numberSchema
		.default(DEFAULT_PAGE_LIMIT)
		.describe("Number of items per page"),
});
