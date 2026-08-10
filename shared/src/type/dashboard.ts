import { z } from "zod";

import {
	NurseSummarySchema,
	DoctorSummarySchema,
	AdminSummarySchema,
	ManagerSummarySchema,
	nurseSummaryResponseSchema,
	doctorSummaryResponseSchema,
	adminSummaryResponseSchema,
	managerSummaryResponseSchema,
} from "../schema/dashboard";

export type NurseSummary = z.infer<typeof NurseSummarySchema>;
export type DoctorSummary = z.infer<typeof DoctorSummarySchema>;
export type AdminSummary = z.infer<typeof AdminSummarySchema>;
export type ManagerSummary = z.infer<typeof ManagerSummarySchema>;

export type NurseSummaryResponse = z.infer<typeof nurseSummaryResponseSchema>;
export type DoctorSummaryResponse = z.infer<typeof doctorSummaryResponseSchema>;
export type AdminSummaryResponse = z.infer<typeof adminSummaryResponseSchema>;
export type ManagerSummaryResponse = z.infer<
	typeof managerSummaryResponseSchema
>;
