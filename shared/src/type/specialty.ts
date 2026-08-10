import { z } from "zod";

import {
	SpecialtySchema,
	UserSpecialtySchema,
	CreateSpecialtySchema,
	UpdateSpecialtySchema,
	specialtyParamsSchema,
	FacilitySpecialtySchema,
	specialtiesQuerySchema,
	specialtyResponseSchema,
	assignUserSpecialtySchema,
	specialtyListResponseSchema,
	assignFacilitySpecialtySchema,
	userSpecialtyListResponseSchema,
	facilitySpecialtyListResponseSchema,
} from "../schema/specialty";

export type Specialty = z.infer<typeof SpecialtySchema>;
export type CreateSpecialtyBody = z.infer<typeof CreateSpecialtySchema>;
export type UpdateSpecialtyBody = z.infer<typeof UpdateSpecialtySchema>;
export type SpecialtyParams = z.infer<typeof specialtyParamsSchema>;
export type SpecialtiesQuery = z.infer<typeof specialtiesQuerySchema>;
export type SpecialtyResponse = z.infer<typeof specialtyResponseSchema>;
export type SpecialtyListResponse = z.infer<typeof specialtyListResponseSchema>;

export type FacilitySpecialty = z.infer<typeof FacilitySpecialtySchema>;
export type AssignFacilitySpecialtyBody = z.infer<
	typeof assignFacilitySpecialtySchema
>;
export type FacilitySpecialtyListResponse = z.infer<
	typeof facilitySpecialtyListResponseSchema
>;

export type UserSpecialty = z.infer<typeof UserSpecialtySchema>;
export type AssignUserSpecialtyBody = z.infer<typeof assignUserSpecialtySchema>;
export type UserSpecialtyListResponse = z.infer<
	typeof userSpecialtyListResponseSchema
>;
