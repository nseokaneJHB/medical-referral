import { relations } from "drizzle-orm";

import { UserModel } from "./user";
import { LoginsModel } from "./logins";
import { SessionModel } from "./session";
import { AccountModel } from "./account";
import { PatientModel } from "./patient";
import { ReferralModel } from "./referral";
import { TimelineModel } from "./timeline";
import { FacilityModel } from "./facility";
import { SpecialtyModel } from "./specialty";
import { UserSpecialtyModel } from "./user-specialty";
import { FacilitySpecialtyModel } from "./facility-specialty";
import { ReferralSpecialtyModel } from "./referral-specialty";

export const UserModelRelations = relations(UserModel, ({ one, many }) => ({
	facility: one(FacilityModel, {
		references: [FacilityModel.id],
		fields: [UserModel.facility_id],
	}),
	sessions: many(SessionModel),
	accounts: many(AccountModel),
	patients: many(PatientModel),
	createdReferrals: many(ReferralModel, { relationName: "createdReferrals" }),
	assignedReferrals: many(ReferralModel, {
		relationName: "assignedReferrals",
	}),
	logins: many(LoginsModel),
	specialties: many(UserSpecialtyModel),
}));

export const FacilityRelations = relations(FacilityModel, ({ many }) => ({
	users: many(UserModel),
	patients: many(PatientModel),
	originReferrals: many(ReferralModel, { relationName: "originReferrals" }),
	destinationReferrals: many(ReferralModel, {
		relationName: "destinationReferrals",
	}),
	specialties: many(FacilitySpecialtyModel),
}));

export const SessionRelations = relations(SessionModel, ({ one }) => ({
	user: one(UserModel, {
		references: [UserModel.id],
		fields: [SessionModel.user_id],
	}),
}));

export const AccountRelations = relations(AccountModel, ({ one }) => ({
	user: one(UserModel, {
		references: [UserModel.id],
		fields: [AccountModel.user_id],
	}),
}));

export const PatientRelations = relations(PatientModel, ({ one, many }) => ({
	creator: one(UserModel, {
		references: [UserModel.id],
		fields: [PatientModel.creator_id],
	}),
	facility: one(FacilityModel, {
		references: [FacilityModel.id],
		fields: [PatientModel.facility_id],
	}),
	referrals: many(ReferralModel),
}));

/**
 * No `timeline: many(TimelineModel)` here — `TimelineModel.entity` is
 * polymorphic (User/Facility/Referral), not a real FK to `ReferralModel`,
 * so Drizzle's `relations()` helper can't express it. The hand-rolled
 * `core/referral.ts` `countConfigs`/`relationConfigs` (not this file) is
 * what actually powers `include: { timeline: true }`.
 */
export const ReferralRelations = relations(ReferralModel, ({ one, many }) => ({
	patient: one(PatientModel, {
		references: [PatientModel.id],
		fields: [ReferralModel.patient_id],
	}),
	referrer: one(UserModel, {
		relationName: "createdReferrals",
		references: [UserModel.id],
		fields: [ReferralModel.referrer_id],
	}),
	assignedDoctor: one(UserModel, {
		relationName: "assignedReferrals",
		references: [UserModel.id],
		fields: [ReferralModel.doctor],
	}),
	originFacility: one(FacilityModel, {
		relationName: "originReferrals",
		references: [FacilityModel.id],
		fields: [ReferralModel.origin_facility_id],
	}),
	destinationFacility: one(FacilityModel, {
		relationName: "destinationReferrals",
		references: [FacilityModel.id],
		fields: [ReferralModel.destination_facility_id],
	}),
	specialties: many(ReferralSpecialtyModel),
}));

export const TimelineRelations = relations(TimelineModel, ({ one }) => ({
	changer: one(UserModel, {
		references: [UserModel.id],
		fields: [TimelineModel.changer_id],
	}),
}));

export const LoginsRelations = relations(LoginsModel, ({ one }) => ({
	user: one(UserModel, {
		references: [UserModel.id],
		fields: [LoginsModel.user_id],
	}),
}));

export const SpecialtyRelations = relations(SpecialtyModel, ({ many }) => ({
	facilities: many(FacilitySpecialtyModel),
	users: many(UserSpecialtyModel),
	referrals: many(ReferralSpecialtyModel),
}));

export const FacilitySpecialtyRelations = relations(
	FacilitySpecialtyModel,
	({ one }) => ({
		facility: one(FacilityModel, {
			references: [FacilityModel.id],
			fields: [FacilitySpecialtyModel.facility_id],
		}),
		specialty: one(SpecialtyModel, {
			references: [SpecialtyModel.id],
			fields: [FacilitySpecialtyModel.specialty_id],
		}),
	}),
);

export const UserSpecialtyRelations = relations(
	UserSpecialtyModel,
	({ one }) => ({
		user: one(UserModel, {
			references: [UserModel.id],
			fields: [UserSpecialtyModel.user_id],
		}),
		specialty: one(SpecialtyModel, {
			references: [SpecialtyModel.id],
			fields: [UserSpecialtyModel.specialty_id],
		}),
	}),
);

export const ReferralSpecialtyRelations = relations(
	ReferralSpecialtyModel,
	({ one }) => ({
		referral: one(ReferralModel, {
			references: [ReferralModel.id],
			fields: [ReferralSpecialtyModel.referral_id],
		}),
		specialty: one(SpecialtyModel, {
			references: [SpecialtyModel.id],
			fields: [ReferralSpecialtyModel.specialty_id],
		}),
	}),
);
