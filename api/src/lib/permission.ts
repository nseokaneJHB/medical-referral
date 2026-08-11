import {
	ROLES,
	USER_STATUS,
	FACILITY_STATUS,
	type Role,
} from "@referral-tracking/shared";

import type {
	UserModelSelect,
	PatientModelSelect,
	FacilityModelSelect,
	ReferralModelSelect,
} from "../drizzle/schema";

/**
 * Centralized authorization decision predicates — the single source of
 * truth for "who can do what" that this pass's new authorization logic
 * routes through, rather than more scattered inline `if (role === X)`
 * checks. Scoped to what this pass needs (registration/approval); grows as
 * later passes rewire Patients/Referrals/Facilities onto it too.
 *
 * Deliberately DB-free — every function here is a pure predicate over
 * already-fetched data. A check that needs a DB read (e.g. "does this
 * facility have an active Manager") is a `core.*.count(...)` call the
 * caller makes before calling in here, not something modeled by these
 * functions.
 */

const UNUSABLE_USER_STATUSES: ReadonlyArray<UserModelSelect["status"]> = [
	USER_STATUS.PENDING,
	USER_STATUS.REJECTED,
	USER_STATUS.DISABLED,
];

const UNUSABLE_FACILITY_STATUSES: ReadonlyArray<FacilityModelSelect["status"]> =
	[
		FACILITY_STATUS.PENDING,
		FACILITY_STATUS.REJECTED,
		FACILITY_STATUS.SUSPENDED,
	];

const APPEALABLE_USER_STATUSES: ReadonlyArray<UserModelSelect["status"]> = [
	USER_STATUS.REJECTED,
	USER_STATUS.FLAGGED,
	USER_STATUS.DISABLED,
];

const APPEALABLE_FACILITY_STATUSES: ReadonlyArray<
	FacilityModelSelect["status"]
> = [
	FACILITY_STATUS.REJECTED,
	FACILITY_STATUS.FLAGGED,
	FACILITY_STATUS.SUSPENDED,
];

/**
 * Coarse account-level gate, applied by `middleware/authorize.ts` on every
 * role-gated route. Deliberately excludes `FLAGGED` — most of what a
 * flagged account should lose access to lives in modules not built this
 * pass (Referrals/Patients/Facilities writes), so a blanket block here
 * would enforce nothing coherent. The one `FLAG` restriction that IS in
 * scope this pass — a flagged Manager can't moderate their facility's
 * staff — is enforced directly in `modules/manager/service.ts`, not here.
 */
export const isAccountUsable = (
	user: Pick<UserModelSelect, "status">,
): boolean => !UNUSABLE_USER_STATUSES.includes(user.status);

/** Same shape as `isAccountUsable`, for the facility a user belongs to. */
export const isFacilityUsable = (
	facility: Pick<FacilityModelSelect, "status">,
): boolean => !UNUSABLE_FACILITY_STATUSES.includes(facility.status);

/** A Manager may only act on staff at their own facility. */
export const canManagerActOnStaff = (
	manager: Pick<UserModelSelect, "facility_id">,
	target: Pick<UserModelSelect, "facility_id">,
): boolean =>
	Boolean(manager.facility_id) && manager.facility_id === target.facility_id;

/**
 * Whether `role` may change this referral's status — Nurse only their own,
 * Doctor only if already assigned (narrower than `canViewReferral`).
 */
export const canActOnReferral = (
	role: Role,
	userId: string,
	referral: Pick<ReferralModelSelect, "referrer_id" | "doctor">,
): boolean => {
	if (role === ROLES.NURSE) return referral.referrer_id === userId;
	if (role === ROLES.DOCTOR) return referral.doctor === userId;
	return false;
};

/**
 * Whether `role` may view this referral — broader than `canActOnReferral`:
 * unassigned-at-their-facility Doctors and either-direction Managers too.
 */
export const canViewReferral = (
	role: Role,
	userId: string,
	userFacilityId: string | null,
	referral: Pick<
		ReferralModelSelect,
		"referrer_id" | "doctor" | "origin_facility_id" | "destination_facility_id"
	>,
): boolean => {
	if (role === ROLES.NURSE) return referral.referrer_id === userId;
	if (role === ROLES.DOCTOR) {
		return (
			referral.doctor === userId ||
			(referral.doctor === null &&
				referral.destination_facility_id === userFacilityId)
		);
	}
	if (role === ROLES.MANAGER) {
		return (
			referral.origin_facility_id === userFacilityId ||
			referral.destination_facility_id === userFacilityId
		);
	}
	return false;
};

/**
 * Doctor-only. Deliberately broader than `canActOnReferral`'s "must already
 * be assigned" rule, same as `canViewReferral` — redirect is "this isn't
 * for us," which a Doctor should be able to decide before formally
 * accepting an unassigned referral sent to their facility, not only after.
 */
export const canRedirectReferral = (
	role: Role,
	userId: string,
	userFacilityId: string | null,
	referral: Pick<ReferralModelSelect, "doctor" | "destination_facility_id">,
): boolean =>
	role === ROLES.DOCTOR &&
	(referral.doctor === userId ||
		(referral.doctor === null &&
			referral.destination_facility_id === userFacilityId));

/**
 * Nurse/Doctor see a patient if it's their own facility's, or their
 * facility has an active referral for that patient (origin or
 * destination) — `hasActiveReferral` is the caller's pre-fetched answer
 * to that (a `core.referral.count(...)` call), not computed in here.
 */
export const canAccessPatient = (
	userFacilityId: string | null,
	patient: Pick<PatientModelSelect, "facility_id">,
	hasActiveReferral: boolean,
): boolean => {
	if (patient.facility_id === userFacilityId) return true;
	if (!userFacilityId) return false;

	return hasActiveReferral;
};

/** A Nurse/Doctor may request a transfer only from their own current facility. */
export const canRequestTransfer = (
	role: Role,
	userFacilityId: string | null,
	patient: Pick<PatientModelSelect, "facility_id">,
): boolean =>
	(role === ROLES.NURSE || role === ROLES.DOCTOR) &&
	Boolean(userFacilityId) &&
	userFacilityId === patient.facility_id;

/**
 * Whether `role` may decide the origin or destination side of a patient
 * transfer for `facilityId` — that facility's own Manager, or
 * Administrator as the orphan-facility fallback (no currently-active
 * Manager there, per the caller's pre-fetched `isOrphaned`, a
 * `core.user.count(...)` check), same fallback rule as Nurse/Doctor
 * account approvals.
 */
export const canDecideTransfer = (
	role: Role,
	userFacilityId: string | null,
	facilityId: string,
	isOrphaned: boolean,
): boolean => {
	if (role === ROLES.MANAGER) return userFacilityId === facilityId;
	if (role === ROLES.ADMINISTRATOR) return isOrphaned;
	return false;
};

/** Administrator sees any user; Manager only their own facility's. */
export const canViewUser = (
	role: Role,
	viewerFacilityId: string | null,
	target: Pick<UserModelSelect, "facility_id">,
): boolean => {
	if (role === ROLES.MANAGER) return target.facility_id === viewerFacilityId;
	return true;
};

/**
 * `PENDING` is deliberately excluded — a pending applicant waits for a
 * decision, they don't appeal one that hasn't happened yet.
 */
export const canFileAppeal = (user: Pick<UserModelSelect, "status">): boolean =>
	APPEALABLE_USER_STATUSES.includes(user.status);

/** Only the facility's own Manager may appeal on its behalf. */
export const canFileFacilityAppeal = (
	user: Pick<UserModelSelect, "role" | "facility_id">,
	facility: Pick<FacilityModelSelect, "id" | "status">,
): boolean =>
	user.role === ROLES.MANAGER &&
	user.facility_id === facility.id &&
	APPEALABLE_FACILITY_STATUSES.includes(facility.status);
