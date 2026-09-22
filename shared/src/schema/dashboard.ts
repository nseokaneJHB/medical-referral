import { z } from "zod";

import { integerSchema } from "./field";

import { globalResponseSchema } from "./global";

/**
 * Widget counts per the PDF's Nurse Dashboard: "Referrals Created, Pending
 * Referrals, Canceled Referrals, Referrals on hold".
 */
export const nurseSummarySchema = z.object({
	referrals_created: integerSchema,
	pending: integerSchema,
	canceled: integerSchema,
	on_hold: integerSchema,
});

/**
 * Widget counts per the PDF's Doctor Dashboard: "My Referrals, Accepted
 * Referrals, Pending Referral, Completed Referrals".
 */
export const doctorSummarySchema = z.object({
	my_referrals: integerSchema,
	accepted: integerSchema,
	pending: integerSchema,
	completed: integerSchema,
});

/**
 * Widget counts per the PDF's Administrator Dashboard: totals plus a
 * referral breakdown across every status.
 */
export const adminSummarySchema = z.object({
	total_users: integerSchema,
	total_patients: integerSchema,
	total_facilities: integerSchema,
	total_referrals: integerSchema,
	pending: integerSchema,
	accepted: integerSchema,
	in_progress: integerSchema,
	on_hold: integerSchema,
	completed: integerSchema,
	rejected: integerSchema,
	canceled: integerSchema,
});

/**
 * Facility-scoped version of `adminSummarySchema` — a Manager's own staff/
 * patients/referrals instead of system-wide totals.
 *
 * `pending_staff_applications`/`pending_transfers` are the "pending-actions
 * count" from `docs/roles-permissions.md`'s Dashboard section — outstanding
 * Nurse/Doctor applications at this Manager's facility, and open patient
 * transfer requests awaiting *this* Manager's decision on either side
 * (`GET /manager/transfers` is the actual queue; this is just the count).
 */
export const managerSummarySchema = z.object({
	total_staff: integerSchema,
	total_patients: integerSchema,
	total_referrals: integerSchema,
	pending: integerSchema,
	accepted: integerSchema,
	in_progress: integerSchema,
	on_hold: integerSchema,
	completed: integerSchema,
	rejected: integerSchema,
	canceled: integerSchema,
	pending_staff_applications: integerSchema,
	pending_transfers: integerSchema,
});

export const nurseSummaryResponseSchema = globalResponseSchema.extend({
	data: nurseSummarySchema,
});

export const doctorSummaryResponseSchema = globalResponseSchema.extend({
	data: doctorSummarySchema,
});

export const adminSummaryResponseSchema = globalResponseSchema.extend({
	data: adminSummarySchema,
});

export const managerSummaryResponseSchema = globalResponseSchema.extend({
	data: managerSummarySchema,
});
