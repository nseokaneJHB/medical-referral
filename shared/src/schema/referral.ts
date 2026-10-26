import { z } from "zod";

import {
	uuidSchema,
	stringSchema,
	integerSchema,
	userRefSchema,
	prioritySchema,
	patientRefSchema,
	facilityRefSchema,
	referralStatusSchema,
} from "./field";

import {
	globalResponseSchema,
	paginatedGlobalResponseSchema,
	paginationSortAndSearchQuerySchema,
} from "./global";

import { PRIORITY, REFERRAL_STATUS } from "../constant";

/**
 * Base fields shared by create/update. `priority` has no default here —
 * `.default()` resolves before `.partial()`'s `.optional()` ever sees a
 * missing key, so an update schema built by partializing a defaulted
 * `createReferralSchema` would silently reset `priority` to MEDIUM on every
 * partial `PATCH` that omits it. `createReferralSchema` below layers the
 * default on top for creation only.
 *
 * `origin_facility_id` is deliberately absent here — it's never client-
 * settable, always derived server-side from the referred patient's
 * `facility_id` at creation time (same "read-only, server-derived" pattern
 * as `referrer_id`). Only `destination_facility_id` — the facility the
 * referrer picks to refer the patient to — is part of create/update.
 */
const ReferralBaseSchema = z.object({
	patient_id: uuidSchema,
	destination_facility_id: uuidSchema.describe("Receiving facility"),
	visit_reason: stringSchema
		.min(1)
		.describe("Why the patient is at the facility"),
	referral_reason: stringSchema
		.min(1)
		.describe("Reason for referring to a different facility"),
	priority: prioritySchema,
	doctor: uuidSchema.optional().describe("Assigned doctor's user id"),
});

export const createReferralSchema = ReferralBaseSchema.extend({
	priority: prioritySchema.default(PRIORITY.MEDIUM),
	specialty_ids: z
		.array(uuidSchema)
		.optional()
		.describe(
			"Specialties this referral needs, tagged atomically at creation.",
		),
});

export const updateReferralSchema = ReferralBaseSchema.partial();

/**
 * A reason isn't required moving into `accepted`/`in_progress` (accepting
 * a referral or starting treatment needs no explanation) — every other
 * transition (hold/complete/reject/cancel) still requires one.
 */
const REASON_NOT_REQUIRED_TARGETS: (typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS][] =
	[REFERRAL_STATUS.ACCEPTED, REFERRAL_STATUS.IN_PROGRESS];

export const updateReferralStatusSchema = z
	.object({
		next: referralStatusSchema,
		notes: stringSchema.optional(),
	})
	.superRefine((data, ctx) => {
		if (REASON_NOT_REQUIRED_TARGETS.includes(data.next)) return;
		if (!data.notes?.trim()) {
			ctx.addIssue({
				code: "custom",
				path: ["notes"],
				message: "A reason is required for this status change.",
			});
		}
	});

/** `PATCH /referrals/:id/redirect` — Doctor-only, always requires a reason. */
export const redirectReferralSchema = z.object({
	destination_facility_id: uuidSchema.describe("New receiving facility"),
	notes: stringSchema.min(1, "A reason is required."),
});

/**
 * `status`/`priority` accept comma-separated lists (e.g. `?status=pending,on_hold`)
 * — parsed server-side via `parseEnumList`. `search` matches origin/
 * destination facility and the reason; `sort` any real column.
 */
export const referralsQuerySchema =
	paginationSortAndSearchQuerySchema.safeExtend({
		status: stringSchema.optional(),
		priority: stringSchema.optional(),
		patient_id: uuidSchema
			.optional()
			.describe(
				"Filter to one patient's referrals — e.g. checking for an existing active one before creating another.",
			),
	});

/**
 * A referral row as returned by the API. `created_at`/`updated_at` are typed
 * as `z.date()` since that's what Drizzle hands back for a MySQL `timestamp`
 * column — Fastify's JSON serialization converts them to ISO strings on the
 * wire the same way `JSON.stringify` always has for `Date` values.
 */
export const referralSchema = z.object({
	id: uuidSchema,
	patient: patientRefSchema,
	origin_facility: facilityRefSchema,
	destination_facility: facilityRefSchema,
	visit_reason: stringSchema,
	referral_reason: stringSchema,
	priority: prioritySchema,
	status: referralStatusSchema,
	referrer: userRefSchema,
	assignedDoctor: userRefSchema.nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

export const referralResponseSchema = globalResponseSchema.extend({
	data: referralSchema,
});

export const referralListResponseSchema = paginatedGlobalResponseSchema.extend({
	data: z.array(referralSchema),
	status_counts: z.record(referralStatusSchema, integerSchema),
});

export const referralParamsSchema = z.object({
	id: uuidSchema,
});

/**
 * `GET /reports/referrals` — role-scoped per build-spec.md's Phase 7 table
 * (Admin full, Doctor clinical stats on assigned referrals, Nurse referral
 * stats on created referrals). `from`/`to` filter on `created`.
 */
export const referralsReportQuerySchema = z
	.object({
		to: stringSchema.optional().describe("End date for filtering results"),
		from: stringSchema.optional().describe("Start date for filtering results"),
		tz_offset: stringSchema
			.optional()
			.describe(
				"Client's UTC offset in minutes (Date.prototype.getTimezoneOffset() convention) — anchors `from`/`to` day boundaries to the client's local calendar day instead of UTC",
			),
	})
	.refine(
		(data) =>
			!data.from || !data.to || new Date(data.from) <= new Date(data.to),
		"`from` must be before or equal to `to`",
	);

const referralStatusCountsSchema = z.object({
	pending: integerSchema,
	accepted: integerSchema,
	in_progress: integerSchema,
	on_hold: integerSchema,
	completed: integerSchema,
	rejected: integerSchema,
	canceled: integerSchema,
});

const referralPriorityCountsSchema = z.object({
	low: integerSchema,
	medium: integerSchema,
	high: integerSchema,
	urgent: integerSchema,
});

export const referralsReportSchema = z.object({
	total: integerSchema,
	by_status: referralStatusCountsSchema,
	by_priority: referralPriorityCountsSchema,
});

export const referralsReportResponseSchema = globalResponseSchema.extend({
	data: referralsReportSchema,
});
