import { z } from "zod";

import {
	ReferralSchema,
	ReferralStatusEnum,
	PriorityEnum,
	LoginStatusEnum,
	CreateReferralSchema,
	UpdateReferralSchema,
	referralParamsSchema,
	referralsQuerySchema,
	referralResponseSchema,
	referralListResponseSchema,
	UpdateReferralStatusSchema,
	ReferralsReportSchema,
	referralsReportQuerySchema,
	referralsReportResponseSchema,
} from "../schema/referral";

export type Referral = z.infer<typeof ReferralSchema>;
export type ReferralStatus = z.infer<typeof ReferralStatusEnum>;
export type Priority = z.infer<typeof PriorityEnum>;
export type LoginStatus = z.infer<typeof LoginStatusEnum>;

export type CreateReferralBody = z.infer<typeof CreateReferralSchema>;
export type UpdateReferralBody = z.infer<typeof UpdateReferralSchema>;
export type UpdateReferralStatusBody = z.infer<
	typeof UpdateReferralStatusSchema
>;
export type ReferralParams = z.infer<typeof referralParamsSchema>;
export type ReferralsQuery = z.infer<typeof referralsQuerySchema>;
export type ReferralResponse = z.infer<typeof referralResponseSchema>;
export type ReferralListResponse = z.infer<typeof referralListResponseSchema>;

export type ReferralsReport = z.infer<typeof ReferralsReportSchema>;
export type ReferralsReportQuery = z.infer<typeof referralsReportQuerySchema>;
export type ReferralsReportResponse = z.infer<
	typeof referralsReportResponseSchema
>;
