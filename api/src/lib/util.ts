import { z } from "zod";
import { randomBytes } from "node:crypto";

import { v7 as uuidv7 } from "uuid";

/**
 * Generate a unique ID using UUID v7.
 *
 * @returns {string} A unique ID.
 */
export const generateUuid = (): string => uuidv7();

/**
 * Generates a one-time password for accounts an Administrator creates
 * directly (`POST /administrator/users`) or for `bootstrap-admin.ts`'s
 * first-run Administrator — no email infrastructure exists yet, so this is
 * returned once to the creator/operator to relay out-of-band, alongside
 * `must_change_password: true` on the created row.
 *
 * @returns {string} A 16-character base64url password, well above
 * better-auth's 8-character `minPasswordLength`.
 */
export const generateTemporaryPassword = (): string =>
	randomBytes(12).toString("base64url");

/**
 * A field counts as "nullable text" if, after stripping any `.optional()`/
 * `.default()` wrapper (present once a create schema is `.partial()`'d for
 * an update), what's left is `.nullable()` wrapping a plain `z.string()`.
 */
const isNullableStringField = (field: unknown): boolean => {
	let current = field;

	while (current instanceof z.ZodOptional || current instanceof z.ZodDefault) {
		current = current.unwrap();
	}

	return (
		current instanceof z.ZodNullable && current.unwrap() instanceof z.ZodString
	);
};

/**
 * Trims and collapses a blank/whitespace-only string to `null` — "no
 * value" — for every field `schema` declares as nullable text, leaving
 * `null`/`undefined`/non-string values untouched. Driven by the schema
 * itself (rather than a hand-maintained field list) so any create/update
 * schema with `.nullable()` string fields can reuse this without also
 * having to keep a matching field-name list in sync.
 *
 * Pairs with schemas that validate these fields as `string | null` without
 * a `.min(1)` (so `""` passes validation on purpose) — the schema's job is
 * shape, not the "blank means no value" business rule, which lives here.
 *
 * @param body - The request body to normalize (not mutated).
 * @param schema - The Zod object schema `body` was already validated
 * against — inspected only for its shape, not re-parsed.
 * @returns A shallow copy of `body` with the matching fields normalized.
 */
export const normalizeNullableFields = <T extends Record<string, unknown>>(
	body: T,
	schema: { shape: Record<string, unknown> },
): T => {
	const normalized = { ...body };

	for (const [key, field] of Object.entries(schema.shape)) {
		if (!(key in normalized) || !isNullableStringField(field)) continue;

		const value = normalized[key as keyof T];
		if (typeof value !== "string") continue;

		const trimmed = value.trim();
		normalized[key as keyof T] = (
			trimmed === "" ? null : trimmed
		) as T[keyof T];
	}

	return normalized;
};
