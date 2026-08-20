# Healthcare Referral System — Build Spec

**Status: superseded by the live codebase.** This was the original
pre-build planning doc (3 roles, lowercase statuses, no Manager/facility-
moderation/specialties/timeline model). None of that survived contact with
actual development — the system that got built is a materially different,
larger design. This doc is now a high-level **as-built map with pointers**,
not a spec to build against. For anything below, the file it points to is
the source of truth; if this doc and the code ever disagree, the code wins
and this doc is stale.

- **DB schema, in full**: [`docs/database.md`](docs/database.md) — every
  table, column, index, and the ER diagram. Not duplicated here.
- **Roles, permissions, and how the whole design got there**:
  [`docs/roles-permissions.md`](docs/roles-permissions.md) — the confirmed
  permission matrix plus the full decision history behind it.
- **Open gaps and parked ideas**: [`docs/backlog.md`](docs/backlog.md).
- **Known defects**: [`docs/bugs.md`](docs/bugs.md) (empty as of
  2026-08-20 — nothing currently open).
- **Real-world walkthroughs of how it all behaves today**:
  [`docs/scenarios/`](docs/scenarios/README.md), 32 scenarios and counting.

---

## 1. Tech Stack

| Layer         | Choice                                              |
| ------------- | ---------------------------------------------------- |
| API           | Fastify + TypeScript                                |
| ORM           | Drizzle                                             |
| DB            | MySQL (AWS RDS in staging; see `env/staging/`)      |
| Auth          | Better Auth (cookie sessions, email/password), password hashing fully cut over to **Argon2id** (`api/src/lib/password.ts`) — never better-auth's default scrypt |
| Validation    | Zod (shared between API and frontend via `/shared`) |
| Frontend      | Vite + React + TypeScript                           |
| Data fetching | TanStack Query                                      |
| UI            | Tailwind + shadcn/ui                                |
| Routing       | TanStack Router + role-guarded routes               |

Chatbot and AWS infra remain out of scope of this app's own codebase.

Repo layout (unchanged from the original plan):

```
/api      → Fastify server
/web      → React frontend
/shared   → Zod schemas + inferred types, imported by both
```

Backend module layout follows the confirmed read-vs-write split
(`docs/backlog.md`, "Backend API URL structure"): `modules/patients`,
`modules/referrals`, `modules/facilities`, `modules/users` hold the shared,
resource-first **read** handlers (`GET`), scoped server-side by role; the
role-exclusive **write/action** handlers live in their own role-first
modules — `modules/manager`, `modules/administrator`, `modules/account`,
`modules/transfers`. A dedicated `api/src/management/` layer
(`ModerationManager`, `AppealManager`, `TransferManager`, `SessionManager`,
`AuditManager`) holds cross-repository business workflows composed from
`api/src/core/*` repositories — the only layer that may touch Drizzle
directly; `api/src/lib/*` (aside from `database.ts`/`auth.ts`) is pure
predicates only.

---

## 2. Roles

Four roles, not three — **Nurse, Doctor, Manager, Administrator**
(`FACILITY_ADMIN` was renamed to `Manager` early on; there is no trace of
the old name left in code). Full responsibilities and the confirmed
permission matrix live in `docs/roles-permissions.md` — summary:

- **Nurse** — creates patients/referrals, limited status moves
  (cancel/hold/pending), requests patient facility-transfers.
- **Doctor** — accepts/progresses/rejects referrals assigned to them,
  self-assigns unassigned referrals at their facility, redirects a referral
  to another facility, updates a patient's clinical `history` only, flags/
  unflags a patient (advisory-only).
- **Manager** — moderates their own facility's Nurse/Doctor accounts
  (approve/reject/disable/flag), assigns a doctor to a `PENDING` referral
  sent to their facility, decides patient-transfer requests on either side,
  updates their own facility's profile, manages specialty assignment for
  their facility and staff, decides appeals against their own staff.
- **Administrator** — moderates Manager accounts and facilities (approve/
  reject/disable/flag/suspend), creates user accounts directly (temp
  password + forced change), resets passwords, manages the specialty
  vocabulary, decides appeals against Managers/facilities, has read-only
  aggregate dashboard/report access but **no** direct read/write access to
  individual Patient/Referral records.

Registration is an approval chain, not open self-service: Manager
self-registers (with a new-or-existing facility) and needs Administrator
approval; Nurse/Doctor self-register and need their Manager's approval;
Administrator accounts are never created via public sign-up — only by an
existing Administrator or the one-time bootstrap script
(`api/script/bootstrap-admin.ts`).

---

## 3. Database Schema

Full schema, ER diagram, and table-by-table notes: **`docs/database.md`**.
Not repeated here — this doc previously duplicated it and the two drifted
out of sync, which is exactly the failure mode `docs/database.md`'s own
header now warns about. Headline differences from the original plan below,
for anyone comparing against an old mental model of this system:

- Every domain table (`patients`, `referrals`, `facilities`, `user`, etc.)
  uses `created_at`/`updated_at` (not `created`/`updated`), and most FK
  columns keep their full referential name (`referrer_id`, `origin_facility_id`,
  `destination_facility_id`) rather than the abbreviated `created_by`/
  `origin`/`destination` this doc originally proposed.
- `referrals` has both `visit_reason` and `referral_reason` (both required),
  not a single `reason` field.
- The single `timeline` table (polymorphic `type`/`entity`/`action`)
  replaced the referral-only `timeline` (was `referral_status_history`) this
  doc originally scoped — it now also covers User, Facility, and (patient
  flag only) Patient history, with 17 `TIMELINE_ACTION` values, not just
  status transitions.
- `logins` (was `login_audit`) keeps its own shape close to the original
  plan (`login_at`/`logout_at`/`ip`/`device`/`status`), plus a `reason`
  column added since.
- A `facilities` table exists (it didn't in the original 3-role plan at
  all) — every user, patient, and referral is facility-scoped.
- `specialties` + three link tables (`facility_specialties`,
  `user_specialties`, `referral_specialties`) were added entirely after
  this doc's original scope.
- Every table is soft-status-lifecycle-only — **there is no hard delete
  anywhere** for User, Facility, or Referral (Patient has no status enum at
  all yet — see `docs/backlog.md`'s "No patient data retention..." entry).
  The original `DELETE /patients/:id` / `DELETE /referrals/:id` routes this
  doc specified were removed entirely, not kept as an Administrator-only
  carve-out.

### Referral status transitions

`REFERRAL_STATUS` values are uppercase (`PENDING`/`ACCEPTED`/`IN_PROGRESS`/
`ON_HOLD`/`COMPLETED`/`REJECTED`/`CANCELED`), not the lowercase values this
doc originally specified. The transition table and the two role-specific
target-status restrictions both live in `shared/src/constant.ts`, not
inline in this doc (so they can't drift from the enforced code):

- `STATUS_TRANSITIONS` — which statuses a referral may move *to* from its
  current status, independent of who's asking.
- `NURSE_STATUS_TARGETS` — a flat list (`CANCELED`/`ON_HOLD`/`PENDING`), the
  same regardless of the referral's current status.
- `DOCTOR_STATUS_TARGETS_BY_STATUS` — depends on the referral's *current*
  status (`ACCEPTED` → in-progress/rejected/canceled; `IN_PROGRESS` →
  hold/complete/cancel; `ON_HOLD` → in-progress/cancel). `PENDING` is
  deliberately absent — assignment always auto-accepts, so a Doctor never
  acts on a still-`PENDING` referral via this endpoint.
- Manager and Administrator are unrestricted by the target-status tables
  (still bound by `STATUS_TRANSITIONS` itself) — though in practice neither
  role calls `PATCH /referrals/:id/status` at all under the current
  permission matrix; Manager's only referral-mutating action is doctor
  assignment, and Administrator has no referral write access.

Every transition call validates against these tables server-side before
writing, and always inserts a `timeline` row (`type: REFERRAL`,
`action: STATUS_CHANGE`) — a reason (`notes`) is required on every
transition, no exceptions by status.

---

## 4. Shared Zod Schemas (`/shared/src/schema/*`)

The original single `/shared/schemas.ts` file this doc specified was split
into one file per domain under `shared/src/schema/` (`patient.ts`,
`referral.ts`, `facility.ts`, `user.ts`, `specialty.ts`, `timeline.ts`,
`transfer.ts`, `authentication.ts`, `account.ts`, `administrator.ts`,
`global.ts`, `field.ts` for shared primitives like `nameSchema`/
`stringSchema`, ...), not one flat file. `shared/src/constant.ts` holds
every enum (`ROLES`, `USER_STATUS`, `FACILITY_STATUS`, `REFERRAL_STATUS`,
`PRIORITY`, `GENDER`, `LOGIN_STATUS`, `TIMELINE_TYPE`, `TIMELINE_ACTION`),
the status-transition tables above, `API_PATHS`/`API_URLS`/`FRONTEND_URLS`
(every route path in the app resolves from these, backend and frontend
alike — no literal route strings), and the shared usability/appealability
status-set constants (`UNUSABLE_USER_STATUSES`,
`UNUSABLE_FACILITY_STATUSES`, `APPEALABLE_USER_STATUSES`,
`APPEALABLE_FACILITY_STATUSES`) consumed by both `api/src/lib/permission.ts`
and `web/src/lib/permissions.ts`.

The specific schema shapes in the original doc (`CreatePatientSchema`,
`CreateReferralSchema`, ...) are stale in their field lists (see §3 above)
but the *pattern* — Zod schema in `/shared`, inferred type used by both API
route validation and frontend forms — is exactly what shipped, unchanged.

---

## 5. API Routes — as built

Every route path is a named constant in `API_PATHS`
(`shared/src/constant.ts`) resolved under a namespace's base URL from
`API_URLS`. This section maps each module to its role gate — the phased
"build order" framing from the original doc is gone (the system is fully
built), replaced with what actually exists today.

### Auth (`modules/authentication`, `modules/account`) — no role gate beyond authentication

| Method | Path | Notes |
| --- | --- | --- |
| POST | `SIGN_UP` | extended with `role`; Administrator not selectable from public sign-up |
| POST | `SIGN_IN` | |
| POST | `SIGN_OUT` | closes the caller's open `logins` row |
| GET | `SESSION` | includes `must_change_password` |
| GET | `ACCOUNT_STATUS` | reachable regardless of account status — status/reason for a non-`ACTIVE` account |
| POST | `ACCOUNT_APPEAL` | file an appeal against your own account's status |
| PATCH | `ACCOUNT_CHANGE_PASSWORD` | self-service; also the exit path for a `must_change_password` account |

### Patients (`modules/patients`) — shared reads, role-scoped writes

| Method | Path | Role(s) |
| --- | --- | --- |
| POST | `PATIENT_LIST` (create) | Nurse |
| GET | `PATIENT_LIST` / `PATIENT_BY_ID` | Nurse, Doctor, Manager (facility-scoped; cross-facility read allowed if the caller's facility is party to an active referral for that patient) |
| PATCH | `PATIENT_BY_ID` | Nurse (all editable fields), Doctor (`history` only) |
| PATCH | `PATIENT_FLAG` / `PATIENT_UNFLAG` | Doctor only, advisory marker |
| POST | `PATIENT_TRANSFER_REQUEST` | Nurse, Doctor, at the patient's current facility |

Administrator has **no** direct Patient read/write access at all (aggregate
dashboard counts only) — a deliberate reduction from the original plan.

### Referrals (`modules/referrals`) — shared reads, role-scoped writes

| Method | Path | Role(s) |
| --- | --- | --- |
| POST | `REFERRAL_LIST` (create) | Nurse |
| GET | `REFERRAL_LIST` / `REFERRAL_BY_ID` | Nurse, Doctor, Manager (role-scoped: own-created for Nurse, assigned for Doctor, own-facility origin-or-destination for Manager) |
| PATCH | `REFERRAL_BY_ID` | Nurse (own, non-terminal), Manager (doctor assignment on a `PENDING` referral sent to their facility) |
| PATCH | `REFERRAL_STATUS_UPDATE` | Nurse, Doctor — see §3's transition tables |
| PATCH | `REFERRAL_ASSIGN` | Doctor — self-assign an unassigned referral at their facility |
| PATCH | `REFERRAL_REDIRECT` | Doctor — assigned, or unassigned at the destination facility |
| GET | `REFERRAL_HISTORY` | Nurse, Doctor, Manager (own-scoped) |
| GET/POST/DELETE | `REFERRAL_SPECIALTY_*` | Nurse, Doctor (assign/unassign); Manager (view only) |

Administrator has no direct Referral read/write access either.

### Facilities (`modules/facilities`) — shared reads, role-scoped writes

| Method | Path | Role(s) |
| --- | --- | --- |
| GET | `FACILITY_LIST` / `FACILITY_BY_ID` / `FACILITY_HISTORY` | Administrator, Manager |
| PATCH | `FACILITY_BY_ID` | Manager, own facility only (name/address) |
| GET/POST/DELETE | `FACILITY_SPECIALTY_*` | view: Administrator or the facility's own Manager; assign/unassign: Manager only |

There is no `POST /facilities` at all — a facility only ever comes into
being paired with a Manager's own sign-up application. Administrator can't
create or update a facility directly, only `flag`/`suspend` it (below).

### Users (`modules/users`) — shared reads, role-scoped writes

| Method | Path | Role(s) |
| --- | --- | --- |
| GET | `USER_LIST` / `USER_BY_ID` / `USER_HISTORY` | Administrator, Manager |
| GET/POST/DELETE | `USER_SPECIALTY_*` | view: Administrator, Manager; assign/unassign: Manager only (target must be Doctor/Nurse) |

Per-user moderation actions (approve/reject/flag/disable) are role-first,
below — there is no generic `PATCH /users/:id`; self-editing one's own name
was designed (`docs/roles-permissions.md`) but was **never actually built**
(see `docs/backlog.md`'s "User profile pages" entry) — no route exists.

### Manager (`modules/manager`) — role-first writes, Manager only

Staff moderation (`MANAGER_STAFF_APPROVE/REJECT/DISABLE/FLAG`, own facility,
Nurse/Doctor targets), `MANAGER_FACILITY_APPEAL` (appeal a flagged/suspended
own facility), appeal decisions on own staff
(`MANAGER_APPEAL_APPROVE/DENY/LIST`), both sides of transfer decisions
(`MANAGER_TRANSFER_ORIGIN/DESTINATION_APPROVE/REJECT`, `_LIST`), and
`MANAGER_AUDIT_LIST` (facility-scoped activity feed over `timeline`).

### Administrator (`modules/administrator`) — role-first writes, Administrator only

Manager moderation (`ADMINISTRATOR_MANAGER_APPROVE/REJECT/DISABLE/FLAG`),
staff moderation as an emergency-override/orphan-facility fallback
(`ADMINISTRATOR_STAFF_*`), facility moderation
(`ADMINISTRATOR_FACILITY_APPROVE/REJECT/FLAG/SUSPEND`), user account
creation with a one-time temp password (`ADMINISTRATOR_USER_CREATE`),
password reset (`ADMINISTRATOR_USER_RESET_PASSWORD`), appeal decisions on
Managers/facilities (`ADMINISTRATOR_APPEAL_*`), and both sides of transfer
decisions as the orphan-facility fallback
(`ADMINISTRATOR_TRANSFER_*`).

### Dashboard (`modules/dashboard`) — one endpoint per role, distinct response shapes

`DASHBOARD_NURSE_SUMMARY`, `DASHBOARD_DOCTOR_SUMMARY`,
`DASHBOARD_ADMIN_SUMMARY`, `DASHBOARD_MANAGER_SUMMARY` — each gated to
exactly its own role, each a purpose-built aggregate (counts, status
breakdowns; Manager's also includes `pending_staff_applications` and
`pending_transfers`).

### Reports (`modules/reports`)

`REPORTS_REFERRALS` — Nurse, Doctor, Manager, Administrator, all scoped
server-side to what each role can already see elsewhere (own-created,
assigned, own-facility, or system-wide for Administrator).

### Audit (`modules/audit`) + Specialties (`modules/specialties`)

`AUDIT_LOGINS` — Administrator only, session/login history from `logins`.
(Administrator's *action*-level audit trail is `ADMINISTRATOR`'s own
implicit view — see `docs/backlog.md`'s "Administrator audit page shows
logins only" entry for the known gap here.)

`SPECIALTY_LIST`/`SPECIALTY_BY_ID` (GET open to any authenticated role;
create/rename Administrator-only, no delete) — the reference vocabulary
that `FACILITY_SPECIALTY_*`/`USER_SPECIALTY_*`/`REFERRAL_SPECIALTY_*`
above all link against.

---

## 6. What's genuinely still open

This doc's original "Open items to confirm with teammate" section is gone
— both items it listed (chatbot contract, "is the 3-role model locked")
are moot; the role model changed to 4 and the chatbot was never picked up.
The real, current list of open gaps and defects lives in
[`docs/backlog.md`](docs/backlog.md) (~30 entries as of 2026-08-17, mostly
scope questions found via scenario testing — staleness signals, bulk
actions, concurrency control, notifications, patient data retention, and
more) and [`docs/bugs.md`](docs/bugs.md) (currently empty). Check those two
files directly rather than this one for anything resembling a roadmap.
