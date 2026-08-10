import { z } from "zod";

import {
	appealSchema,
	appealParamsSchema,
	appealDecisionSchema,
	approveActionSchema,
	moderationReasonSchema,
} from "../schema/moderation";

export type ModerationReasonBody = z.infer<typeof moderationReasonSchema>;
export type ApproveActionBody = z.infer<typeof approveActionSchema>;
export type AppealBody = z.infer<typeof appealSchema>;
export type AppealDecisionBody = z.infer<typeof appealDecisionSchema>;
export type AppealParams = z.infer<typeof appealParamsSchema>;
