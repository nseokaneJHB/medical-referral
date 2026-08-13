export const APP_NAME = "Referral Tracking" as const;

export const DURATION_REGEX = /^(\d+)(ms|s|m|h|d)$/;

export const DEFAULT_PAGE_LIMIT = 10 as const;
export const DEFAULT_PAGE_NUMBER = 1 as const;

export const ORDER_DIRECTION = { asc: "asc", desc: "desc" } as const;

/**
 * Frontend redirect URLs
 * These are the paths on the frontend that the backend can instruct the client to redirect to.
 */
export const FRONTEND_URLS = {
	HOME: "/",
	SIGN_IN: "/sign-in",
	SIGN_UP: "/sign-up",
	PATIENTS: "/patients",
	PATIENT: "/patients/$patientId",
	NEW_PATIENT: "/patients/new",
	REFERRALS: "/referrals",
	REFERRAL: "/referrals/$referralId",
	NEW_REFERRAL: "/referrals/new",
	USERS: "/users",
	USER: "/users/$userId",
	AUDIT: "/audit",
	FACILITIES: "/facilities",
	FACILITY: "/facilities/$facilityId",
	TRANSFERS: "/transfers",
	APPEALS: "/appeals",
	ACCOUNT_STATUS: "/account-status",
} as const;

export type FrontendRedirectUrlPaths = typeof FRONTEND_URLS;

/**
 * Standard HTTP response code constants
 * These are semantic identifiers for different HTTP response scenarios
 */
export const HTTP_CODE = {
	OK: "OK",
	CREATED: "CREATED",
	CONFLICT: "CONFLICT",
	REDIRECT: "REDIRECT",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	NO_CONTENT: "NO_CONTENT",
	BAD_REQUEST: "BAD_REQUEST",
	NOT_ALLOWED: "NOT_ALLOWED",
	NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
	UNAUTHENTICATED: "UNAUTHENTICATED",
	VALIDATION_ERROR: "VALIDATION_ERROR",
	TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
	SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

/**
 * Type representing all possible HTTP code keys
 */
type HTTPCode = keyof typeof HTTP_CODE;

/**
 * Standardized response codes and their corresponding HTTP status codes
 *
 * Maps semantic response codes to their HTTP status numbers and code identifiers.
 * Use this to ensure consistent responses across your API.
 */
export const HTTP_RESPONSE_CODE: Record<
	HTTPCode,
	{
		// HTTP status code number (e.g., 200, 404, 500)
		status: number;
		// Semantic code identifier
		code: (typeof HTTP_CODE)[HTTPCode];
	}
> = {
	// Success responses (2xx)
	OK: { status: 200, code: HTTP_CODE.OK },
	CREATED: { status: 201, code: HTTP_CODE.CREATED },
	NO_CONTENT: { status: 204, code: HTTP_CODE.NO_CONTENT },

	// Client errors - Redirect
	REDIRECT: { status: 302, code: HTTP_CODE.NO_CONTENT },

	// Client errors - Authentication & Authorization (4xx)
	FORBIDDEN: { status: 403, code: HTTP_CODE.FORBIDDEN },
	UNAUTHENTICATED: { status: 401, code: HTTP_CODE.UNAUTHENTICATED },

	// Client errors - Rate Limiting (4xx)
	TOO_MANY_REQUESTS: { status: 429, code: HTTP_CODE.TOO_MANY_REQUESTS },

	// Client errors - Validation (4xx)
	BAD_REQUEST: { status: 400, code: HTTP_CODE.BAD_REQUEST },
	VALIDATION_ERROR: { status: 422, code: HTTP_CODE.VALIDATION_ERROR },

	// Client errors - Generic (4xx)
	NOT_FOUND: { status: 404, code: HTTP_CODE.NOT_FOUND },
	NOT_ALLOWED: { status: 405, code: HTTP_CODE.NOT_ALLOWED },
	CONFLICT: { status: 409, code: HTTP_CODE.CONFLICT },

	// Server errors (5xx)
	INTERNAL_SERVER_ERROR: { status: 500, code: HTTP_CODE.INTERNAL_SERVER_ERROR },
	NOT_IMPLEMENTED: { status: 501, code: HTTP_CODE.NOT_IMPLEMENTED },
	SERVICE_UNAVAILABLE: { status: 503, code: HTTP_CODE.SERVICE_UNAVAILABLE },
} as const;

/**
 * Logical API namespaces. `AUTH` through `FACILITIES` are flat, resource-
 * first route groupings per build-spec.md's route tables (`/api/patients`,
 * `/api/referrals`, ...). `ACCOUNT`/`ADMINISTRATOR`/`MANAGER` are role-first
 * instead (see docs/backlog.md's confirmed read-vs-write URL split) —
 * genuinely role-exclusive actions (moderation, appeals, self-service
 * status) live there, while shared reads stay resource-first above.
 */
export const API_NAMESPACE = {
	AUTH: "AUTH",
	PATIENTS: "PATIENTS",
	REFERRALS: "REFERRALS",
	USERS: "USERS",
	AUDIT: "AUDIT",
	DASHBOARD: "DASHBOARD",
	REPORTS: "REPORTS",
	FACILITIES: "FACILITIES",
	ACCOUNT: "ACCOUNT",
	ADMINISTRATOR: "ADMINISTRATOR",
	MANAGER: "MANAGER",
} as const;

/**
 * Type representing all valid API namespace keys
 */
export type ApiNamespace = keyof typeof API_NAMESPACE;

/**
 * Resolved API path map.
 * Each namespace maps to its versioned base URL.
 */
export type ApiPathMap = Record<ApiNamespace, `/api/${string}/${string}`>;

/**
 * Generates versioned API base paths.
 *
 * @example
 * const paths = API_URLS("v1")
 * paths.PATIENTS → "/api/v1/patients"
 */
export const API_URLS = <V extends string>(
	version: V,
): Record<ApiNamespace, `/api/${V}${string}`> =>
	({
		AUTH: `/api/${version}/auth`,
		PATIENTS: `/api/${version}/patients`,
		REFERRALS: `/api/${version}/referrals`,
		USERS: `/api/${version}/users`,
		AUDIT: `/api/${version}/audit`,
		DASHBOARD: `/api/${version}/dashboard`,
		REPORTS: `/api/${version}/reports`,
		FACILITIES: `/api/${version}/facilities`,
		ACCOUNT: `/api/${version}/account`,
		ADMINISTRATOR: `/api/${version}/administrator`,
		MANAGER: `/api/${version}/manager`,
	}) as const;

/**
 * Sub-paths registered *within* each module's own `API_URLS` namespace
 * prefix (e.g. `PATIENT_FLAG` becomes `/api/v1/patients/:id/flag`) — every
 * route across every module's `route.ts` resolves its `url` from here
 * rather than a literal string, so a path never exists in two places that
 * can drift out of sync. `:id`-style dynamic segments are plain path
 * template strings (Fastify's own syntax, not a typed-router param map like
 * the frontend's `FRONTEND_URLS`) — the constant is still the single source
 * of truth, just without compile-time param checking on this side.
 */
export const API_PATHS = {
	SIGN_UP: "/sign-up",
	SIGN_IN: "/sign-in",
	SIGN_OUT: "/sign-out",
	SESSION: "/session",

	LIVEZ: "/livez",
	READYZ: "/readyz",

	ACCOUNT_STATUS: "/status",
	ACCOUNT_APPEAL: "/appeal",

	ADMINISTRATOR_MANAGER_APPROVE: "/managers/:id/approve",
	ADMINISTRATOR_MANAGER_REJECT: "/managers/:id/reject",
	ADMINISTRATOR_MANAGER_DISABLE: "/managers/:id/disable",
	ADMINISTRATOR_MANAGER_FLAG: "/managers/:id/flag",
	ADMINISTRATOR_STAFF_APPROVE: "/staff/:id/approve",
	ADMINISTRATOR_STAFF_REJECT: "/staff/:id/reject",
	ADMINISTRATOR_STAFF_FLAG: "/staff/:id/flag",
	ADMINISTRATOR_STAFF_DISABLE: "/staff/:id/disable",
	ADMINISTRATOR_FACILITY_APPROVE: "/facilities/:id/approve",
	ADMINISTRATOR_FACILITY_REJECT: "/facilities/:id/reject",
	ADMINISTRATOR_FACILITY_FLAG: "/facilities/:id/flag",
	ADMINISTRATOR_FACILITY_SUSPEND: "/facilities/:id/suspend",
	ADMINISTRATOR_USER_CREATE: "/users",
	ADMINISTRATOR_USER_RESET_PASSWORD: "/users/:id/reset-password",
	ADMINISTRATOR_APPEAL_APPROVE: "/appeals/:id/approve",
	ADMINISTRATOR_APPEAL_DENY: "/appeals/:id/deny",
	ADMINISTRATOR_APPEAL_LIST: "/appeals",
	ADMINISTRATOR_TRANSFER_ORIGIN_APPROVE: "/transfers/:id/origin/approve",
	ADMINISTRATOR_TRANSFER_ORIGIN_REJECT: "/transfers/:id/origin/reject",
	ADMINISTRATOR_TRANSFER_DESTINATION_APPROVE:
		"/transfers/:id/destination/approve",
	ADMINISTRATOR_TRANSFER_DESTINATION_REJECT:
		"/transfers/:id/destination/reject",
	ADMINISTRATOR_TRANSFER_LIST: "/transfers",

	AUDIT_LOGINS: "/logins",

	DASHBOARD_NURSE_SUMMARY: "/nurse/summary",
	DASHBOARD_DOCTOR_SUMMARY: "/doctor/summary",
	DASHBOARD_ADMIN_SUMMARY: "/admin/summary",
	DASHBOARD_MANAGER_SUMMARY: "/manager/summary",

	FACILITY_LIST: "/",
	FACILITY_BY_ID: "/:id",
	FACILITY_HISTORY: "/:id/history",

	MANAGER_STAFF_APPROVE: "/staff/:id/approve",
	MANAGER_STAFF_REJECT: "/staff/:id/reject",
	MANAGER_STAFF_DISABLE: "/staff/:id/disable",
	MANAGER_STAFF_FLAG: "/staff/:id/flag",
	MANAGER_FACILITY_APPEAL: "/facility/appeal",
	MANAGER_APPEAL_APPROVE: "/appeals/:id/approve",
	MANAGER_APPEAL_DENY: "/appeals/:id/deny",
	MANAGER_APPEAL_LIST: "/appeals",
	MANAGER_TRANSFER_ORIGIN_APPROVE: "/transfers/:id/origin/approve",
	MANAGER_TRANSFER_ORIGIN_REJECT: "/transfers/:id/origin/reject",
	MANAGER_TRANSFER_DESTINATION_APPROVE: "/transfers/:id/destination/approve",
	MANAGER_TRANSFER_DESTINATION_REJECT: "/transfers/:id/destination/reject",
	MANAGER_TRANSFER_LIST: "/transfers",
	MANAGER_AUDIT_LIST: "/audit",

	PATIENT_LIST: "/",
	PATIENT_BY_ID: "/:id",
	PATIENT_FLAG: "/:id/flag",
	PATIENT_UNFLAG: "/:id/unflag",
	PATIENT_TRANSFER_REQUEST: "/:id/transfer",

	REFERRAL_LIST: "/",
	REFERRAL_BY_ID: "/:id",
	REFERRAL_STATUS_UPDATE: "/:id/status",
	REFERRAL_ASSIGN: "/:id/assign",
	REFERRAL_REDIRECT: "/:id/redirect",
	REFERRAL_HISTORY: "/:id/history",

	REPORTS_REFERRALS: "/referrals",

	USER_LIST: "/",
	USER_BY_ID: "/:id",
	USER_HISTORY: "/:id/history",
} as const;

export const ROLES = {
	NURSE: "NURSE",
	DOCTOR: "DOCTOR",
	ADMINISTRATOR: "ADMINISTRATOR",
	MANAGER: "MANAGER",
} as const;

/**
 * User account lifecycle. `PENDING` = awaiting approval (Administrator for
 * Manager applications, Manager for Nurse/Doctor). `REJECTED`/`DISABLED`/
 * `FLAGGED` are all appeal-eligible (see `lib/permission.ts`). `DEPARTED`
 * is reserved for self-requested account closure — not set by anything in
 * this pass, added now so the enum doesn't need another migration later.
 */
export const USER_STATUS = {
	PENDING: "PENDING",
	ACTIVE: "ACTIVE",
	REJECTED: "REJECTED",
	DISABLED: "DISABLED",
	FLAGGED: "FLAGGED",
	DEPARTED: "DEPARTED",
} as const;

/**
 * Facility lifecycle. Mirrors `USER_STATUS`'s moderation shape — a facility
 * only ever comes into being `PENDING`, paired with its founding Manager's
 * own application (see `authentication/service.ts`'s `signUp`).
 * `FLAGGED`/`SUSPENDED` are the two-tier moderation actions an
 * Administrator can take (see `docs/roles-permissions.md`): `FLAGGED` is
 * the lighter, exit-only carve-out, `SUSPENDED` a full freeze. Enforcement
 * of what either actually restricts on Patients/Referrals is out of scope
 * this pass — only the status transitions + recorded reason exist for now.
 */
export const FACILITY_STATUS = {
	PENDING: "PENDING",
	APPROVED: "APPROVED",
	REJECTED: "REJECTED",
	FLAGGED: "FLAGGED",
	SUSPENDED: "SUSPENDED",
} as const;

/** Eligible for a Manager-filed appeal — single source of truth for both `api/src/lib/permission.ts` and the frontend's `lib/permissions.ts`. */
export const APPEALABLE_FACILITY_STATUSES: (typeof FACILITY_STATUS)[keyof typeof FACILITY_STATUS][] =
	[FACILITY_STATUS.REJECTED, FACILITY_STATUS.FLAGGED, FACILITY_STATUS.SUSPENDED];

/**
 * Generalized append-only audit log (`timeline` table) — covers Users,
 * Facilities, and Referrals moderation/status history in one shared shape.
 * `type` says which entity `entity` (a bare id, not a real FK — polymorphic
 * columns can't be DB-enforced) points at. `PATIENT` is reserved for a
 * future pass — no `type: PATIENT` row is written by anything yet.
 */
export const TIMELINE_TYPE = {
	USER: "USER",
	FACILITY: "FACILITY",
	REFERRAL: "REFERRAL",
	PATIENT: "PATIENT",
} as const;

/**
 * `DISABLED`/`DEPARTED` only ever apply to `type: USER`; `SUSPENDED` only
 * to `type: FACILITY`; `STATUS_CHANGE`/`DOCTOR_ASSIGNED`/`REDIRECTED` only
 * to `type: REFERRAL`; `TRANSFER_*` only to `type: PATIENT`. `APPROVED`/
 * `REJECTED`/`APPEAL_*` apply to USER and FACILITY; `FLAGGED`/`UNFLAGGED`
 * apply to USER, FACILITY, *and* PATIENT (patient flags are a direct,
 * appeal-free action — see `modules/patients/service.ts` — unlike
 * User/Facility, where a flag is only ever reversed via an approved
 * appeal). `TRANSFER_REQUESTED`'s own row is the stable identifier for a
 * transfer request throughout its whole lifecycle (both decision steps
 * reference it by id, not a separate row each time) — see
 * `api/src/lib/transfer.ts`. None of this is enforced at the DB level —
 * it's the same trust boundary as `entity` itself, upheld by the handlers
 * that write these rows, not a constraint.
 */
export const TIMELINE_ACTION = {
	STATUS_CHANGE: "STATUS_CHANGE",
	DOCTOR_ASSIGNED: "DOCTOR_ASSIGNED",
	REDIRECTED: "REDIRECTED",
	TRANSFER_REQUESTED: "TRANSFER_REQUESTED",
	TRANSFER_APPROVED_ORIGIN: "TRANSFER_APPROVED_ORIGIN",
	TRANSFER_APPROVED_DESTINATION: "TRANSFER_APPROVED_DESTINATION",
	TRANSFER_REJECTED: "TRANSFER_REJECTED",
	APPROVED: "APPROVED",
	REJECTED: "REJECTED",
	DISABLED: "DISABLED",
	FLAGGED: "FLAGGED",
	UNFLAGGED: "UNFLAGGED",
	SUSPENDED: "SUSPENDED",
	DEPARTED: "DEPARTED",
	APPEAL_SUBMITTED: "APPEAL_SUBMITTED",
	APPEAL_APPROVED: "APPEAL_APPROVED",
	APPEAL_DENIED: "APPEAL_DENIED",
} as const;

/**
 * Referral lifecycle states. Uppercase, matching the naming convention
 * applied everywhere else (`USER_STATUS`, `FACILITY_STATUS`, etc.) — see
 * `docs/roles-permissions.md` Row 4. This is a real data migration, not
 * just a naming choice: the DB enum, every string comparison in
 * `referrals/service.ts`, and the frontend's status labels/badges all had
 * to move together, atomically.
 */
export const REFERRAL_STATUS = {
	PENDING: "PENDING",
	ACCEPTED: "ACCEPTED",
	IN_PROGRESS: "IN_PROGRESS",
	ON_HOLD: "ON_HOLD",
	COMPLETED: "COMPLETED",
	REJECTED: "REJECTED",
	CANCELED: "CANCELED",
} as const;

/** No further transitions out of these — shared by backend guards and the frontend's edit/action visibility. */
export const TERMINAL_REFERRAL_STATUSES: (typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS][] =
	[
		REFERRAL_STATUS.COMPLETED,
		REFERRAL_STATUS.REJECTED,
		REFERRAL_STATUS.CANCELED,
	];

/**
 * Legal next states for each referral status. Enforced server-side by
 * `PATCH /referrals/:id/status` before writing, per build-spec.md section 2.3.
 */
export const STATUS_TRANSITIONS: Record<
	(typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS],
	(typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS][]
> = {
	[REFERRAL_STATUS.PENDING]: [
		REFERRAL_STATUS.ACCEPTED,
		REFERRAL_STATUS.REJECTED,
		REFERRAL_STATUS.CANCELED,
		REFERRAL_STATUS.ON_HOLD,
	],
	[REFERRAL_STATUS.ACCEPTED]: [
		REFERRAL_STATUS.IN_PROGRESS,
		REFERRAL_STATUS.ON_HOLD,
		REFERRAL_STATUS.REJECTED,
	],
	[REFERRAL_STATUS.IN_PROGRESS]: [
		REFERRAL_STATUS.COMPLETED,
		REFERRAL_STATUS.ON_HOLD,
	],
	[REFERRAL_STATUS.ON_HOLD]: [
		REFERRAL_STATUS.PENDING,
		REFERRAL_STATUS.ACCEPTED,
		REFERRAL_STATUS.IN_PROGRESS,
		REFERRAL_STATUS.CANCELED,
	],
	[REFERRAL_STATUS.COMPLETED]: [],
	[REFERRAL_STATUS.REJECTED]: [],
	[REFERRAL_STATUS.CANCELED]: [],
};

/**
 * Which target statuses Nurses may set via `PATCH /referrals/:id/status`,
 * layered on top of `STATUS_TRANSITIONS` (both must allow the move). Per the
 * PDF's per-role action lists: Nurses track/hold/cancel.
 */
export const NURSE_STATUS_TARGETS: (typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS][] =
	[REFERRAL_STATUS.CANCELED, REFERRAL_STATUS.ON_HOLD, REFERRAL_STATUS.PENDING];

/**
 * Doctor's allowed targets depend on the referral's *current* status, not a
 * flat list — reject/hold only make sense once a case has actually been
 * started (`in_progress`); before that, `accepted` only ever moves forward
 * (Start) or away (Cancel). `pending` is deliberately absent — assignment
 * (self- or Manager-performed) always auto-accepts, so a Doctor is never
 * expected to act on a still-`pending` referral via this endpoint.
 */
export const DOCTOR_STATUS_TARGETS_BY_STATUS: Partial<
	Record<
		(typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS],
		(typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS][]
	>
> = {
	[REFERRAL_STATUS.ACCEPTED]: [
		REFERRAL_STATUS.IN_PROGRESS,
		REFERRAL_STATUS.CANCELED,
	],
	[REFERRAL_STATUS.IN_PROGRESS]: [
		REFERRAL_STATUS.ON_HOLD,
		REFERRAL_STATUS.COMPLETED,
		REFERRAL_STATUS.REJECTED,
		REFERRAL_STATUS.CANCELED,
	],
	[REFERRAL_STATUS.ON_HOLD]: [
		REFERRAL_STATUS.IN_PROGRESS,
		REFERRAL_STATUS.CANCELED,
	],
};

export const PRIORITY = {
	LOW: "low",
	MEDIUM: "medium",
	HIGH: "high",
	URGENT: "urgent",
} as const;

/**
 * The most common gender options on real-world registration forms, plus
 * `OTHER` to accommodate everyone else rather than enumerating every case.
 */
export const GENDER = {
	MALE: "MALE",
	FEMALE: "FEMALE",
	OTHER: "OTHER",
} as const;

export const LOGIN_STATUS = {
	SUCCESS: "success",
	FAILED: "failed",
	LOCKED_OUT: "locked_out",
} as const;
