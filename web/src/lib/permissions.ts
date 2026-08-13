import {
	ROLES,
	APPEALABLE_FACILITY_STATUSES,
	TERMINAL_REFERRAL_STATUSES,
	type Role,
} from "@referral-tracking/shared";
import type {
	Referral,
	Facility,
	Patient,
} from "@referral-tracking/shared";
import type { AuthUser } from "@/api/auth";

/**
 * Centralized frontend authorization predicates — the single source of
 * truth for "who can do what" in route guards, conditional rendering, and
 * nav visibility. Mirrors `api/src/lib/permission.ts`'s established pattern
 * of many small named predicates rather than a single dispatcher.
 *
 * Deliberately pure — every function here is a predicate over already-
 * fetched client data (route context `user`, loaded resource objects).
 * Unlike the backend, frontend predicates operate on response-shaped data
 * (nested refs like `referral.referrer.id`, not DB foreign keys).
 */

// --- Core role checks (bare; each is identical ROLES.X check repeated
// 2-5x across the inventory with no other condition attached) ---

export const isAdministrator = (user: Pick<AuthUser, "role">): boolean =>
	user.role === ROLES.ADMINISTRATOR;

export const isManager = (user: Pick<AuthUser, "role">): boolean =>
	user.role === ROLES.MANAGER;

export const isDoctor = (user: Pick<AuthUser, "role">): boolean =>
	user.role === ROLES.DOCTOR;

export const isNurse = (user: Pick<AuthUser, "role">): boolean =>
	user.role === ROLES.NURSE;

// --- Patients ---

export const canRequestTransfer = (
	user: Pick<AuthUser, "role" | "facility_id">,
	patient: Pick<Patient, "facility">,
): boolean =>
	(user.role === ROLES.NURSE || user.role === ROLES.DOCTOR) &&
	user.facility_id === patient.facility.id;

// --- Referrals ---

export const canCreateReferral = (user: Pick<AuthUser, "role">): boolean =>
	isNurse(user) || isDoctor(user);

export const canActOnReferral = (
	user: Pick<AuthUser, "id" | "role">,
	referral: Pick<Referral, "referrer" | "assignedDoctor">,
): boolean =>
	(user.role === ROLES.NURSE && referral.referrer.id === user.id) ||
	(user.role === ROLES.DOCTOR && referral.assignedDoctor?.id === user.id);

export const canEditReferralFull = (
	user: Pick<AuthUser, "id" | "role">,
	referral: Pick<Referral, "referrer" | "status">,
): boolean =>
	user.role === ROLES.NURSE &&
	referral.referrer.id === user.id &&
	!TERMINAL_REFERRAL_STATUSES.includes(referral.status);

export const canAssignDoctorToReferral = (
	user: Pick<AuthUser, "role" | "facility_id">,
	referral: Pick<Referral, "destination_facility" | "status">,
): boolean =>
	user.role === ROLES.MANAGER &&
	referral.destination_facility.id === user.facility_id &&
	!TERMINAL_REFERRAL_STATUSES.includes(referral.status);

export const canEditReferral = (
	user: Pick<AuthUser, "id" | "role" | "facility_id">,
	referral: Pick<Referral, "referrer" | "destination_facility" | "status">,
): boolean =>
	canEditReferralFull(user, referral) ||
	canAssignDoctorToReferral(user, referral);

export const canSelfAssignReferral = (
	user: Pick<AuthUser, "role" | "facility_id">,
	referral: Pick<Referral, "assignedDoctor" | "destination_facility" | "status">,
): boolean =>
	isDoctor(user) &&
	!referral.assignedDoctor &&
	!TERMINAL_REFERRAL_STATUSES.includes(referral.status) &&
	user.facility_id === referral.destination_facility.id;

export const canRedirectReferral = (
	user: Pick<AuthUser, "id" | "role" | "facility_id">,
	referral: Pick<Referral, "assignedDoctor" | "destination_facility" | "status">,
): boolean =>
	isDoctor(user) &&
	!TERMINAL_REFERRAL_STATUSES.includes(referral.status) &&
	(referral.assignedDoctor?.id === user.id ||
		(!referral.assignedDoctor &&
			user.facility_id === referral.destination_facility.id));

// --- Facilities ---

export const isOwnFacilityManager = (
	user: Pick<AuthUser, "role" | "facility_id">,
	facilityId: string,
): boolean => isManager(user) && user.facility_id === facilityId;

export const canFileFacilityAppeal = (
	user: Pick<AuthUser, "role" | "facility_id">,
	facility: Pick<Facility, "id" | "status">,
): boolean =>
	user.role === ROLES.MANAGER &&
	user.facility_id === facility.id &&
	APPEALABLE_FACILITY_STATUSES.includes(facility.status);

// --- Users / Moderation ---

export const canManageUsers = (user: Pick<AuthUser, "role">): boolean =>
	isAdministrator(user) || isManager(user);

/**
 * Determines whether a viewer can moderate a target user. Note: this is one
 * exception to the single-user-object pattern used elsewhere — the call site
 * (`resolveModerationFns` in users/index.tsx) only has bare role values, not
 * a full user object, so keeping this dispatcher-shaped prevents forcing an
 * object construction at the call site.
 */
export const canModerateUser = (
	viewerRole: Role,
	targetRole: Role,
): boolean => {
	if (targetRole === ROLES.MANAGER) return viewerRole === ROLES.ADMINISTRATOR;
	if (targetRole === ROLES.NURSE || targetRole === ROLES.DOCTOR)
		return viewerRole === ROLES.ADMINISTRATOR || viewerRole === ROLES.MANAGER;
	return false;
};

/**
 * Which role-scoped API namespace ("ADMINISTRATOR" or "MANAGER") a viewer's
 * moderation requests (appeals/transfers) should hit — every non-Administrator
 * moderator is a Manager by definition, so this collapses to a binary check.
 */
export const resolveModerationNamespace = (
	user: Pick<AuthUser, "role">,
): "ADMINISTRATOR" | "MANAGER" =>
	isAdministrator(user) ? "ADMINISTRATOR" : "MANAGER";

// --- Specialties ---

export const canManageFacilitySpecialties = (
	user: Pick<AuthUser, "role" | "facility_id">,
	facility: Pick<Facility, "id">,
): boolean => isOwnFacilityManager(user, facility.id);

/**
 * Specialties only make sense for clinical staff — Manager/Administrator
 * accounts have none. Manager-only, and only their own facility's,
 * mirroring `canModerateUser`'s shape but keyed on a nested `facility` ref
 * (`UserDetail`'s shape) rather than a bare `facility_id`. Administrator
 * manages the specialty vocabulary itself but not any one facility/user's
 * assignments.
 */
export const canManageStaffSpecialties = (
	viewer: Pick<AuthUser, "role" | "facility_id">,
	target: { role: Role; facility: Pick<Facility, "id"> | null },
): boolean => {
	if (target.role !== ROLES.DOCTOR && target.role !== ROLES.NURSE) return false;
	return isManager(viewer) && viewer.facility_id === target.facility?.id;
};

// --- Nav ---

export const canViewNavItem = (
	user: Pick<AuthUser, "role">,
	item: { roles?: Role[] },
): boolean => !item.roles || item.roles.includes(user.role);
