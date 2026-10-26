import { z } from "zod";

import {
	appealRowSchema,
	timelineSchema,
	managerAuditSchema,
	timelineTypeSchema,
	timelineActionSchema,
	timelineResponseSchema,
	appealListResponseSchema,
	timelineListResponseSchema,
	managerAuditListResponseSchema,
} from "../schema/timeline";

export type Timeline = z.infer<typeof timelineSchema>;
export type TimelineType = z.infer<typeof timelineTypeSchema>;
export type TimelineAction = z.infer<typeof timelineActionSchema>;
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;
export type TimelineListResponse = z.infer<typeof timelineListResponseSchema>;
export type Appeal = z.infer<typeof appealRowSchema>;
export type AppealListResponse = z.infer<typeof appealListResponseSchema>;
export type ManagerAudit = z.infer<typeof managerAuditSchema>;
export type ManagerAuditListResponse = z.infer<
	typeof managerAuditListResponseSchema
>;
