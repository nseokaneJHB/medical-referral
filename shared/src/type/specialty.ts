import { z } from "zod";

import {
	SpecialtySchema,
	specialtyRefSchema,
	CreateSpecialtySchema,
	UpdateSpecialtySchema,
	specialtyParamsSchema,
	specialtiesQuerySchema,
	specialtyResponseSchema,
	SpecialtyListItemSchema,
	specialtyListResponseSchema,
	FacilitySpecialtyLinkSchema,
	assignFacilitySpecialtySchema,
	facilitySpecialtyListResponseSchema,
	facilitySpecialtyLinkResponseSchema,
	facilitySpecialtyUnassignParamsSchema,
	UserSpecialtyLinkSchema,
	assignUserSpecialtySchema,
	userSpecialtyListResponseSchema,
	userSpecialtyLinkResponseSchema,
	userSpecialtyUnassignParamsSchema,
	ReferralSpecialtyLinkSchema,
	assignReferralSpecialtySchema,
	referralSpecialtyListResponseSchema,
	referralSpecialtyLinkResponseSchema,
	referralSpecialtyUnassignParamsSchema,
} from "../schema/specialty";

export type Specialty = z.infer<typeof SpecialtySchema>;
export type SpecialtyRef = z.infer<typeof specialtyRefSchema>;
export type CreateSpecialtyBody = z.infer<typeof CreateSpecialtySchema>;
export type UpdateSpecialtyBody = z.infer<typeof UpdateSpecialtySchema>;
export type SpecialtyParams = z.infer<typeof specialtyParamsSchema>;
export type SpecialtiesQuery = z.infer<typeof specialtiesQuerySchema>;
export type SpecialtyResponse = z.infer<typeof specialtyResponseSchema>;
export type SpecialtyListItem = z.infer<typeof SpecialtyListItemSchema>;
export type SpecialtyListResponse = z.infer<typeof specialtyListResponseSchema>;

export type FacilitySpecialtyLink = z.infer<typeof FacilitySpecialtyLinkSchema>;
export type AssignFacilitySpecialtyBody = z.infer<
	typeof assignFacilitySpecialtySchema
>;
export type FacilitySpecialtyListResponse = z.infer<
	typeof facilitySpecialtyListResponseSchema
>;
export type FacilitySpecialtyLinkResponse = z.infer<
	typeof facilitySpecialtyLinkResponseSchema
>;
export type FacilitySpecialtyUnassignParams = z.infer<
	typeof facilitySpecialtyUnassignParamsSchema
>;

export type UserSpecialtyLink = z.infer<typeof UserSpecialtyLinkSchema>;
export type AssignUserSpecialtyBody = z.infer<typeof assignUserSpecialtySchema>;
export type UserSpecialtyListResponse = z.infer<
	typeof userSpecialtyListResponseSchema
>;
export type UserSpecialtyLinkResponse = z.infer<
	typeof userSpecialtyLinkResponseSchema
>;
export type UserSpecialtyUnassignParams = z.infer<
	typeof userSpecialtyUnassignParamsSchema
>;

export type ReferralSpecialtyLink = z.infer<typeof ReferralSpecialtyLinkSchema>;
export type AssignReferralSpecialtyBody = z.infer<
	typeof assignReferralSpecialtySchema
>;
export type ReferralSpecialtyListResponse = z.infer<
	typeof referralSpecialtyListResponseSchema
>;
export type ReferralSpecialtyLinkResponse = z.infer<
	typeof referralSpecialtyLinkResponseSchema
>;
export type ReferralSpecialtyUnassignParams = z.infer<
	typeof referralSpecialtyUnassignParamsSchema
>;
