export const QUERY_KEYS = {
	ME: ["me"],
	ACCOUNT_STATUS: ["account", "status"],

	PATIENTS: ["patients"],
	PATIENT: ["patients", "detail"],

	REFERRALS: ["referrals"],
	REFERRAL: ["referrals", "detail"],
	REFERRAL_HISTORY: ["referrals", "history"],

	USERS: ["users"],
	USER: ["users", "detail"],
	USER_HISTORY: ["users", "history"],

	FACILITIES: ["facilities"],
	FACILITY: ["facilities", "detail"],
	FACILITY_HISTORY: ["facilities", "history"],

	AUDIT_LOGINS: ["audit", "logins"],

	DASHBOARD_NURSE: ["dashboard", "nurse"],
	DASHBOARD_DOCTOR: ["dashboard", "doctor"],
	DASHBOARD_ADMIN: ["dashboard", "admin"],
	DASHBOARD_MANAGER: ["dashboard", "manager"],

	REPORTS_REFERRALS: ["reports", "referrals"],
} as const;
