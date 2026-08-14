export const QUERY_KEYS = {
	ME: ["me"],
	ACCOUNT_STATUS: ["account", "status"],

	PATIENTS: ["patients"],
	PATIENT: ["patients", "detail"],

	REFERRALS: ["referrals"],
	REFERRAL: ["referrals", "detail"],
	REFERRAL_HISTORY: ["referrals", "history"],
	REFERRAL_SPECIALTIES: ["referrals", "specialties"],

	USERS: ["users"],
	USER: ["users", "detail"],
	USER_HISTORY: ["users", "history"],
	USER_SPECIALTIES: ["users", "specialties"],

	FACILITIES: ["facilities"],
	FACILITY: ["facilities", "detail"],
	FACILITY_HISTORY: ["facilities", "history"],
	FACILITY_SPECIALTIES: ["facilities", "specialties"],

	SPECIALTIES: ["specialties"],

	AUDIT_LOGINS: ["audit", "logins"],

	FACILITY_AUDIT: ["facility-audit"],

	TRANSFERS: ["transfers"],

	APPEALS: ["appeals"],

	DASHBOARD_NURSE: ["dashboard", "nurse"],
	DASHBOARD_DOCTOR: ["dashboard", "doctor"],
	DASHBOARD_ADMIN: ["dashboard", "admin"],
	DASHBOARD_MANAGER: ["dashboard", "manager"],

	REPORTS_REFERRALS: ["reports", "referrals"],
} as const;
