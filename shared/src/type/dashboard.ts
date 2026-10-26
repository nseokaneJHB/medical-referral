import { z } from "zod";

import {
	nurseSummarySchema,
	doctorSummarySchema,
	adminSummarySchema,
	managerSummarySchema,
	nurseSummaryResponseSchema,
	doctorSummaryResponseSchema,
	adminSummaryResponseSchema,
	managerSummaryResponseSchema,
} from "../schema/dashboard";

export type NurseSummary = z.infer<typeof nurseSummarySchema>;
export type DoctorSummary = z.infer<typeof doctorSummarySchema>;
export type AdminSummary = z.infer<typeof adminSummarySchema>;
export type ManagerSummary = z.infer<typeof managerSummarySchema>;

export type NurseSummaryResponse = z.infer<typeof nurseSummaryResponseSchema>;
export type DoctorSummaryResponse = z.infer<typeof doctorSummaryResponseSchema>;
export type AdminSummaryResponse = z.infer<typeof adminSummaryResponseSchema>;
export type ManagerSummaryResponse = z.infer<
	typeof managerSummaryResponseSchema
>;
