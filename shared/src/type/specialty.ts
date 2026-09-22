import { z } from "zod";

import {
	specialtySchema,
	specialtyRefSchema,
	createSpecialtySchema,
	updateSpecialtySchema,
	specialtyParamsSchema,
	specialtiesQuerySchema,
	specialtyResponseSchema,
	specialtyListItemSchema,
	specialtyListResponseSchema,
	facilitySpecialtyLinkSchema,
	assignFacilitySpecialtySchema,
	facilitySpecialtyListResponseSchema,
	facilitySpecialtyLinkResponseSchema,
	facilitySpecialtyUnassignParamsSchema,
	userSpecialtyLinkSchema,
	assignUserSpecialtySchema,
	userSpecialtyListResponseSchema,
	userSpecialtyLinkResponseSchema,
	userSpecialtyUnassignParamsSchema,
	referralSpecialtyLinkSchema,
	assignReferralSpecialtySchema,
	referralSpecialtyListResponseSchema,
	referralSpecialtyLinkResponseSchema,
	referralSpecialtyUnassignParamsSchema,
} from "../schema/specialty";

export type Specialty = z.infer<typeof specialtySchema>;
export type SpecialtyRef = z.infer<typeof specialtyRefSchema>;
export type CreateSpecialtyBody = z.infer<typeof createSpecialtySchema>;
export type UpdateSpecialtyBody = z.infer<typeof updateSpecialtySchema>;
export type SpecialtyParams = z.infer<typeof specialtyParamsSchema>;
export type SpecialtiesQuery = z.infer<typeof specialtiesQuerySchema>;
export type SpecialtyResponse = z.infer<typeof specialtyResponseSchema>;
export type SpecialtyListItem = z.infer<typeof specialtyListItemSchema>;
export type SpecialtyListResponse = z.infer<typeof specialtyListResponseSchema>;

export type FacilitySpecialtyLink = z.infer<typeof facilitySpecialtyLinkSchema>;
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

export type UserSpecialtyLink = z.infer<typeof userSpecialtyLinkSchema>;
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

export type ReferralSpecialtyLink = z.infer<typeof referralSpecialtyLinkSchema>;
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
