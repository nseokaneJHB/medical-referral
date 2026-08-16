import { z } from "zod";

import { uuidSchema, stringSchema, roleSchema, userRefSchema } from "./field";

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
 * An `APPEAL_SUBMITTED` timeline row, enriched with who/what it's about —
 * `entity` alone is just a bare UUID (a user id or a facility id depending
 * on `type`), not enough to render a usable appeals queue. `subject` reuses
 * `userRefSchema`'s shape (`id` + nullable `name`) for both cases; a
 * facility's `name` is never actually null, just typed compatibly.
 */
export const AppealSchema = TimelineSchema.extend({
	subject: userRefSchema,
});

export const appealListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(AppealSchema),
	by_type: z.object({ user: z.number(), facility: z.number() }),
});

/**
 * A `timeline` row enriched with `subject`, scoped to a Manager's own
 * facility — the facility-wide "who did what when" feed covering their
 * staff, their patients, referrals touching their facility, and their
 * facility itself. Same enrichment shape as `AppealSchema` (this isn't
 * appeal-specific — `AppealSchema` is just the subset filtered to
 * `APPEAL_SUBMITTED` rows).
 */
export const ManagerAuditSchema = TimelineSchema.extend({
	subject: userRefSchema.extend({ role: roleSchema.nullable() }),
	reason: stringSchema.nullable(),
});

export const managerAuditListResponseSchema =
	paginatedGlobalResponseSchema.extend({
		data: z.array(ManagerAuditSchema),
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
