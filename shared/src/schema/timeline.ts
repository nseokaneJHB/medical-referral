import { z } from "zod";

import { uuidSchema, stringSchema, userRefSchema } from "./field";

import { globalResponseSchema, paginatedGlobalResponseSchema } from "./global";

import { TIMELINE_TYPE, TIMELINE_ACTION } from "../constant";

export const timelineTypeSchema = z
	.enum(TIMELINE_TYPE)
	.describe("Which entity a timeline row is about");

export const timelineActionSchema = z
	.enum(TIMELINE_ACTION)
	.describe("What kind of change/action a timeline row records");

/**
 * A single entry in the generalized, append-only `timeline` audit log —
 * covers User, Facility, and Referral status/moderation history in one
 * shared shape.
 *
 * `previous`/`next` are both nullable — `APPEAL_SUBMITTED`/`APPEAL_DENIED`
 * don't represent a value transition, so both are `null` for those rows.
 * `notes` is the free-text reason/comment behind the action — a rejection
 * reason, a flag reason, a reviewer's comment on an appeal decision; the
 * one place a human explains "why" for anything this table records.
 */
export const TimelineSchema = z.object({
	id: uuidSchema,
	type: timelineTypeSchema,
	entity: uuidSchema,
	action: timelineActionSchema,
	previous: stringSchema.nullable(),
	next: stringSchema.nullable(),
	changer: userRefSchema,
	notes: stringSchema.nullable(),
	changed_at: z.date(),
});

export const timelineListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(TimelineSchema),
});

/**
 * Single-row response — used for `POST /account/appeal` (echoes the
 * created `APPEAL_SUBMITTED` row) and the appeal-decision endpoints in
 * `administrator`/`manager` (echoes the created `APPEAL_APPROVED`/
 * `APPEAL_DENIED` row), regardless of whether the underlying entity was a
 * User or a Facility — one uniform response shape either way.
 */
export const timelineResponseSchema = globalResponseSchema.extend({
	data: TimelineSchema,
});
