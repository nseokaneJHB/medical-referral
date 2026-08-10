import { z } from "zod";

import { uuidSchema, stringSchema } from "./field";

/**
 * Shared body/params shapes for the moderation actions introduced by the
 * registration/approval-chain redesign — used across `modules/account`,
 * `modules/administrator`, and `modules/manager`.
 */

/** Punitive actions (reject/disable/flag/suspend) — a reason is required. */
export const moderationReasonSchema = z.object({
	reason: stringSchema.min(1, "A reason is required."),
});

/** Approving something — a note is optional, not required. */
export const approveActionSchema = z.object({
	notes: stringSchema.optional(),
});

/** Submitting an appeal (`POST /account/appeal`, `POST /manager/facility/appeal`). */
export const appealSchema = z.object({
	reason: stringSchema.min(1, "A reason is required."),
});

/** Deciding an appeal — the reviewer's comment is required either way. */
export const appealDecisionSchema = z.object({
	notes: stringSchema.min(1, "A comment is required when deciding an appeal."),
});

/** `:id` on an appeal-decision route is a `timeline` row id, not an entity id. */
export const appealParamsSchema = z.object({
	id: uuidSchema,
});
