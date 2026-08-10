import { z } from "zod";

import { integerSchema } from "./field";

import { globalResponseSchema } from "./global";

/**
 * Widget counts per the PDF's Nurse Dashboard: "Referrals Created, Pending
 * Referrals, Canceled Referrals, Referrals on hold".
 */
export const NurseSummarySchema = z.object({
	referrals_created: integerSchema,
	pending: integerSchema,
	canceled: integerSchema,
	on_hold: integerSchema,
});

/**
 * Widget counts per the PDF's Doctor Dashboard: "My Referrals, Accepted
 * Referrals, Pending Referral, Completed Referrals".
 */
export const DoctorSummarySchema = z.object({
	my_referrals: integerSchema,
	accepted: integerSchema,
	pending: integerSchema,
	completed: integerSchema,
});

/**
 * Widget counts per the PDF's Administrator Dashboard: totals plus a
 * referral breakdown across every status.
 */
export const AdminSummarySchema = z.object({
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
 * Facility-scoped version of `AdminSummarySchema` — a Manager's own staff/
 * patients/referrals instead of system-wide totals.
 */
export const ManagerSummarySchema = z.object({
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
});

export const nurseSummaryResponseSchema = globalResponseSchema.extend({
	data: NurseSummarySchema,
});

export const doctorSummaryResponseSchema = globalResponseSchema.extend({
	data: DoctorSummarySchema,
});

export const adminSummaryResponseSchema = globalResponseSchema.extend({
	data: AdminSummarySchema,
});

export const managerSummaryResponseSchema = globalResponseSchema.extend({
	data: ManagerSummarySchema,
});
