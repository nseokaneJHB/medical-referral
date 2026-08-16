import { z } from "zod";

import {
	FacilitySchema,
	CreateFacilitySchema,
	UpdateFacilitySchema,
	facilityParamsSchema,
	facilitiesQuerySchema,
	FacilityDetailSchema,
	facilityResponseSchema,
	facilityListResponseSchema,
	facilityDetailResponseSchema,
} from "../schema/facility";

export type Facility = z.infer<typeof FacilitySchema>;
export type CreateFacilityBody = z.infer<typeof CreateFacilitySchema>;
export type UpdateFacilityBody = z.infer<typeof UpdateFacilitySchema>;
export type FacilityParams = z.infer<typeof facilityParamsSchema>;
export type FacilitiesQuery = z.infer<typeof facilitiesQuerySchema>;
export type FacilityResponse = z.infer<typeof facilityResponseSchema>;
export type FacilityListResponse = z.infer<typeof facilityListResponseSchema>;
export type FacilityDetail = z.infer<typeof FacilityDetailSchema>;
export type FacilityDetailResponse = z.infer<
	typeof facilityDetailResponseSchema
>;
