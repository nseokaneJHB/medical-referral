import { z } from "zod";

import {
	AppealSchema,
	TimelineSchema,
	timelineTypeSchema,
	timelineActionSchema,
	timelineResponseSchema,
	appealListResponseSchema,
	timelineListResponseSchema,
} from "../schema/timeline";

export type Timeline = z.infer<typeof TimelineSchema>;
export type TimelineType = z.infer<typeof timelineTypeSchema>;
export type TimelineAction = z.infer<typeof timelineActionSchema>;
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;
export type TimelineListResponse = z.infer<typeof timelineListResponseSchema>;
export type Appeal = z.infer<typeof AppealSchema>;
export type AppealListResponse = z.infer<typeof appealListResponseSchema>;
