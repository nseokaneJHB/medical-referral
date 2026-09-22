import { z } from "zod";

import {
	facilitySchema,
	createFacilitySchema,
	updateFacilitySchema,
	facilityParamsSchema,
	facilitiesQuerySchema,
	facilityDetailSchema,
	facilityResponseSchema,
	facilityListResponseSchema,
	facilityDetailResponseSchema,
} from "../schema/facility";

export type Facility = z.infer<typeof facilitySchema>;
export type CreateFacilityBody = z.infer<typeof createFacilitySchema>;
export type UpdateFacilityBody = z.infer<typeof updateFacilitySchema>;
export type FacilityParams = z.infer<typeof facilityParamsSchema>;
export type FacilitiesQuery = z.infer<typeof facilitiesQuerySchema>;
export type FacilityResponse = z.infer<typeof facilityResponseSchema>;
export type FacilityListResponse = z.infer<typeof facilityListResponseSchema>;
export type FacilityDetail = z.infer<typeof facilityDetailSchema>;
export type FacilityDetailResponse = z.infer<
	typeof facilityDetailResponseSchema
>;
