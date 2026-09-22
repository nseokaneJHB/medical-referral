import { z } from "zod";

import {
	referralSchema,
	createReferralSchema,
	updateReferralSchema,
	referralParamsSchema,
	referralsQuerySchema,
	referralResponseSchema,
	redirectReferralSchema,
	referralListResponseSchema,
	updateReferralStatusSchema,
	referralsReportSchema,
	referralsReportQuerySchema,
	referralsReportResponseSchema,
} from "../schema/referral";

export type Referral = z.infer<typeof referralSchema>;

export type CreateReferralBody = z.infer<typeof createReferralSchema>;
export type UpdateReferralBody = z.infer<typeof updateReferralSchema>;
export type UpdateReferralStatusBody = z.infer<
	typeof updateReferralStatusSchema
>;
export type RedirectReferralBody = z.infer<typeof redirectReferralSchema>;
export type ReferralParams = z.infer<typeof referralParamsSchema>;
export type ReferralsQuery = z.infer<typeof referralsQuerySchema>;
export type ReferralResponse = z.infer<typeof referralResponseSchema>;
export type ReferralListResponse = z.infer<typeof referralListResponseSchema>;

export type ReferralsReport = z.infer<typeof referralsReportSchema>;
export type ReferralsReportQuery = z.infer<typeof referralsReportQuerySchema>;
export type ReferralsReportResponse = z.infer<
	typeof referralsReportResponseSchema
>;
