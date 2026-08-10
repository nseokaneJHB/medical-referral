import { z } from "zod";

import {
	TimelineSchema,
	timelineTypeSchema,
	timelineActionSchema,
	timelineResponseSchema,
	timelineListResponseSchema,
} from "../schema/timeline";

export type Timeline = z.infer<typeof TimelineSchema>;
export type TimelineType = z.infer<typeof timelineTypeSchema>;
export type TimelineAction = z.infer<typeof timelineActionSchema>;
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;
export type TimelineListResponse = z.infer<typeof timelineListResponseSchema>;
