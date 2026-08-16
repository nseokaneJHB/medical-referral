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
 * `core.X.count(where, groupBy)` only returns entries for values that
 * actually have matching rows — zero-fills every value of `enumObject`
 * (e.g. `REFERRAL_STATUS`, `PRIORITY`) that came back missing, so a
 * dashboard/report breakdown always has a consistent, complete shape
 * regardless of what data exists.
 *
 * @example
 * zeroFillCounts(await core.referral.count(where, "status"), REFERRAL_STATUS)
 * // { PENDING: 3, ACCEPTED: 0, ... } — every status present, not just PENDING
 */
export const zeroFillCounts = <T extends Record<string, string>>(
	counts: Record<string, number>,
	enumObject: T,
): Record<T[keyof T], number> => {
	const keys = Object.values(enumObject) as T[keyof T][];

	const filled = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
		T[keyof T],
		number
	>;

	for (const key of keys) {
		if (counts[key] !== undefined) filled[key] = counts[key];
	}

	return filled;
};

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

/**
 * Converts a bare `YYYY-MM-DD` date string into the UTC instant that
 * represents local midnight for a viewer at `tzOffsetMinutes` (the
 * `Date.prototype.getTimezoneOffset()` convention: UTC minus local, in
 * minutes — e.g. `-120` for UTC+2). Falls back to UTC midnight when no
 * offset is supplied.
 */
export const localDateStartToUtc = (
	dateStr: string,
	tzOffsetMinutes?: string,
): Date => {
	const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`);
	const offset = tzOffsetMinutes ? Number(tzOffsetMinutes) : 0;
	if (Number.isNaN(offset)) return utcMidnight;
	return new Date(utcMidnight.getTime() + offset * 60000);
};

/**
 * The start of the current calendar month in the viewer's local timezone
 * (same `tzOffsetMinutes` convention as `localDateStartToUtc`), returned
 * as a UTC instant. Falls back to UTC when no offset is supplied.
 */
export const localMonthStartToUtc = (tzOffsetMinutes?: string): Date => {
	const offset = tzOffsetMinutes ? Number(tzOffsetMinutes) : 0;
	const safeOffset = Number.isNaN(offset) ? 0 : offset;
	const now = new Date();
	const localNow = new Date(now.getTime() - safeOffset * 60000);
	return new Date(
		Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1) +
			safeOffset * 60000,
	);
};
