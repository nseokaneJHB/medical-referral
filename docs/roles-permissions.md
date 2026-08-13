# Roles & Permissions — Planning Doc

See also: [docs/backlog.md](./backlog.md) for parked ideas raised in passing
(facility specialties, user profile pages, etc.) that overlap with this work
but aren't in scope yet.

Status: **IMPLEMENTATION IN PROGRESS.** Design (matrix, timeline table shape,
approval-chain flow) is fully confirmed — see below. As of 2026-08-10, the
rename, centralized permission module, approval-chain/appeals routes, and
shared timeline table are **substantially built already**, discovered via a
code audit after a VS Code crash lost the in-session record of how far this
had gotten (see "Session log"). Treat the "Current implementation status"
section right below as the first thing to check after any crash/restart —
it's more current than the narrative sections further down, which still
describe the design conversation, not the build.

## Current implementation status (as of 2026-08-10, post-crash audit)

Confirmed **done**, by reading the actual code (not inferred from the design
sections below, which predate this):
- **Rename shipped.** `shared/src/constant.ts`'s `ROLES` is
  `{NURSE, DOCTOR, ADMINISTRATOR, MANAGER}` — no `FACILITY_ADMIN` anywhere.
- **`USER_STATUS`, `FACILITY_STATUS`, `TIMELINE_TYPE`, `TIMELINE_ACTION`**
  all exist in `shared/src/constant.ts`, matching the design below (pending/
  active/rejected/disabled/flagged/departed for users; pending/approved/
  rejected/flagged/suspended for facilities; the shared-table `type`/`action`
  enums).
- **Centralized permission module exists**: `api/src/lib/permission.ts` —
  `isAccountUsable`, `isFacilityUsable`, `canManagerActOnStaff`,
  `canActOnReferral`, `canViewReferral`, `canAccessPatient`, `canViewUser`,
  `isFacilityOrphaned`, `canFileAppeal`, `canFileFacilityAppeal`,
  `resolveAppealAuthority`. Implements the orphan-facility fallback and the
  appeal-authority resolution (most recent punitive timeline row → that
  actor's *current* role) as designed.
- **Approval-chain + appeals routes exist and are wired up**:
  `api/src/modules/administrator/route.ts` (manager/staff/facility approve-
  reject-flag-disable-suspend, appeals list/approve/deny, admin-created-user)
  and `api/src/modules/manager/route.ts` (staff approve/reject/disable/flag,
  facility appeal submit, appeals list/approve/deny) — both gated correctly
  via `app.authorize([ROLES.ADMINISTRATOR])` / `[ROLES.MANAGER]`.
- **Migrations collapsed to one file** (per [[feedback_migrations_single_file]]
  convention) — a single `api/src/drizzle/migrations/0000_*.sql`, regenerated
  fresh (not accumulated) each time the schema changes, most recently for
  the `REFERRAL_STATUS` uppercase migration below.
- `api/script/bootstrap-admin.ts` exists, matching the confirmed bootstrap
  design below.
- `api`/`shared` typecheck clean.

**Confirmed** (checked after first writing this section as "unverified"):
- Shared timeline table matches the agreed shape exactly:
  `api/src/drizzle/schema/timeline.ts` has `id`/`type`/`entity`/`action`/
  `previous`/`next`/`changer_id`/`notes`/`changed_at`, polymorphic `entity`
  (no FK, by design) with a real FK kept only on `changer_id`.
- **`REFERRAL_STATUS` uppercased (done, 2026-08-10)** — `shared/src/constant.ts`
  now matches `USER_STATUS`/`FACILITY_STATUS`'s convention
  (`PENDING`/`ACCEPTED`/`IN_PROGRESS`/`ON_HOLD`/`COMPLETED`/`REJECTED`/
  `CANCELED`). Done as one atomic pass: DB enum regenerated + dev DB reset/
  reseeded (no in-place data migration — pre-release, matches
  [[feedback_migrations_single_file]]), `referrals/$referralId.tsx`'s
  `STATUS_VARIANT`/`TRANSITION_ACTION_LABELS` fixed to computed
  `[REFERRAL_STATUS.X]` keys (were loosely-typed `Record<string,...>` with
  hardcoded lowercase literals — a real latent bug the casing change would
  have made worse, now `Record<ReferralStatus,...>` so TS enforces
  exhaustiveness). `reports/service.ts`'s `by_status` breakdown deliberately
  kept lowercase field names via an explicit remap (mirrors
  `dashboard/service.ts`'s existing per-status-count pattern) — the
  aggregate response shape is intentionally decoupled from the enum's
  casing, not something this migration needed to touch. Verified end-to-end
  against the live dev API (sign-in, flag/unflag round-trip, reports and
  dashboard summaries) after the reset, not just typecheck.
- **Patient flagging (advisory-only marker) — done, 2026-08-10.**
  `PATCH /patients/:id/flag` (reason required) and `/:id/unflag` (Doctor-only),
  `flagged`/`flag_reason` computed fields added to `PatientSchema` (derived
  from the most recent `FLAGGED`/`UNFLAGGED` timeline row, not a stored
  column — batched lookup so the list view doesn't pay an N+1 cost). Frontend:
  a flagged banner (visible to whoever can already see the patient) plus a
  Doctor-only flag/unflag dialog on `patients/$patientId.tsx`.
- **Manager dashboard backend is real, not a stub** —
  `dashboard/service.ts`'s `managerSummary` is fully implemented
  (facility-scoped staff/patient/referral totals + status breakdown).
  **Gap, not yet built**: the design's "pending-actions count" (outstanding
  Nurse/Doctor applications + pending patient-transfer requests awaiting
  this Manager's decision) isn't part of `managerSummary`'s response yet —
  patient transfer now exists (below) as of this same day, so this is a
  real, standalone gap worth picking up, not blocked on anything else.
- **Non-`ACTIVE` users are correctly restricted to "view my own status
  only" — confirmed.** `web/src/routes/_authenticated.tsx`'s `beforeLoad`
  redirects any non-`ACTIVE` user to `/account-status`, a standalone route
  *outside* the `_authenticated` layout (no sidebar, no access to the real
  app) showing their status badge, reason, and an appeal form
  (`web/src/routes/account-status.tsx`) — exactly the design's "sign-in
  succeeds, every real resource stays blocked" model.

- **Doctor-initiated referral redirect — done, 2026-08-10.**
  `PATCH /referrals/:id/redirect` (Doctor-only, reason required): destination
  must be `FACILITY_STATUS.APPROVED`; refuses any facility this referral has
  already been at (origin, current destination, or any prior redirect's
  destination — computed from `TIMELINE_ACTION.REDIRECTED` rows for this
  referral, no arbitrary hop limit); resets `status` to `PENDING` and clears
  `doctor` at the new destination; blocked once terminal. New
  `canRedirectReferral` permission predicate (assigned doctor, or
  unassigned-and-destined-to-their-facility — same eligibility as
  `canViewReferral`'s Doctor branch, deliberately broader than
  `canActOnReferral`'s "must already be assigned"). Required a second DB
  reset/regenerate/reseed beyond the `REFERRAL_STATUS` one above — adding
  `TIMELINE_ACTION.REDIRECTED` to the shared enum after the first reset
  meant the live `timeline.action` DB enum didn't have it yet, and MySQL
  silently truncated the insert (500, not a validation error) until
  regenerated again. Verified end-to-end against the live API: successful
  redirect, redirect-to-origin rejected, redirect-to-prior-destination
  rejected, redirect-to-non-`APPROVED`-facility rejected, and that the
  original doctor correctly loses `canViewReferral`/`canRedirectReferral`
  access once it moves to a facility that isn't theirs (confirmed this is
  correct behavior per the permission model, not a bug, mid-testing).
  Frontend: a Redirect dialog (facility picker + required reason) on
  `referrals/$referralId.tsx`, gated the same way as the backend.

- **Two-sided patient facility-transfer workflow — done, 2026-08-10.** No
  dedicated table — the whole request/origin-decide/destination-decide
  episode is a run of rows in the shared `timeline` table (`type: PATIENT`),
  same append-only-log approach as everything else in this design. New
  `api/src/lib/transfer.ts` holds the query/resolution helpers, since the
  decision endpoints are exposed under both `modules/manager` and
  `modules/administrator` (the latter as the orphan-facility fallback, via
  the already-existing `isFacilityOrphaned`) — not owned by `modules/patients`
  alone, even though request-creation (`POST /patients/:id/transfer`, Nurse/
  Doctor at the patient's *current* facility only) is. Destination must be
  `APPROVED`; only one transfer can be open per patient at a time; a
  rejection at either step ends it with the patient staying put; `facility_id`
  only actually changes on destination-approval. No parent-request foreign
  key links a later decision row back to its original request (timeline rows
  don't support that) — instead, `TRANSFER_REQUESTED`'s own row id is the
  stable identifier for the whole episode throughout, and the one-open-
  transfer-at-a-time invariant is what makes that safe (a patient's most
  recent `TRANSFER_REQUESTED` row is unambiguously the current episode's
  origin, since a new one literally can't exist yet while an old one's open).
  Frontend: a request dialog on `patients/$patientId.tsx` (Nurse/Doctor), and
  a new `/transfers` page (Manager/Administrator) listing pending decisions
  with approve/reject actions, which side (origin/destination) inferred
  purely from the row's `action` — no facility-id comparison needed
  client-side, the list endpoint is already scoped server-side.
  Verified end-to-end against the live API: request creation, duplicate-
  while-open rejection, non-`APPROVED`-destination rejection, origin
  approve, origin reject, re-deciding an already-decided request rejected,
  wrong-facility destination-decide correctly `403`s, and a new request
  becomes possible again after the prior one closes.
  **2026-08-11 follow-up:** destination-approval's actual `facility_id`
  update also verified live — user supplied a second Manager account
  (`Nolan Kgotso` / `nolan.kgotso@gmail.com`), registered via public
  sign-up joining Denesikmouth Memorial Hospital (the exact destination of
  the still-open request from the day before), approved by Administrator,
  then used to destination-approve that request: `action` correctly moved
  to `TRANSFER_APPROVED_DESTINATION`, the patient's `facility_id` in the DB
  actually changed (confirmed via direct query, not just the API response),
  and the new manager's pending-transfers queue correctly emptied
  afterward. The full two-sided loop is now independently live-verified
  end to end, not just sharing a code path with something else that was.
- **Manager dashboard pending-actions count — done, 2026-08-11.**
  `GET /dashboard/manager/summary` gained `pending_staff_applications`
  (outstanding Nurse/Doctor applications at this Manager's facility) and
  `pending_transfers` (open transfer requests awaiting this Manager's
  decision, either side) — the count the original design called for as
  "a surface" pointing at the approval-chain queues this whole redesign
  built. `getPendingTransfersForFacility` (`api/src/lib/transfer.ts`) was
  factored out of the `/manager/transfers` list endpoint so both reuse the
  identical filtering logic. Frontend: two more stat cards on the Manager
  dashboard, highlighted and clickable through to `/users`/`/transfers`
  when non-zero. Verified live: counts matched the real
  `/manager/transfers` list total and a real pending Doctor application.
  **Gap noted here was closed 2026-08-12** — see "Both remaining gaps
  closed" below; clicking through for staff applications now lands on a
  `/users` that actually has approve/reject UI.
- **Administrator orphan-facility fallback for transfers — verified live,
  2026-08-11.** No seeded facility had zero active Managers, so the user
  had me manufacture the scenario directly: disabled a real facility's
  only active Manager (Administrator action, reversed via direct DB write
  afterward since it was purely a test artifact — no clean "undo" action
  exists for a `DISABLE`, by design, short of a real appeal), confirming
  both directions on an already-open, already-origin-approved request:
  Administrator's `/administrator/transfers` queue correctly picked up the
  now-orphaned destination facility's pending decision; the destination-
  approve succeeded and the patient's `facility_id` genuinely moved
  (confirmed via direct query); and, as a negative-case check, Administrator
  attempting to decide a *different* transfer whose relevant facility still
  had an active Manager was correctly `403`'d — the fallback only fires
  when it's supposed to, not as a blanket override.

With both of these closed, everything called out as open in this doc as of
2026-08-10/11 is now either done or explicitly named as a pre-existing,
separate gap (the staff-application moderation frontend, and the
API_PATHS/FRONTEND_URLS backfill-everywhere question).

**Both remaining gaps closed, 2026-08-12:**
- **Staff/manager moderation frontend — done.** `GET /users` (Manager and
  Administrator) now has real row actions instead of just "View":
  Approve/Reject on `PENDING` rows, Flag/Disable on `ACTIVE`, Disable-only
  on `FLAGGED` — matching each backend action's own status precondition.
  `resolveModerationFns` in `users/index.tsx` picks the right endpoint set
  per row: `*Manager` (Administrator-only, target role `MANAGER`) or
  `*Staff` (both `/manager/staff/*` and, as the orphan-facility fallback,
  `/administrator/staff/*`, target role `NURSE`/`DOCTOR`) — a Manager
  viewing another Manager, or anyone viewing an Administrator, gets no
  action buttons at all. New `web/src/api/users.ts` write functions:
  `approveStaff`/`rejectStaff`/`flagStaff`/`disableStaff` (namespaced like
  `api/transfers.ts`) and `approveManager`/`rejectManager`/`flagManager`/
  `disableManager`. Verified live for every action, both roles, via
  disposable public-sign-up test accounts (cleaned up after) — this closes
  the dashboard's "pending staff applications" card, which previously
  linked to a page with nothing to click.
  - **Found and fixed a real, unrelated bug while wiring this up**:
    `queryClient.invalidateQueries()` followed by `router.invalidate()`
    (even passing `{ sync: true }`) does not reliably re-render
    `Route.useLoaderData()` after an in-place mutation on this TanStack
    Router version — a moderation action would toast success but the row
    would keep showing its old status until an unrelated navigation. The
    `transfers` page had the identical latent bug (introduced when it was
    built, never caught because live-testing that page apparently always
    happened via full page reloads rather than in-app clicks). Root-caused
    via reverse-engineering `@tanstack/router-core`'s `load-matches.js`
    (`shouldSkipLoader`/dehydration and the `invalid`/`sync` branches in
    `handleLoader`) rather than guessed at. Real fix: both pages now read
    their table data via `useSuspenseQuery` (keyed identically to the
    loader's `ensureQueryData` call, so no extra fetch) instead of
    `useLoaderData()` — a live query-cache subscription, which
    `invalidateQueries` alone is enough to refresh. Left a smaller,
    lower-risk version of the same `sync: true` mitigation on the three
    single-record detail pages (`facilities/$facilityId.tsx`,
    `patients/$patientId.tsx`, `referrals/$referralId.tsx`) that also call
    `router.invalidate()` after a save — not reworked to `useSuspenseQuery`
    this pass, flagged here as the same class of bug if it turns out to
    still manifest there.
- **`API_PATHS`/`FRONTEND_URLS` backfill — done.** Swept both `web/src`
  and `api/src` for any literal route string that should have resolved
  through a named constant and hadn't. Backend was already fully clean.
  Frontend had several stragglers, all in shared chrome rather than
  feature pages: `redirect({ to: "/sign-in" })`/`"/"`/`"/account-status"`
  in route guards (`account-status.tsx`, `_authenticated.tsx`,
  `audit/index.tsx`), and `to="/"` home links in `side-bar.tsx`,
  `not-found.tsx`, `error.tsx`, `navigation.tsx`, and the sign-out
  redirect in `sign-out-button.tsx`. Added `FRONTEND_URLS.ACCOUNT_STATUS`,
  which hadn't existed. No behavior change — every literal was replaced
  with the constant already holding that exact string.

**Four more gaps found 2026-08-12, via a systematic sweep** (every
`API_PATHS` entry cross-checked against actual frontend callers, prompted
by "anything left outstanding?") — all backend-complete, zero frontend
callers, none previously named in this doc:
- **Facility moderation** — `ADMINISTRATOR_FACILITY_APPROVE/REJECT/FLAG/
  SUSPEND`. No page lets an Administrator flag or suspend a facility, or
  approve/reject one standalone — approval currently only happens as a side
  effect of approving the Manager who registered it (`managerApprove`'s
  transaction).
- **Appeals review queue** — `ADMINISTRATOR_APPEAL_APPROVE/DENY/LIST` and
  `MANAGER_APPEAL_APPROVE/DENY/LIST`. The appeal *submission* form exists
  (`account-status.tsx`), but nothing lets an Administrator or Manager see
  and decide pending appeals.
- **Manager filing a facility appeal** — `MANAGER_FACILITY_APPEAL`. A
  Manager whose facility gets flagged/suspended has no button to file the
  appeal (only their own personal-account appeal is wired up).
- **Administrator-created user accounts** — `ADMINISTRATOR_USER_CREATE`.
  No form for the temp-password admin-create flow; only public sign-up
  exists on the frontend.

Picking all four up now.

## Repo now under git (2026-08-10)

The project had no git repository until today — a VS Code crash mid-session
prompted setting one up so future crashes don't risk losing work. Root
commit captures the state audited above. `.env`/`env/development/*.env.*`
are deliberately tracked (not gitignored) per user's call — dev-only
placeholder secrets, fine to keep in-repo for this project. `.claude/settings.local.json`
is gitignored (machine-local).

## Goal

Two related efforts:
1. Rename `FACILITY_ADMIN` → `MANAGER` (full rename: enum, DB column, all
   code/UI references — not just a display label).
2. Redesign how permissions are defined and checked so they live in one
   dedicated place, instead of being scattered as inline
   `if (role === ROLES.X)` checks across route/service files.
3. Clarify (and adjust) what the Manager role is actually responsible for.

## Already shipped (2026-08-10) — ahead of the full rework below

A separate post-launch role-testing pass found real bugs and gaps and fixed
them directly, without waiting for the rest of this doc's design (rename,
centralized permission function, approval chains, twin-table timeline, etc.)
to land. Everything in this section is live in the codebase today; the rest
of this doc is still **PLANNING**.

- **Administrator lost all individual-record read/write access to Patients
  and Referrals** — not just create/update, read too — going straight to the
  zero-access end state this doc's matrix already calls for, rather than
  keeping a temporary "facility reassignment carve-out" that was floated
  earlier in this same design conversation and then dropped once it was
  clear it'd just be thrown away when the real Patient Transfer workflow
  (Row 1 above) ships. Aggregate dashboard/report counts for Administrator
  are unaffected.
- **Cross-facility patient read access — new rule, not yet in the matrix
  above:** a Nurse/Doctor can now read a patient outside their home facility
  if their facility is the origin or destination of an active
  (non-terminal-status) referral for that patient — needed so the receiving
  side of a referral can actually open the patient record. Same
  non-enumerating-404 pattern as everywhere else in this design (an
  unauthorized caller gets "not found," not "forbidden").
- **A reason is now required on every referral status transition, no
  exceptions by status** — closes a gap where `notes` was optional and most
  transitions shipped with none recorded.
- **One active referral per patient** — creating a new referral for a
  patient that already has a referral in a non-terminal status
  (`pending`/`accepted`/`in_progress`/`on_hold`) is now rejected (409).
  Prevents a patient being in two parallel, possibly-conflicting referral
  workflows at once.
- Hard delete on Patients and Referrals removed entirely
  (`DELETE /patients/:id`, `DELETE /referrals/:id`), matching this doc's
  soft-status-only philosophy already agreed above for every other entity.

None of this required the rename, the centralized permission module, the
approval-chain/status-review flow, or the shared timeline table — those
remain the scope of the rest of this document and haven't started.

## Working style for this doc

User wants active pushback here, not passive transcription: flag risks, edge
cases, and real-world consequences (e.g. a facility-scoping bug that leaks
data across facilities, a role missing an action it'll actually need day to
day) as they come up, with a suggested alternative — don't wait to be asked.

## Decisions confirmed so far

- Rename is a **full rename**, including a new Drizzle migration to alter the
  `user.role` DB enum, not just a UI label swap.
- Permission changes are in scope, not just the rename.
- Permission logic should move to a dedicated, centralized place — informed by
  [RBAC vs ABAC vs ReBAC](https://blog.webdevsimplified.com/2025-11/rbac-vs-abac-vs-rebac/)
  (see notes below).
- **Rename confirmed to proceed.** Full rename, permissions rework in scope.
- **Centralized permission function confirmed.** One dedicated
  function/module is the single source of truth for authorization checks —
  route/service files call into it rather than inlining `role === ROLES.X`.
  Given the approval-chain + flagging model below, this is no longer a nice
  to have; the branching is too complex to leave scattered.
- **Registration/approval chain confirmed:**
  - Administrator: no public self-registration (already agreed). Approves,
    rejects, disables, or flags Managers (each with a reason).
  - A facility a Manager registers during their own sign-up is invisible to
    everyone except that Manager and Administrators until the Manager is
    approved. If rejected (with reason), the facility stays visible only to
    that Manager and Administrators — it does not become generally available.
  - Manager: approves, rejects, disables, or flags Nurses/Doctors at their
    own facility (each with a reason) — mirrors the Administrator→Manager
    relationship one level down. Nurses/Doctors are no longer instant-access
    on self-registration.
  - Administrator invite-flow (email-based) stays parked — no email
    infrastructure being wired right now.
- **User profile page confirmed** — self-service editing, motivated by fixing
  sign-up mistakes (e.g. name typos). `role`, `facility_id`, and `status`
  must stay non-self-editable regardless of who's logged in — see the
  privilege-escalation risk already flagged in `docs/backlog.md`.
- **Permission reductions vs. current code, explicitly requested:**
  Administrators can no longer add/update patients, referrals, Manager
  records, or facilities — down to accept/reject/disable/flag actions on
  Managers, and flag on facilities. This is a real reduction from today's
  code, not just documentation — `createPatient` currently allows
  `ADMINISTRATOR` (`api/src/modules/patients/route.ts`), and `POST
  /facilities` is currently Administrator-only
  (`api/src/modules/facilities/route.ts`); both would need to change.
- **Flagging a facility** blocks that facility from being referenced by new
  referrals/sign-ups, and blocks its staff from adding/updating patients or
  referrals — see open question below on whether terminal status transitions
  (cancel/complete/reject) should still be allowed so nothing gets
  permanently stuck.
- **Manager** cannot add/update patients or referrals, with one carve-out:
  a Manager can assign a doctor to a referral that is still `pending` and
  destined for their facility (narrows today's rule in
  `referrals/service.ts`, which allows doctor-assignment regardless of
  status).
- **Doctor** gets a new capability: redirecting a referral to a different
  facility (doesn't exist in the code today at all).

## Open questions

- ~~What is Manager fundamentally responsible for?~~ **Resolved** by the
  final permission matrix (2026-08-09): moderates staff, doesn't touch
  patients/referrals directly except the pending-referral doctor-assignment
  carve-out — a hybrid of "facility operations lead" and "read-only
  oversight," not the narrow "referral coordinator" framing.
- ~~Should Manager get a facility-scoped dashboard + reports view?~~
  **Resolved** — see the final matrix section below.
- ~~Which authorization model to adopt~~ **Resolved in practice** — the
  final matrix + centralized permission function *is* the answer: a
  deliberate RBAC+relationship+status hybrid, not a textbook single model.
  See notes below for the reasoning.

### First-admin bootstrap — my suggestion (asked for directly)

Keep it entirely off the public API, same as today: extend the existing
`api/script/seed.ts` pattern into a guarded, idempotent bootstrap script —
creates an Administrator only if zero Administrators currently exist in the
DB, run manually by whoever operates the deployment, credentials via env vars
or a generated one-time password printed to the operator (never over HTTP).
This needs no email.

That still leaves a gap: once email-invite is parked (confirmed), how does a
*second* Administrator ever get created? Suggest: let an existing
Administrator create another Administrator (or any role) directly through an
authenticated in-app action — server generates a temporary password shown
once to the creating Administrator (who relays it out-of-band), with a forced
password change on first login. No email needed, and it reuses the profile
page's password-change path once that exists.

### Round 3 answers (2026-08-08)

- **First-admin bootstrap suggestion:** confirmed, liked.
- **Facility gets both a `status` and a `reason` field.** (Reason storage
  mechanism refined further below — see "Action history" instead of a flat
  column.)
- **Pending/rejected accounts (Manager, and by extension Nurse/Doctor once
  their approval chain exists) can still sign in** — they just see their
  status and the reason, not the real app. Not a sign-in block, an
  authorization block: `authenticate` succeeds, but every real resource
  endpoint (and the frontend route tree) must treat non-`ACTIVE` users as
  restricted to "view my own status" only.
- **Facility/Manager onboarding lifecycle, resolved:** two invariants that
  looked like they were in tension turned out not to be, once separated:
  - *Creation-time invariant* ("a facility cannot exist without a manager"):
    a facility only ever comes into being paired with a Manager's own
    registration (new-facility signup, approved together — as already
    decided). There's no path for a bare, manager-less facility to be
    created from scratch, by anyone, including Administrator.
  - *Lifecycle invariant* (facility persists independent of any one
    manager's employment): once created, the facility is a durable entity —
    referrals/patients/history reference `facility_id`, so it must survive a
    specific manager leaving.
  - **Manager self-requested deletion → soft status, not a row delete**
    (confirmed) — preserves the facility and referential integrity (referral
    `doctor`/`created_by`, timeline `changed_by`, etc. all point at user
    rows). This is a *different* status meaning than `DISABLED` (self-exit
    vs. administratively punitive) — needs its own value, e.g. `DEPARTED`,
    not reuse of `DISABLED`.
  - **Re-staffing a manager-less facility needs no new mechanism.** A new
    person self-registering as Manager and choosing "join an existing
    facility" already targets that (already-`APPROVED`) facility and goes to
    Administrator for approval like any Manager application — that
    *is* the reassignment path. No dedicated "reassign facility to new
    manager" admin action needed.
  - **This makes the orphan-facility gap (below) more important, not less** —
    manager turnover is now a confirmed normal event, not a hypothetical, so
    the window where a facility has zero active managers will happen
    regularly, not rarely.
  - Administrator as fallback approver for Nurse/Doctor applicants at a
    facility with zero currently-active managers: **confirmed** (round 4),
    and reused again for patient-transfer approvals.
  - Bulk facility import at launch: given the creation-time invariant above,
    even facility #1 goes through Manager-registers + Administrator-approves
    — no separate bulk-import exception unless you want one. `seed.ts`
    inserting rows directly stays fine for dev/test data since it never goes
    through the public API anyway.
- **Manager CAN update their facility's profile** (name/address) — reverses
  my earlier guess. The only restriction is **no facility deletion** by
  Manager. Worth noting: there's no facility-deletion endpoint in the
  codebase at all today, so this decision is really about a feature that
  doesn't exist yet. Given the soft-status philosophy you just applied to
  Manager self-deletion above, I'd apply the same logic here when/if facility
  deletion is ever built: it should be a status change (e.g. `CLOSED`), not a
  real row delete — same referential-integrity reason (referrals/patients
  reference `facility_id`). Recommend Administrator-only when it exists,
  consistent with Administrator owning `flag`/moderation actions on
  facilities elsewhere in this model.
- **Flagged facility, revisited — you're right, I was wrong to default to
  "always allow wind-down."** Fraud is a real, not hypothetical, reason to
  flag a facility, and letting a fraudulent facility "complete" referrals
  while flagged is exactly the kind of action you don't want to trust from
  them (could be used to falsely claim work was done). Refined
  recommendation, splitting by intent rather than treating "flag" as one
  blunt switch:
  - Block *progress/completion* transitions outright while flagged
    (`accepted`, `in_progress`, `completed`) — these represent the flagged
    facility asserting they're doing or did the work.
  - Still allow *exit* transitions (`canceled`, `rejected`, and a redirect
    to a different, non-flagged facility) — these move a patient's care
    *away* from the flagged facility rather than crediting it, which matters
    for patient continuity (a real regulated-industry pattern: a suspended
    provider can still hand off care, just can't keep operating).
  - If that's still more nuance than you want, the simpler fallback is a
    full freeze, no exceptions — safer default, costs you the "don't stand
    patients up" argument. Your call which one; I'd lean toward the
    exit-only carve-out given patient continuity is the whole point of this
    product.
- **Doctor-initiated referral redirect — concrete rules proposed:**
  - Only allowed to a facility that is `APPROVED` and not currently flagged
    (direct application of the facility-status field).
  - Refuse redirecting to any facility the referral has already passed
    through (track via the redirect's own history entries — see next point)
    — closes the ping-pong/loop risk without needing an arbitrary hop limit.
  - A redirect resets the referral to `pending` at the new destination, so
    that facility's Manager/Doctor triages it fresh — matches how a normal
    new referral is picked up.
  - Referrals already in a terminal status (`completed`, `rejected`,
    `canceled`) can't be redirected — nothing to redirect once it's closed.
- **Timeline action enum — strong yes, and it fills a real existing gap.**
  I checked: today the `timeline` table (`api/src/drizzle/schema/timeline.ts`)
  already has almost exactly what you're describing —
  `previous`/`next`/`changed_by`/`notes`/`changed` — it's just missing the
  `action` label you're proposing, *and* it's hard-wired to `referral_id`
  only. The gap this closes isn't hypothetical: right now, when a Manager
  assigns a doctor to a referral (`updateReferral`), nothing gets written to
  `timeline` at all — that action is currently silent, no audit trail. An
  `action` enum (e.g. `STATUS_CHANGE`, `DOCTOR_ASSIGNED`, `REDIRECTED`) fixes
  that for referrals too, not just the new user/facility use case.
  One technical wrinkle worth deciding: `referral_id` today is a real,
  non-nullable foreign key — clean and enforced at the DB level. Making one
  table cover Users and Facilities as well means either (a) a true
  polymorphic column (`entity_type` + `entity_id`), which MySQL can't
  enforce as a real FK — you lose DB-level referential integrity on that
  column, or (b) a second table with the same shape (`action`,
  `previous`/`next`, `changed_by`, `notes`, `changed`) scoped to
  users/facilities, keeping real FKs at the cost of a duplicated structure.
  I'd lean toward (b) — cheap duplication, keeps the DB actually enforcing
  the relationships — but flagging the tradeoff since it's a real design
  choice, not a formality.

### Round 4 answers (2026-08-08)

- **Correction to round 3:** round 3 said "Facility gets both a `status` and
  a `reason` field" — that's now inconsistent with the timeline/history
  decision made in that same round. Fixing it: Facility (and User) get
  `status` only, no flat `reason` column. The reason for any given status
  change lives in that change's history-log entry (the twin-table approach),
  not duplicated onto the entity row — one source of truth, no risk of the
  row and the log drifting out of sync.
- **User (Manager/Nurse/Doctor) gets the same treatment as Facility:**
  `status` already exists as a column on `UserModel` today — it just needs
  its allowed values expanded (pending / active / rejected / disabled /
  departed, roughly — exact naming is an implementation detail for later).
  Reason comes from the same `user_timeline`-style history table as
  Facility, not a new column.
- **Referral already *is* this pattern — nothing new needed structurally.**
  It already has `status` (`REFERRAL_STATUS`) plus a working history log
  with a reason (`timeline.notes`, written on every `updateReferralStatus`
  call). This is the thing Facility/User are being generalized *toward*, not
  a fourth thing to design. It only needs the `action` enum addition already
  agreed (for doctor-assignment, redirect, and now possibly flagging — next
  point) layered onto the existing table.
- **Flag should not be folded into the main status/lifecycle enum for
  Referral (and Patient, if adopted below) — it should be orthogonal.** For
  User and Facility, "flagged" fits naturally as one more mutually-exclusive
  lifecycle state (an account/facility is in exactly one state at a time).
  For Referral, that doesn't work the same way — flagging a referral for a
  data-quality or clinical concern doesn't stop it from also being
  `in_progress` toward completion; there's no sensible slot for "flagged" in
  `STATUS_TRANSITIONS`'s transition graph. Recommend: for Referral (and
  Patient), a flag is a marker layered on top of whatever status the record
  is already in, tracked purely through history-log entries
  (`action: FLAGGED` / `UNFLAGGED`, with a reason) rather than a status
  value — "currently flagged" is then just "most recent action for this
  record was FLAG with no later UNFLAG," not a field that competes with the
  real lifecycle status.
- **Flagged-facility enforcement — firm recommendation, since asked
  directly:** don't try to make one `flag` action cover both severities.
  - Default `flag` = the exit-only carve-out from round 3 (blocks
    accepted/in_progress/completed, allows cancel/reject/redirect-away) —
    covers the common cases (data quality, minor compliance) without
    stranding patients mid-care.
  - Add a second, distinct action — call it `suspend` — for the fraud-level
    case: a full freeze, no exceptions, including terminal transitions.
  - Both reuse the same history-log mechanism, so this is one more enum
    value and one more permission check, not a parallel system. This is my
    actual recommendation, not a menu — flag if you want something simpler
    instead.
- **Patient flagging — yes, with a real caveat, not a blank yes.** There's a
  legitimate clinical need distinct from anything referral-level: allergy
  discrepancies, safety concerns, duplicate-record data issues, infection
  control — these live with the patient's identity, not a single episode of
  care. But I would *not* give it the same enforcement teeth as a facility
  flag. Blocking care/referrals off a patient flag risks being actively
  harmful if the flag's actual meaning turns out to be something like "data
  quality issue" rather than "do not treat" — the system can't tell the
  difference. Recommend: patient flags are informational/advisory only (a
  visible marker + reason on the patient record), never a functional block,
  at least for a first version. Two things to decide, not assumed:
  - **Visibility** — Doctor-only, or also visible (read-only) to Nurses who
    create referrals for that patient? Sensitive flag reasons (e.g.
    suspected abuse) argue for restricting who sees the *reason* even if the
    flag's existence is visible more broadly.
  - Uses the same generalized history-log pattern as User/Facility — this
    would be a third twin table (`patient_timeline`) alongside
    `user_timeline`/`facility_timeline` if adopted, on top of the referral
    timeline that already exists. Worth knowing that's now 3–4 structurally
    identical tables — a deliberate, acceptable cost for keeping real FKs
    per-entity (per the round-3 tradeoff), not a red flag by itself, just
    flagging the scale of it.
- **Timeline action enum / twin-table approach:** confirmed.

### Round 5 answers (2026-08-08)

- **Patient flag visibility:** Nurses can see it too (not Doctor-only).
  Advisory-only (no functional block) confirmed as OK for now.
- **Two-tier facility enforcement (`flag` exit-only / `suspend` full
  freeze):** confirmed, going with it.
- **Timeline table — reversed my round-4 recommendation, and this one's a
  genuine change of mind, not just going along with it.** You pushed back:
  why not one shared table with an enum marking which entity a row belongs
  to, instead of a separate table per entity? My round-4 case for separate
  tables was preserving a real, DB-enforced foreign key on `entity_id`. But
  that concern only matters if rows can actually disappear out from under a
  reference — and they can't, anywhere in this design: Users, Facilities,
  Referrals, and now Patients all use soft status changes, never hard
  deletes. So the risk a real FK would actually catch here is close to
  nothing, and it was costing four structurally-identical tables, four
  repository classes, and UNION queries any time you want "all history for
  X" across entity types. One shared table wins on simplicity and it scales
  to a fifth entity type later for free (one more enum value, no new
  migration). Recommend:
  - One table: `id`, `type` (enum: `REFERRAL` / `USER` / `FACILITY` /
    `PATIENT` — renamed from `entity_type` per your call), `entity` (no FK —
    it's polymorphic, points at whichever table `type` says; renamed from
    `entity_id`), `action` (enum, shared across all entity types — e.g.
    `STATUS_CHANGE`, `DOCTOR_ASSIGNED`, `REDIRECTED`, `APPROVED`,
    `REJECTED`, `DISABLED`, `FLAGGED`, `UNFLAGGED`, `SUSPENDED`, `DEPARTED`),
    `previous`, `next`, `changed_by` (this one **keeps** a real FK to `User`
    — it always points at exactly one type, a person, so there's no
    polymorphism problem there), `notes` (the reason), `changed`.
  - Not every `action` value is valid for every `type` (e.g.
    `DOCTOR_ASSIGNED` only makes sense for `REFERRAL`) — that's enforced in
    application code, same as it would be with separate tables anyway.
  - This replaces today's referral-only `timeline` table too, once existing
    rows are migrated over with `type: REFERRAL`.

### Round 6 answers (2026-08-08)

- **Timeline column naming:** `type` and `entity` (not `entity_type` /
  `entity_id`) — updated above.
- **Emergency override: yes.** Administrator can disable a Nurse/Doctor
  directly, not exclusively the Manager's call. (Still just disable — the
  full accept/reject/flag/suspend set for Nurses/Doctors stays the Manager's
  job day to day; this is specifically the "Manager isn't around" escape
  hatch.)
- **Profile page: name only for now.** Email and password stay out of scope
  — not self-editable through this page yet.

### Still open

Nothing outstanding right now — both plain-language questions from round 5
are answered above. Next step is the line-by-line pass over the permission
matrix below, whenever you're ready.

### Final permission matrix — **CONFIRMED 2026-08-09**

Everything below is settled, via the row-by-row walkthrough. See "Matrix
walkthrough" further down for the detailed reasoning behind each cell.

| Resource | Administrator | Manager | Doctor | Nurse |
|---|---|---|---|---|
| Patients | read only, no add/update, no hard delete | read only, own facility | update `history` only; flag a patient with reason (advisory-only, Nurse-visible) | create, read/update; no direct `facility_id` edit (see transfer workflow) |
| Referrals | read only, no add/update, no hard delete | read only, own facility, **except**: assign doctor on a `PENDING` referral sent to their facility | accept/reject; redirect to another `APPROVED`, non-flagged/suspended facility | create; status moves (cancel/hold/pending), unchanged |
| Facilities | cannot create/update; `FLAG` (exit-only) or `SUSPEND` (full freeze), with reason; no hard delete, ever | update own facility's profile (name/address); cannot delete | read-only, `APPROVED` + not flagged/suspended (redirect destination picking) | read-only, `APPROVED` + not flagged/suspended (transfer destination picking) |
| Managers (accounts) | accept / reject / `DISABLE` (full freeze) / `FLAG` (restricted functionality), with reason | — | — | — |
| Nurses/Doctors (accounts) | `DISABLE` directly, emergency override only | accept / reject / disable / flag, with reason, own facility | — | — |
| Own profile | edit own name only; never own role/facility_id/status | same | same | same |

**Patient facility transfers** are a separate two-sided workflow, not a
direct edit by anyone: Nurse/Doctor requests (with reason) → origin
facility's Manager approves/rejects (with reason) → destination facility's
Manager accepts/rejects (with reason). Administrator falls back as approver
on either side if that facility currently has no active Manager. Referrals
don't auto-follow a transferred patient — a Doctor can manually redirect
one if they want it to.

**Appeals:** any account that's `REJECTED`/`FLAGGED`/`DISABLED`, and any
facility that's `REJECTED`/`FLAGGED`/`SUSPENDED`, can sign in restricted to
filing an appeal with a reason (Manager files on a facility's behalf).
Reviewed by whoever imposed the status, who comments when deciding.

**Dashboard + Reports — CONFIRMED 2026-08-09**, closing the one gap the row
walkthrough missed (it only covered the six resource rows above; Dashboard
and Reports were never their own row):
- **Dashboard** — new `GET /dashboard/manager/summary`, facility-scoped
  version of `admin/summary`'s shape (total staff/patients/referrals at
  their facility, referral status breakdown), same scoping pattern as
  `nurse/summary`/`doctor/summary` already use. Plus a pending-actions
  count — outstanding Nurse/Doctor applications and pending patient-transfer
  requests awaiting their decision (either side) — which also closes an
  older gap: nothing currently surfaces a queue anywhere for the approval
  chains this whole redesign has built. This is that surface.
- **Reports** — Manager added to `GET /reports/referrals`'s existing
  authorize list, scoped with the same `origin_facility_id`/
  `destination_facility_id` OR-condition already used for
  `listReferrals` — same endpoint and response shape as Nurse/Doctor get,
  just facility-wide instead of individually-scoped.
- Explicitly not in scope here (a product/UI decision, not a permissions
  one): per-doctor workload breakdowns or anything beyond what
  Administrator's dashboard already shows, just scoped down.

## Matrix walkthrough (row by row, 2026-08-08)

Going through the proposed matrix above one row at a time to actually confirm
it rather than approve it as one block. Each row gets its own subsection;
mark **CONFIRMED** when fully settled.

### Row 1 — Patients — **CONFIRMED**

- **No hard delete for patients, at all, any role.** Same reasoning as
  everywhere else in this design — referrals reference `patient_id`, so a
  hard delete risks orphaning referral history. Supersedes today's
  `DELETE /patients/:id` (currently Administrator-only in the code).
- **Facility transfer becomes a two-sided request/approval workflow, not a
  direct field edit — new design, replaces today's rules entirely:**
  - A Nurse or Doctor at the patient's *current* facility can request a
    transfer to a named destination facility, with a reason.
  - The **origin** facility's Manager decides whether to approve the
    request leaving, with a reason.
  - If approved, the **destination** facility's Manager decides whether to
    accept the patient, with a reason.
  - Only once both sides approve does the patient's `facility_id` actually
    change. A rejection at either step ends it — reason recorded, patient
    stays at the origin facility.
  - This fully replaces today's inconsistent rule set (Nurse blocked from
    touching `facility_id`, Administrator allowed to set it directly on
    create/update) — under the new model, *nobody* edits a patient's
    facility directly anymore, Administrator included; it's always this
    workflow. That's a real simplification, not just a restriction.
  - Fits the existing `type`/`entity` timeline table directly — a `PATIENT`
    entity with actions like `TRANSFER_REQUESTED`,
    `TRANSFER_APPROVED_ORIGIN`, `TRANSFER_APPROVED_DESTINATION`,
    `TRANSFER_REJECTED`, each carrying its own reason.
  - **Two things worth deciding explicitly, not by default:**
    1. Destination facility should presumably need to be `APPROVED` and not
       currently `flagged`/`suspended` — same rule as the doctor-initiated
       referral redirect. Confirm.
    2. Orphan-facility fallback: if the origin or destination facility
       currently has no active Manager, does Administrator approve that
       side instead — consistent with the same fallback already agreed for
       Nurse/Doctor account approvals?
  - **Not changing, to avoid scope creep:** an in-flight referral doesn't
    get retroactively touched when its patient later transfers facilities —
    referrals keep whatever facility ids they were created/redirected with.
    Flagging this as a deliberate choice, not an oversight, so it doesn't
    quietly become a bug report later.
- **Clinical notes scope — what I meant, concretely:** I checked the actual
  code. Today a Doctor's update rights on a patient are restricted to
  exactly one field, `history` (`api/src/modules/patients/service.ts`) —
  not phone, not address, not gender, nothing else. My question was whether
  that stays exactly that narrow, or widens to also include contact/
  demographic detail (phone/address/gender) while still excluding hard
  identity fields (name, date of birth). **Confirmed: `history` only, not
  widened.**
- **Transfer destination must be `APPROVED` and not `flagged`/`suspended`:
  confirmed.**
- **Orphan-facility fallback (Administrator approves if no active Manager)
  for patient transfers: confirmed** — consistent with the same fallback
  already agreed for Nurse/Doctor account approvals.
- **In-flight referral vs. patient transfer — resolved:** referral stays
  exactly as-is when its patient transfers facilities (no automatic
  change) — matches the "not changing" recommendation above. The
  connection between the two features is a manual one: since a Doctor
  already has the referral-redirect capability (Row 2, agreed earlier),
  they can choose to redirect an open referral to the patient's new
  facility if they want the referral to follow. No new mechanism needed —
  this is exactly what redirect was already designed for, just confirming
  it composes with patient transfer rather than needing its own path.

### Row 2 — Referrals — **CONFIRMED**

| Administrator | Manager | Doctor | Nurse |
|---|---|---|---|
| read only, no add/update | read only, own facility, **except**: assign doctor on a `pending` referral sent to their facility | accept/reject; redirect to another facility | create; existing limited status moves (cancel/hold/pending), unchanged |

- Hard delete dropped, consistent with Patients — no role hard-deletes a
  referral, soft-status only.
- Nurse's existing status moves (cancel/hold/pending, today's
  `NURSE_STATUS_TARGETS`) kept as-is.

### Row 3 — Facilities — **CONFIRMED**

| Administrator | Manager | Doctor | Nurse |
|---|---|---|---|
| cannot create/update; `FLAG` (exit-only) or `SUSPEND` (full freeze), with reason; no hard delete, ever | update own facility's profile (name/address); cannot delete | read-only, `APPROVED` + not flagged/suspended (for redirect destination picking) | read-only, `APPROVED` + not flagged/suspended (for transfer destination picking) |

**Addendum — appeal mechanism, resolved:** appeal is available to
**everyone** whose account is `REJECTED`, `FLAGGED`, or `DISABLED`, and to
facilities that are `REJECTED`, `FLAGGED`, or `SUSPENDED` — sign-in still
works in all of these, restricted to filing the appeal (with a reason).
For a facility specifically, only the **Manager** files the appeal, not
other staff there. Whoever holds decision authority over that entity can
comment when they decide the appeal (approve or deny) — same "with reason"
convention as every other action here. Working assumption on routing,
stated so it can be corrected rather than silently assumed: an appeal goes
to whoever actually imposed the status — normally that's Administrator for
Manager accounts/facilities and Manager for Nurse/Doctor accounts, but if
Administrator used the Row 5 emergency override to disable a Nurse/Doctor
directly, that appeal would go to Administrator, not the Manager, since
Administrator is the one who'd need to reverse it. Two more `action`
values for the shared history table: `APPEAL_SUBMITTED` and
`APPEAL_APPROVED`/`APPEAL_DENIED`.
Note: `SUSPEND` stays Facility-only — accounts don't get a third severity
beyond `FLAG`/`DISABLE`, the four status words listed together just cover
the union of both entity types' vocabularies, not that every entity has all
four. Flag if that's not what you meant.

### Row 4 — Managers (accounts) — **CONFIRMED**

| Administrator | Manager | Doctor | Nurse |
|---|---|---|---|
| accept / reject / disable / flag, with reason | — | — | — |

- **`DISABLE` = full freeze**, confirmed — matches today's `DISABLED`
  semantics, no platform access at all.
- **`FLAG` = restricts specific functionality, not a full freeze** — user's
  call, assistant to propose which functionality for now. Proposal: while
  `FLAG`ged, a Manager keeps read access and keeps assigning a doctor to a
  `PENDING` referral in their facility (so patient routing doesn't stall
  during a review — same "protect patient continuity" reasoning already
  used for the Facility exit-only carve-out), but **loses**: approving/
  rejecting/disabling/flagging their facility's Nurse/Doctor accounts, and
  updating their facility's profile. Revisit if it turns out too
  restrictive or not restrictive enough once it's actually used.
- No hard delete of a Manager account, ever.
- Reassigning an already-active Manager to a different facility: out of
  scope unless a real need comes up.

**Naming convention, applies everywhere, confirmed:** all enum values are
`UPPERCASE` — `FLAG`, `DISABLE`, `SUSPEND`, `APPROVE`/`APPROVED`,
`REJECT`/`REJECTED`, `PENDING`, `ACTIVE`, etc. This explicitly includes
**normalizing today's `REFERRAL_STATUS`** — currently lowercase in the real
code (`"pending"`, `"accepted"`, `"in_progress"`, `"on_hold"`,
`"completed"`, `"rejected"`, `"canceled"`) — up to uppercase, confirmed, not
left as an exception. Worth remembering when this actually gets built: this
is a real data migration, not just a naming choice — existing rows in the
`referral.status` column, `STATUS_TRANSITIONS`/`NURSE_STATUS_TARGETS`/
`DOCTOR_STATUS_TARGETS` in `shared/src/constant.ts`, and every string
comparison against them across `referrals/service.ts` and the frontend all
need updating together, atomically, not incrementally.

### Row 5 — Nurses/Doctors (accounts) — **CONFIRMED**

| Administrator | Manager | Doctor | Nurse |
|---|---|---|---|
| `DISABLE` directly, emergency override only | accept / reject / disable / flag, with reason, own facility | — | — |

`FLAG` semantics agreed, symmetric with Managers — no new intake while
under review, don't cut off patients already in progress:
- **`FLAG`ged Doctor** keeps updating clinical notes (`history`) and
  progressing/completing referrals already assigned to them; loses
  accepting new referrals and redirecting.
- **`FLAG`ged Nurse** keeps updating existing patients and managing status
  on referrals they already created; loses creating new referrals.
- Appeal mechanism (see Row 4 addendum above) applies here identically —
  `REJECTED`/`FLAGGED`/`DISABLED` Nurse/Doctor accounts can sign in to
  appeal, reviewed by whoever imposed the status (normally the Manager,
  Administrator if it was the emergency override).

### Row 6 — Own profile — **CONFIRMED (from round 6)**

| Administrator | Manager | Doctor | Nurse |
|---|---|---|---|
| edit own name only | same | same | same |

Already settled in round 6 — name-only, no email/password self-service yet,
and never `role`/`facility_id`/`status` regardless of who's logged in. Restating
it here for the record as this row is walked through, not reopening it.

From the referenced article:
- **RBAC** — permissions attached to a role (admin/editor/viewer). Simple, but
  weak when access depends on more than job title.
- **ABAC** — permissions evaluated from attributes of subject, resource, and
  environment. Modular, policy-per-attribute.
- **ReBAC** — permissions from relationships between entities (ownership, team
  membership). Good fit for hierarchical/inherited permissions.
- Article's guidance: start with RBAC, move to ABAC when attributes matter,
  move to ReBAC when relationships/hierarchy matter. Pick the simplest model
  that fits; don't over-engineer upfront.

**How this maps to what's already in the codebase:** the current system is
RBAC (role → allowed routes via `app.authorize([...])`) layered with a
relationship check bolted on per-service (`resource.facility_id ===
user.facility_id`, `referral.created_by === user.id`, etc.) — i.e. it's
already an ad hoc RBAC+ReBAC hybrid, just not centralized. The centralization
question is really: formalize this hybrid into one policy module, vs. pick a
single model and refactor toward it.

## Current-state audit (as of 2026-08-08, pre-rename)

Permissions for `FACILITY_ADMIN` (soon-to-be Manager), gathered directly from
route/service code:

| Resource | Access |
|---|---|
| Patients | list/get — scoped to own facility (same scoping as Nurse/Doctor); **cannot create or update** |
| Referrals | list — scoped to own facility (origin or destination); **`GET /:id` blocked entirely** (route's `authorize([...])` omits this role — looks like a bug, not a decision); update — only referrals *sent to* their facility, and only the `doctor` field (i.e., assigning a doctor); **cannot create, delete, or change status** |
| Facilities | get/update — own facility only; cannot create |
| Users | list/disable — scoped to own facility |
| Dashboard | no access (only Nurse/Doctor/Administrator have views) |
| Reports | no access |
| Audit | no access |

Relevant files (pre-rename names):
- `shared/src/constant.ts` — `ROLES.FACILITY_ADMIN`
- `api/src/middleware/authorize.ts` — role-gate middleware used per-route
- `api/src/modules/{patients,referrals,facilities,users}/{route,service}.ts` — inline role/facility checks
- `api/src/drizzle/migrations/0001_narrow_ikaris.sql` — DB enum definition
- `web/src/routes/_authenticated/**`, `web/src/components/custom/side-bar.tsx` — frontend role checks/labels
- `api/script/seed.ts` — seed data using the role

## Open thread: registration & role assignment (not decided)

User's proposal: no public self-registration as Administrator, ever —
Administrators are invited. Manager (renamed FACILITY_ADMIN) can self-register
but the account requires review/acceptance by an Administrator before full
platform access. Doctor and Nurse self-register with immediate access, no
review. Asked for a brutal, real-world-grounded reaction; captured below,
nothing decided or implemented yet.

**Confirmed live gap, independent of the rest of this design:** `SignUpSchema`
(`shared/src/schema/authentication.ts`) and `signUp`
(`api/src/modules/authentication/service.ts`) accept any `role` value,
including `ADMINISTRATOR`, from the public sign-up form with no restriction
at all. Anyone can self-register as Administrator today. Needs closing
regardless of how the rest of this is resolved.

**Pushback raised:** excluding Doctor/Nurse from any gate means instant,
unreviewed, facility-scoped access to real patient/referral data for anyone
who can see the (unauthenticated — confirmed in `facilities/service.ts`'s
`listFacilities` comment) facility list and pick one. That's arguably higher
stakes than the Administrator gap, since it's PHI exposure, not just app
access. Not proposing this must be reviewed too — but it should be a
deliberate decision (maybe an invite-code-per-facility or email-domain check
is enough), not a default of zero friction.

**Gaps this design needs that don't exist in the codebase yet:**
- A real "pending" user status — today `USER_STATUS` is only
  `ACTIVE`/`DISABLED`; don't overload `DISABLED` for "awaiting review," it
  already means something else (deliberately shut off by an admin).
- An invite mechanism (token/expiry/invite table + admin-facing UI) — none
  exists.
- An approve/reject action + a visible queue for pending signups —
  `users/route.ts` currently only supports list and disable.
- A decision on the facility-creation loophole: self-registering Managers can
  currently create a brand-new facility on the spot
  (`new_facility_name` in `authentication/service.ts`), while `POST
  /facilities` is Administrator-only everywhere else in the app. Does the
  facility stay "unofficial" until the Manager is approved, or does
  self-registration drop new-facility creation entirely (Managers only join
  an existing, already-approved facility)?
- Confirm the bootstrap story: with Administrator invite-only, the very first
  Administrator has to come from somewhere. Today `api/script/seed.ts`
  bypasses the public route entirely (calls `auth.api.signUpEmail` directly)
  — reasonable, just needs to stay the intended path once the public route is
  locked down.

**Interaction with parked items:** `employee_id` (docs/backlog.md) was scoped
to generate "during registration," before a pending/review state was on the
table — needs an explicit decision on whether it's assigned at signup
regardless of outcome, or only on approval.

## Session log

- **2026-08-08**: Lost prior session (no memory had been saved yet). Re-derived
  context by reading the codebase. User re-stated the ask: rename
  FACILITY_ADMIN → Manager (full rename incl. DB), adjust what Manager can do,
  and clarify role responsibilities. Did current-state audit (above). User
  then added: centralize permission logic in one dedicated place, referencing
  the RBAC/ABAC/ReBAC article. Set up this doc + memory so future sessions
  don't lose context again. Two questions about Manager's responsibility scope
  and dashboard/reports access were asked but not yet answered. User also
  recalled and re-shared earlier discussion points from the lost session
  (facilities searchable-select hybrid decision and several parked ideas —
  now in `docs/backlog.md`), and raised registration/role-assignment design
  (Administrator invite-only, Manager reviewed, Doctor/Nurse open) — captured
  above as an open thread pending decisions.
- **2026-08-08 (round 2):** user responded to all open points: confirmed
  rename + centralized permission function; confirmed Nurse/Doctor now also
  go through approval (by their Manager, mirroring Admin→Manager); confirmed
  Manager-registered facilities stay hidden until the Manager is approved
  (and stay restricted-visibility if rejected); admin-invite stays parked
  (no email infra yet); confirmed the user profile page; and laid out a much
  more detailed permission matrix (Administrator/Manager lose direct
  patient/referral/facility writes, gain accept/reject/disable/flag actions;
  Doctor gains referral redirect). Captured as decisions + a proposed
  consolidated matrix above, with several ambiguous lines and new schema
  needs (facility status, bootstrap path, reason-vs-history) flagged rather
  than guessed at.
- **2026-08-08 (round 3):** user answered most round-2 open questions.
  Confirmed: facility gets `status` + `reason`; pending/rejected accounts can
  still sign in to see their status/reason (not full access); Manager
  self-deletion is a soft status, not a row delete, to preserve the facility;
  re-staffing a manager-less facility needs no special mechanism (normal
  Manager-joins-existing-facility signup + Administrator approval already
  covers it); Manager keeps facility-profile edit rights, just not deletion.
  User pushed back on the "always allow wind-down" flagged-facility
  suggestion using a fraud scenario — assistant conceded the blanket version
  was wrong and proposed a refined exit-transitions-only middle ground
  instead (still needs a final pick). User proposed generalizing the
  `timeline` table with an `action` enum — assistant confirmed this also
  fixes an existing gap (doctor-assignment on a referral isn't currently
  logged at all) and flagged a real schema tradeoff (polymorphic column vs.
  a twin table) rather than just agreeing. Remaining open items trimmed down
  to a short list — see "Still open after round 3" above.
- **2026-08-08 (round 4):** confirmed orphan-facility fallback and the
  twin-table timeline approach; confirmed "accept/reject" ambiguity meant
  referrals, not patients. User asked whether User and Referral also need
  status+reason — assistant caught and corrected an inconsistency from round
  3 (a flat `reason` column on Facility contradicted the just-agreed
  history-log approach; fixed to status-only + history). Clarified Referral
  already *is* the reference pattern (existing `timeline.notes`), nothing
  new needed structurally. Proposed flag-as-orthogonal-marker (vs. a status
  value) for Referral/Patient specifically, unlike User/Facility. Asked
  directly for a final call on flagged-facility enforcement — assistant
  committed to a firm recommendation (two-tier: `flag` exit-only, `suspend`
  full freeze) instead of leaving it open. User asked whether patient
  flagging should exist — assistant said yes but scoped it to
  advisory-only, not a functional block, and raised a visibility-scope
  question not yet answered. See "Still open after round 4" above for what's
  left.
- **2026-08-08 (round 5):** confirmed patient flags are Nurse-visible too and
  advisory-only; confirmed the two-tier `flag`/`suspend` facility
  enforcement. User pushed back on the twin-table timeline recommendation
  (why not one table with an entity-type enum?) — assistant reconsidered
  genuinely rather than defending the earlier take, and reversed it: since
  nothing in this design is ever hard-deleted, the FK-integrity argument for
  separate tables doesn't hold up, so a single shared history table (with a
  polymorphic `entity_type`/`entity_id`, but a real FK kept on `changed_by`)
  is now the recommendation. User also said the "still open" list wasn't
  clear — rewritten in plain language as two yes/no questions.
- **2026-08-08 (round 6):** timeline columns renamed to `type`/`entity` per
  user's request (not `entity_type`/`entity_id`). Both plain-language
  questions answered: Administrator does get an emergency-override disable
  on Nurse/Doctor accounts (not Manager-exclusive); profile page is
  name-only for now, email/password out of scope. Matrix updated to match.
  No open questions remain — next step is the line-by-line matrix pass.
- **2026-08-09 (matrix walkthrough):** started the row-by-row pass. Patients
  confirmed (no hard delete; facility moves become a two-sided
  request/origin-approve/destination-approve workflow, replacing today's
  direct-edit rules entirely; Doctor stays `history`-only, not widened;
  in-flight referrals don't auto-follow a transferred patient — Doctor can
  manually redirect via the existing redirect capability instead). Also
  extended the parked facility-specialties idea (`docs/backlog.md`) to
  cover Nurses, not just Doctors/Facilities. Referrals confirmed (hard
  delete dropped; Nurse's existing status moves kept as-is). Facilities
  confirmed (caught and fixed a real gap — Doctor/Nurse were marked "none"
  despite needing facility read access for redirect/transfer destination
  picking). Managers (accounts) confirmed — `DISABLE` is full freeze,
  `FLAG` restricts specific functionality (assistant proposed which, user
  delegated the call); user then added mid-turn that `SUSPEND`ed facilities
  still allow sign-in restricted to filing an appeal with a reason (two
  follow-up questions raised, not yet answered), and confirmed **all**
  enums go uppercase, explicitly including normalizing today's lowercase
  `REFERRAL_STATUS` values (a real migration, not just style). Moving into
  Row 5 (Nurses/Doctors accounts) next.
- **2026-08-10:** a separate, code-first pass (live role-testing across all
  four roles, 40 findings) shipped several fixes directly ahead of the
  matrix walkthrough above finishing — see "Already shipped" near the top.
  Notably, it reversed the in-progress "Administrator facility reassignment
  carve-out" idea from round 2 in favor of jumping straight to this doc's
  already-agreed zero-access end state, since the carve-out would've been
  throwaway work once Patient Transfer (Row 1) ships. The rename, centralized
  permission module, approval chains, and shared timeline table are all
  still unstarted — this pass only fixed live bugs and gaps found by
  testing, it didn't advance the rest of the design.
- **2026-08-10 (post-crash session):** VS Code crashed mid-session; the prior
  session's record of implementation progress was lost with it (this doc's
  "still unstarted" line above was stale the moment the next pass began —
  it just never got corrected before the crash). Re-derived state by
  auditing the actual code rather than trusting the doc: the rename,
  centralized permission module (`api/src/lib/permission.ts`), and the full
  approval-chain/appeals routes (`administrator`/`manager` modules) turned
  out to already be built — see "Current implementation status" above for
  specifics and what's still unverified/outstanding (notably
  `REFERRAL_STATUS` still lowercase). Also found the Manager dashboard's
  frontend (`web/src/routes/_authenticated/index.tsx`) mid-edit — likely
  where the crash actually landed — with a real TS type error
  (`RecentActivityCard` using raw `TanstackLink` instead of the app's
  `custom/link.tsx` wrapper, which doesn't type-check against a
  heterogeneous list of `{to, params}` targets the way the custom `Link`
  does). Fixed by routing through the custom `Link`, matching the
  already-existing `ActionBar` component one screen up in the same file.
  Separately, user flagged that several parameterized routes
  (`/patients/$patientId`, `/referrals/$referralId`, `/users/$userId`,
  `/facilities/$facilityId`, `/patients/new`, `/referrals/new`) were
  hardcoded as literals at call sites across the frontend instead of living
  in `FRONTEND_URLS` — pointed at their other project (`ubuntu-stories`,
  `~/Desktop/ubuntu-stories`) which already does this
  (`FRONTEND_URLS.STORY` + `params`). Added `PATIENT`/`REFERRAL`/`USER`/
  `FACILITY`/`NEW_PATIENT`/`NEW_REFERRAL` to `FRONTEND_URLS` and updated
  every call site (`side-bar.tsx`, `patients/index.tsx`, `referrals/index.tsx`,
  `referrals/$referralId.tsx`, `users/index.tsx`, `facilities/index.tsx`,
  the dashboard file) to use them — this repo's own convention was
  genuinely inconsistent (flat routes centralized, parameterized ones
  weren't), not a case of the user misremembering. `git init` done this
  session too (see "Repo now under git" above) specifically so a future
  crash doesn't repeat this lost-context problem — check `git log`/`git
  status` after any crash before re-deriving state from scratch again.
- **2026-08-10 (continued):** user asked to continue the rework; built
  patient flagging end-to-end (backend + frontend, task tracked and
  completed) and executed the `REFERRAL_STATUS` uppercase migration in
  full (research fork first, to inventory every call site atomically, then
  DB reset/regenerate/reseed + frontend fixes) — see "Current implementation
  status" above for specifics on both. Mid-session, user corrected two more
  conventions while reviewing the new patient-flag code: (1) don't reach
  for a raw library component when the app has a `components/custom/`
  wrapper for it — real payoff beyond consistency, since the custom `Link`
  type-checks a heterogeneous `{to, params}` list that the raw
  `TanstackLink` doesn't; (2) route paths (`API_PATHS` backend, seen above)
  must be centralized the same way on *every* route, not just newly-written
  ones — backfilled across all existing modules, both API (`route.ts`
  `url:` values) and frontend (`web/src/api/*.ts`, via `buildUrlWithParams`
  — existed in `shared/src/util.ts`, unused until now). Also set up a
  project-level `.claude/settings.json` permission allowlist (typecheck
  commands, `docker compose ps`) after user flagged prompt fatigue —
  unrelated to this doc's subject but recorded here since it happened
  mid-session. Separately caught and fixed a real inconsistency: `recharts`
  in `web/package.json` had a `^` version range while every other
  dependency is pinned exact (`.npmrc` already has `save-exact=true` — this
  one must have been hand-edited or installed with an explicit range
  before that was set) — pinned to `3.10.1` to match. Then built the
  doctor-initiated referral redirect (backend + frontend, verified live —
  see "Current implementation status" above). Verified the non-`ACTIVE`-user
  frontend restriction was already correctly built (`/account-status`,
  outside the authenticated layout). Built the two-sided patient
  facility-transfer workflow (request + origin-decide + destination-decide,
  both Manager and Administrator-orphan-fallback variants, new `/transfers`
  page) — the last of the four originally-tracked implementation gaps — and
  verified the reachable parts live against the API (see "Current
  implementation status" above for what wasn't exercisable with the seeded
  credentials available: a second real Manager account for destination-
  approval, and an orphaned facility for the Administrator fallback).
  With all four original gaps closed, what's left of this doc's scope is:
  the Manager dashboard's pending-actions count (real, standalone gap, not
  blocking anything), and the API_PATHS/FRONTEND_URLS backfill-everywhere
  question raised earlier in this session but not acted on beyond what
  already needed touching.
- **2026-08-11:** user supplied credentials for a second Manager account
  (`Nolan Kgotso`) specifically to close the one remaining live-verification
  gap from the day before — see "Current implementation status" above for
  what that confirmed. Note for future sessions: this account was created
  through the real public sign-up + Administrator-approve flow, not
  `seed.ts` — it will *not* survive a `reset`/reseed cycle like the
  standard `{role}@gmail.com` logins do, and would need recreating
  (register as Manager joining Denesikmouth Memorial Hospital or any other
  facility, then Administrator-approve) if this specific test needs
  repeating after a schema change forces another reset.
- **2026-08-11 (continued):** separate from this doc's feature scope, user
  caught an architecture violation while reviewing the dashboard code: three
  `modules/*/service.ts` files (`dashboard`, `reports`, `users`) were
  building raw Drizzle queries directly against `*Model` table objects
  instead of going through the `core/*.ts` repository layer, which is
  supposed to be the only place that knows about Drizzle. Fixed by adding
  one generic `count(where?, groupBy?)` method to `core/helpers.ts` and to
  every repository class (`User`, `Patient`, `Facility`, `Referral`),
  replacing raw `connection.select(...).from(Model)...groupBy(...)` calls
  in all three service files. Along the way, user rejected a first attempt
  that added per-column named methods (`countByStatus`/`countByPriority`)
  — "it has to be consistent and be named count as well, because I could
  count by anything" — so those were consolidated into the single generic
  method instead, typed with a conditional `CountResult<TGroupBy>` return
  (flat number with no `groupBy`, `Record<string, number>` with one). Also
  corrected `zeroFillCounts` (`api/src/lib/util.ts`) to accept the enum
  object itself and compute `Object.values()` internally, rather than
  making every call site pre-compute and pass the keys array. Verified via
  typecheck, lint, and live curl requests against the running API
  (dashboard summaries, reports, doctor stats) — all matched pre-refactor
  output. Committed as `7d874f1`. Purely a code-quality/architecture fix,
  not a new feature — doesn't change anything in "Current implementation
  status" above, which is why it's recorded only here.
- **2026-08-12:** user asked to pick up the two remaining named gaps —
  see "Both remaining gaps closed, 2026-08-12" above for what shipped
  (staff/manager moderation UI on `/users`, and the route-constants
  backfill sweep). Also fixed a real, previously-unnoticed bug found
  while building the moderation UI: `router.invalidate()` wasn't actually
  refreshing `useLoaderData()`-backed pages after an in-place mutation on
  this router version, which the `transfers` page had been silently
  affected by since it was built. Both commits (`c850126`, `43cf238`) are
  typechecked, linted, and verified live in a real browser session
  (manager@gmail.com and administrator@gmail.com), not just against curl.
- **2026-08-12 (continued):** appeals review queue built (backend `AppealManager`
  + `/appeals` page), which surfaced a real scalability problem — the append-only
  `timeline` table never marks an `APPEAL_SUBMITTED` row as decided, so a naive
  list query kept returning already-decided appeals. User rejected an app-level
  fetch-then-filter fix and asked for a genuine DB-level answer instead: added
  `WhereClause.NOT_SUPERSEDED_BY` / `buildSupersededCondition` (a generic
  correlated `NOT EXISTS` self-join, via Drizzle's `alias()`) to `core/helpers.ts`,
  consumed through `Timeline.many({ supersededBy: [...] })` — no appeal-specific
  logic in the `core` layer. While reviewing this, user caught a broader
  layering violation: DB-touching code had crept into `lib/moderation.ts`,
  `lib/transfer.ts`, `lib/session.ts` (a brand-new `lib/` rule: only
  `database.ts`/`auth.ts` may touch the DB, everything else in `lib/` must be a
  pure predicate). Fixed by introducing a new `api/src/management/` layer
  (`ModerationManager`, `AppealManager`, `TransferManager`, `SessionManager`) —
  cross-repo business workflows that compose `core.*` calls only, registered as
  a Fastify plugin (`request.server.management`) right after `core`. Also
  tightened `core/*.ts` itself: raw `drizzle-orm` operator imports (`sql`,
  `and`, `eq`, `alias`, etc.) are only allowed in `core/helpers.ts` — individual
  table files call generic helpers exclusively.
- **2026-08-12 (continued further):** three more corrections/cleanups in the
  same session, all API-only: (1) `Facility.isOrphaned`/`Referral.hasActiveFor`
  were removed entirely — user pointed out they were redundant wrappers around
  the repository's own `count()` method; every call site (`administrator/service.ts`
  ×3, `patients/service.ts`, `patients/transfer-service.ts` ×2) now calls
  `core.user.count(...)`/`core.referral.count(...)` directly. Established (and
  applied across every `core/*.ts` repo) a fixed method order —
  `count → many → one → create → update → delete` — count first, since it's
  the cheapest/most foundational query. (2) Moved `patients/transfer-service.ts`
  + `transfer-type.ts` into their own `modules/transfers/{service,type}.ts` —
  it was imported by three different modules' `route.ts` (patients, manager,
  administrator), not just patients; route registrations themselves didn't move.
  (3) Deduped `core/user-specialty.ts`/`core/facility-specialty.ts`. First
  pass extracted a generic `createLinkTableRepository(table, relationConfigs,
  countConfigs)` factory (`core/link-table.ts`); pushback that the name
  overclaimed genericity — a repo-wide check confirmed `user_specialties`/
  `facility_specialties` are the *only* two link tables in the schema, so
  "any join table" isn't a real pattern yet. Landed instead on folding both
  link tables directly into `core/specialty.ts` itself: `UserSpecialty` and
  `FacilitySpecialty` are gone as standalone `core/*.ts` classes (and off
  `CoreService`/`TransactableCore`), replaced by `owner`-parameterized
  `linkMany`/`linkCreate`/`linkDelete` methods (`owner: "user" | "facility"`)
  on `Specialty`, since `specialties` is the reference table both link tables
  exist only to attach to. Verified via `tsc --noEmit`/`eslint` on the full
  `api` package — clean except the one pre-existing, unrelated `relations.ts`
  lint error noted earlier in this log.
  *(Correction, same day: an earlier version of this entry claimed the
  abstraction was fully reverted back to two independent hand-written
  classes. That was written before a VS Code crash interrupted the session;
  the revert never actually landed on disk. What's above reflects the code
  as it actually exists.)*
- **2026-08-12 (new session):** started on the last two named-but-unbuilt
  gaps from the 2026-08-12 sweep above: Manager filing a facility appeal,
  and Administrator-created user accounts. Prior session's cleanup batch
  (count-first reordering, dead-wrapper removal, transfer module move,
  link-table dedup) was verified clean (`tsc`/`eslint`, matching what this
  doc already claimed) and committed as `8a14076` at the start of this
  session — nothing was pending from before.
  - **Manager facility-appeal — done, live-verified.**
    `POST /manager/facility/appeal` already existed server-side
    (`facilityAppealSubmit`, gated by `canFileFacilityAppeal`); no frontend
    called it. Added `fileFacilityAppeal` to `web/src/api/facilities.ts`
    and a `FacilityAppealForm` on `facilities/$facilityId.tsx`, shown when
    the viewer is the facility's own Manager and `facility.status` is
    `REJECTED`/`FLAGGED`/`SUSPENDED` (mirrors backend's
    `APPEALABLE_FACILITY_STATUSES`, duplicated client-side since there's no
    shared-constants file for that set yet). On submit, invalidates the
    same queries the moderation-action `onChanged` callback already does,
    so the new `APPEAL_SUBMITTED` row shows up in "Facility history"
    immediately. No duplicate-submission guard — deliberately matches the
    personal-appeal endpoint's existing behavior (`account/service.ts`
    doesn't guard either), not a new gap introduced here.
    **Verified live end-to-end** (`tsc --noEmit`/`eslint` clean beforehand):
    manufactured the test scenario directly since no seeded facility was
    flagged/suspended with a known-password Manager — signed in as
    Administrator, flagged `manager@gmail.com`'s own facility
    (Jakubowskiborough General Hospital) with a reason; signed in as
    Frank Manager (`manager@gmail.com`), confirmed the "File an appeal"
    card appeared on `/facilities/$facilityId` (via the new "My Facility"
    sidebar link) and submitted it — the card correctly switched to
    "awaiting review" and the new row showed in Facility history
    immediately, no manual refresh needed; confirmed the appeal does
    *not* show on the Manager's own `/appeals` queue (correct — only
    Administrator ever decides facility appeals, matching
    `resolveAppealAuthority`'s design); signed back in as Administrator,
    confirmed it appeared in `/appeals` correctly labeled `Facility`,
    approved it with a comment, and confirmed the facility's status
    reverted to `Approved` — full history trail visible (`Approved →
    Flagged → Appeal Submitted → Appeal Approved → Approved`). No
    leftover test artifact — unlike the 2026-08-11 orphan-facility test,
    the appeal-approve flow itself reverted the manufactured flag, no
    direct DB write needed for cleanup.
    (Aside, not a bug in this feature: clicking the sidebar "Appeals" link
    while already mid-navigation-flow twice failed to route — had to
    navigate by URL both times. Not investigated further this session;
    worth a look if it recurs, since it'd affect every role's sidebar, not
    just this feature.)
  - **First draft used raw `useState` for the form** (copying
    `account-status.tsx`'s existing personal-appeal pattern) — user caught
    this and restated the standing rule: form fields always go through
    `react-hook-form` + `zodResolver` + `useFormField`, never bare
    `useState`, matching every other form in this codebase (e.g. the
    name/address fields earlier in this same file). Rewritten to use
    `useForm<AppealBody>({ resolver: zodResolver(appealSchema) })` +
    `useFormField`. Note for later: `account-status.tsx` itself still has
    the old raw-`useState` version for the personal appeal form — same
    violation, pre-existing, not fixed this session since it wasn't part
    of either of the two gaps being worked. Worth a follow-up pass.
  - **Administrator-created user accounts — done, live-verified.** Read
    `createUserByAdminSchema`/`createUserByAdminResponseSchema`
    (`shared/src/schema/administrator.ts`) and the `userCreate` handler
    (`administrator/service.ts`): any role including another
    Administrator, active immediately, no `password` field — server
    always generates a one-time temporary password
    (`generateTemporaryPassword`) returned exactly once in the response,
    and sets `must_change_password: true`. `facility_id` is required
    unless the role is `ADMINISTRATOR` (schema-level `superRefine`), and
    must reference an `APPROVED` facility (service-level check, 404/409
    otherwise). Built `createUser` in `web/src/api/users.ts` and a
    `CreateUserDialog` on `users/index.tsx` (only place with a `/users`
    Administrator+Manager split already established), gated to
    `user.role === ROLES.ADMINISTRATOR` — the whole `administrator`
    module is `authorize([ROLES.ADMINISTRATOR])`, so Manager never sees
    the button. Two-stage dialog, same shape as `ReasonActionButton`'s
    controlled-`Dialog` pattern but with a real `react-hook-form` +
    `zodResolver(createUserByAdminSchema)` form (per
    [[feedback_forms_use_react_hook_form]]): stage one is
    name/email/role/facility (facility picker conditionally shown,
    filtered to `FACILITY_STATUS.APPROVED` — mirrors `sign-up.tsx`'s
    picker but with an explicit `status` filter added, since an
    authenticated Administrator's `facilitiesRequest` isn't scoped to
    approved-only the way the public sign-up endpoint is); stage two
    (`created` state) shows the one-time temporary password with a copy
    button, since the server never returns it again. Reused the
    page's existing `ROLE_ITEMS` and `onChanged` (query invalidation)
    rather than duplicating either.
    **Verified live end-to-end** (`tsc --noEmit`/`eslint` clean
    beforehand, both on `web/src/api/users.ts` and
    `users/index.tsx`): signed in as Administrator, opened the dialog,
    confirmed the Facility field disappears when Role is switched to
    Administrator (schema's conditional requirement matched in the UI)
    and reappears filtered to only approved facilities otherwise;
    created a real Nurse account end-to-end — toast success, new row
    appeared live at the top of the table with no manual refresh, temp
    password shown and copy-to-clipboard confirmed working; signed out
    and signed back in as that new Nurse using the temporary password —
    real dashboard loaded correctly, confirming the account is genuinely
    active and usable, not just created. Signed back in as Administrator
    to restore session state afterward.
    **Real leftover test artifact, unlike the facility-appeal test:**
    `test.nurse.create@gmail.com` ("Test Nurse Account", Denesikmouth
    Memorial Hospital) now exists as a permanent row — there is no
    delete in this system's design (status-only lifecycle throughout),
    so unlike the appeal test this can't self-clean via the flow itself.
    Left in place; harmless (just one extra seeded-looking Nurse), but
    flagging it explicitly rather than silently leaving an unexplained
    account for a future session to find. A `reset`/reseed cycle clears
    it along with everything else non-`seed.ts`.
    **Not yet built, flagged not silently skipped:** the backend sets
    `must_change_password: true` on every admin-created account, but
    grepping the frontend (`web/src`) turns up zero handling of that
    field anywhere — no forced-password-change screen, nothing on
    sign-in. It's returned on `/me`/account responses
    (`management/session.ts`, `account/service.ts`) but nothing reads
    it client-side. Out of scope for this gap (a real, separate feature
    — forced-password-change UX touching the sign-in flow), but worth
    a deliberate decision rather than leaving it an invisible gap: right
    now an admin-created user's temporary password works as a permanent
    one unless changed voluntarily via whatever profile-editing exists.
  - **New open thread, not yet scoped:** mid-session the user raised
    wanting a dedicated **frontend** permissions file, mirroring
    `api/src/lib/permission.ts` and the same RBAC/ABAC/ReBAC article
    referenced when that backend module was designed. A quick grep found
    ~50 inline `role === ROLES.X` / `role !== ROLES.X` checks scattered
    across 15+ frontend files (route `beforeLoad` guards, conditional
    rendering, `side-bar.tsx`'s nav visibility, `users/index.tsx`'s
    `resolveModerationFns`, the two just-added checks in
    `facilities/$facilityId.tsx`) — a real, same-shaped problem to the one
    that motivated the backend centralization. Explicitly deferred:
    user agreed to finish the two named gaps first, then scope this as
    its own planning pass in this doc (not improvised inline) — unlike
    the backend module, this one is route/UI-shaped (guards +
    conditional rendering + nav visibility), not query-shaped, so it
    likely isn't a straight mirror of `permission.ts`'s function-per-
    predicate design. Pick this up after Administrator-created user
    accounts ships.

**State at end of this session:** both named gaps are done and
live-verified. Manager facility-appeal was committed first (`e01fb96`).
Administrator-created user accounts followed in the same session — see
above for the full build/verify writeup — and is typecheck/lint clean,
committed next. One real leftover test artifact from live-verifying the
create-user flow: `test.nurse.create@gmail.com` ("Test Nurse Account")
is a permanent extra row (no delete in this system's design; a
reset/reseed clears it). One flagged-not-built gap: `must_change_password`
is set server-side on every admin-created account but nothing in the
frontend reads or enforces it yet — a real separate feature, not
attempted this session. Next session: the frontend permissions file is
the only remaining open thread from this doc's scope — pick that up as
its own planning pass (see the open-thread note above for the grep
findings and why it isn't a straight mirror of `permission.ts`).

**2026-08-12, new session — Administrator password reset + Argon2 password
hashing (done, committed).** Picked back up after a VS Code crash mid
`pnpm install`; the crash itself just left `node_modules` gutted (repaired
with a plain `pnpm install`), no work was lost since it's all on disk/git.

- **`PATCH /administrator/users/:id/reset-password`** — regenerates a
  user's password: the recovery path when an Administrator loses a
  just-issued (or any) temporary password before sharing it, since it's
  hashed the moment it's set and never stored recoverable. Same response
  shape as `userCreate`: a fresh one-time temporary password returned
  exactly once, `must_change_password: true` set on the row. New
  `api/src/core/account.ts` (`one`/`update` on the `account` table —
  better-auth's credential storage) backs it, wired into `CoreService`.
  Frontend: `ResetPasswordAction` on `users/$userId.tsx`, gated to
  `ROLES.ADMINISTRATOR`, same confirm → show-once-password two-stage
  dialog shape as `CreateUserDialog`.
- **Password hashing switched from better-auth's default (scrypt) to
  Argon2id, system-wide.** While wiring the reset endpoint, found that
  `better-auth/crypto`'s `hashPassword` — what the in-progress code was
  about to reuse — is just better-auth's own scrypt hasher, not Argon2,
  despite `@node-rs/argon2` already sitting unused in `api/package.json`
  from an earlier session. Rather than hash resets with Argon2 while
  sign-up/sign-in stayed on scrypt (which would've been two incompatible
  hash formats under one `account.password` column), added
  `api/src/lib/password.ts` (Argon2id via `@node-rs/argon2`, matching the
  `hash(password) => string` / `verify({hash, password}) => boolean`
  shape better-auth's `context.password` expects) and wired it into
  `auth.ts`'s `emailAndPassword.password.hash`/`.verify`. That makes
  Argon2id the one hasher for every password in the system — self
  sign-up, admin-created accounts (`signUpEmail` under the hood), and
  resets — all consistent, and it's what `userResetPassword` now imports
  instead of `better-auth/crypto`.
  **Real consequence, confirmed and accepted before doing it:** this
  invalidates every existing scrypt-format hash (all seed data, any
  pre-existing account) — better-auth's verify only understands one
  algorithm at a time. User chose the full-cutover option (over an
  Argon2-with-scrypt-fallback verify) given this is pre-release with a
  reseed convention already ([[feedback_migrations_single_file]],
  [[project_seed_data]]) — did the full `reset`/reseed cycle inside the
  docker containers rather than a fallback verify path. `seed.ts` and
  `bootstrap-admin.ts` needed no changes — both create accounts via
  `auth.api.signUpEmail`, which already picks up whatever hasher
  `auth.ts` configures.
- **Live-verified end-to-end**, whole stack up via `docker compose up -d`
  (not just the API — this touches the frontend dialog too): reset
  `src/drizzle/migrations` + reseeded fresh (confirmed stored hashes are
  `$argon2id$...` format), signed in as `administrator@gmail.com` /
  `Password@123` (proves fresh Argon2 seed hashes verify correctly, not
  just cached session), opened a Nurse's user detail page, used Reset
  password, got a new one-time temp password, signed out, signed back in
  as that Nurse with the temp password — real dashboard loaded,
  confirming the Argon2 hash written by the reset endpoint round-trips
  through better-auth's own verify. Signed back in as Administrator
  afterward to restore session state, then `docker compose down` to stop
  all containers per the user's standing instruction (API-only for
  backend testing, whole stack for end-to-end, always stop containers
  when done).
- **No change to the still-open frontend permissions file thread** —
  still the only remaining item from this doc's original scope.

**2026-08-13, new session — frontend permissions file (done), UI
consistency pass, and Manager facility-audit feature (all committed).**
Picked up the frontend permissions file thread flagged as the only open
item above.

- **Centralized frontend authorization predicates — done.**
  `web/src/lib/permissions.ts` now holds the single source of truth for
  frontend "who can do what": bare role predicates (`isAdministrator`/
  `isManager`/`isDoctor`/`isNurse`), resource-shaped predicates
  (`canActOnReferral`, `canEditReferralFull`, `canAssignDoctorToReferral`,
  `canSelfAssignReferral`, `canRedirectReferral`, `canRequestTransfer`,
  `canFileFacilityAppeal`, `canManageUsers`, `canModerateUser`), and nav
  visibility (`canViewNavItem`). Mirrors `api/src/lib/permission.ts`'s
  many-small-named-predicates pattern, but deliberately pure — every
  function takes already-fetched client data (route context `user`,
  loaded resource objects) rather than querying anything itself. Inline
  `role === ROLES.X` checks across route guards, conditional rendering,
  and `side-bar.tsx`'s nav visibility were replaced with calls into this
  module (`e94eeb8`, `f486999`, `e4c1f41`).
  **Not fully finished — 15 inline checks remain** in `referrals/
  $referralId.tsx` (2), `appeals/index.tsx` (2), `transfers/index.tsx`
  (2), `_authenticated/index.tsx` dashboard (7), and `side-bar.tsx` (2):
  mostly a `user.role === ROLES.ADMINISTRATOR ? "ADMINISTRATOR" :
  "MANAGER"` API-namespace-selector ternary duplicated 5x (not really an
  authorization predicate — a routing decision — but still worth
  centralizing to kill the duplication) and bare identity checks that
  have direct `isNurse`/`isDoctor`/`isManager`/`isAdministrator`
  equivalents already sitting unused at those call sites. Queued to
  finish immediately after this log entry.
- **Per-row action buttons collapsed into a single kebab menu** (Users,
  Appeals, Transfers) — `web/src/components/custom/row-actions-menu.tsx`
  (`1b4ad62`).
- **Cross-page UI consistency pass** — sidebar pending-count badges
  (filled circles, always shown including zero, destructive color),
  filter/search rows wrapped in a `Card` with search pinned right via
  `ml-auto`, status-badge color mapping made consistent across
  Users/Facilities/Patients/Referrals, restored default card padding
  around table lists (`18fdbf2`, `1872b1e`, `109c16f`, `8784780`,
  `c41e265`, `3ab4288`, `9197b2e`, `187d00b`). Not itself part of this
  doc's scope — a design-drift cleanup pass — but landed in the same
  session; the *structural* follow-up (shared `FilterBar`/generic
  `Table` components so pages can't drift like this again) is tracked in
  [[project_backlog]], not started.
- **New feature, not originally scoped in this doc: Manager
  facility-audit page** (`c17060b` through `eb82334`) — `GET /manager/
  audit` (`AuditManager` in `api/src/management/audit.ts`) plus, at the
  time, a dedicated `/facility-audit` frontend route: a facility-scoped
  activity feed over the existing `timeline` table (who did what to
  whom, when, why), gated to Manager via `isManager`. **Superseded
  later the same session** — see the entry below; the route now lives
  at `/audit`, merged with the Administrator's login-audit page. Went
  through many rounds of live
  user-driven refinement in one sitting — worth knowing the *current*
  shape rather than the history: Performed-by/Action/Subject/Status/
  Why/When columns; Action is always exactly one badge, colored by what
  happened (`ACTION_VARIANT`) rather than which entity it happened to,
  spread across all 10 available badge variants to avoid unrelated
  actions colliding on the same color; Referral rows show a plain
  "Referral" badge and their Subject reads as `"{origin} →
  {destination}"` (facility "Your facility" substituted for the
  viewer's own); Appeal actions (submit/approve/deny, which span both
  User and Facility rows) get their own badge and a sentence-style
  Subject ("Approved your appeal" / "Approved {name}'s appeal"); a
  row-click dialog shows full untruncated detail. Fully committed,
  live-verified in-browser at each step, no known open items on this
  feature specifically.

**2026-08-13, same session continued — appeal-phrasing consistency fix,
user-cluster removal from the audit dialog, Administrator login-audit
User column, and the Manager/Administrator audit-page merge (all
committed).**

- **Facility-audit dialog's appeal-row phrasing matched to the table**
  (`a5c40b8`) — the dialog was still building its own inline appeal
  sentence separately from the table's `appealSentenceFragment`/
  `appealWhose` helpers and had drifted; now shares them.
- **Dropped the name+role+"You"-badge cluster (`PersonCell`) from the
  dialog's summary sentence and Subject field** for non-appeal rows,
  replaced with a plain `ActorCell` (`1fb6d56`) — the cluster read as
  visually noisy/redundant once the table itself had already been
  simplified to plain names earlier in the session.
- **Administrator's login-audit page now shows the user's name instead
  of the raw `user_id`** on the User column (`5ab8b81`) — required
  threading `name` through `shared/src/schema/logins.ts`'s nested
  `user` object and `api/src/modules/audit/service.ts`'s query
  `select`, not just a frontend change.
- **Merged `/facility-audit` (Manager) and `/audit` (Administrator)
  into one role-dispatching `/audit` route** (`2fa891a`) — one URL, one
  sidebar entry ("Audit log", last in the nav for both roles), content
  chosen by role in the loader, same per-role-dispatch pattern
  `_authenticated/index.tsx` already uses for the dashboard. Removed
  `FRONTEND_URLS.FACILITY_AUDIT` and the now-redundant route file.
  Live-verified end-to-end as both roles (table render, row-click
  dialog, pagination) with a clean console. No known open items.

**2026-08-13, new session — Facility specialties feature (resolves the
`docs/backlog.md` item of the same name, fully committed).** The schema/
`core/specialty.ts` repository and seed data already existed from an
earlier session; this pass built everything that was still missing —
routes, permissions, and frontend.

- **Backend**: new `modules/specialties` (`GET/POST /specialties`,
  `PATCH /specialties/:id` — Administrator-only create/rename, no delete,
  same no-hard-delete stance as the rest of the app; reads open to any
  authenticated role). New sub-routes on `modules/facilities`
  (`GET/POST /facilities/:id/specialties`,
  `DELETE /facilities/:id/specialties/:specialtyId`) and `modules/users`
  (same three shapes under `/users/:id/specialties`), gated to
  Administrator or the owning Manager (facility) / the target's own Manager
  (staff, mirroring `canManagerActOnStaff`) — target role must be Doctor or
  Nurse. `core.specialty.linkMany`'s `include`-joined `specialty` field
  needed the same `as unknown as X` cast already used in `users/service.ts`'s
  `user()` handler for the same reason (`include`-derived fields aren't
  modeled by the repo helper's return type) — caught by independently
  re-running `tsc` rather than trusting a delegate's "pre-existing issue"
  claim, which was wrong.
- **Frontend**: new Administrator-only `/specialties` page (list/create/
  rename, react-hook-form + zodResolver dialog mirroring `CreateUserDialog`);
  a new shared `SpecialtyManager` component (removable badges + searchable
  add-picker) dropped into both the facility detail page (gated
  `canManageFacilitySpecialties` — Administrator or that facility's own
  Manager) and the Doctor/Nurse user detail page (gated
  `canManageStaffSpecialties` — Administrator or that user's own Manager);
  new sidebar nav item ("Specialties", Administrator-only, placed right
  before "Audit log" to keep that entry last per the standing requirement).
- **Deliberately out of scope**, flagged rather than silently dropped:
  referral-routing-by-specialty-match and a facilities search/filter-by-
  specialty control — both are matching/discovery features layered on top
  of this, not part of specialties CRUD itself. Tracked in
  `docs/backlog.md`.
- Seed data needed no changes — `api/script/seed.ts` already assigned 2-4
  specialties per operational facility and 1-2 per active Doctor/Nurse
  (including the standard test accounts) from an earlier session. Reseeded
  fresh anyway (`purge` left stale tables that collided with a regenerated
  migration, so used `script/reset.ts`'s raw `DROP TABLE` instead, then
  `migrate` + `seed`) to guarantee a consistent live-test baseline.
- Live-verified end-to-end as both Administrator (vocabulary create/rename,
  including the 409-conflict duplicate-name path) and Manager (own-facility
  and own-staff assign/unassign; confirmed `/specialties` correctly
  redirects Manager away and the nav item is hidden for them) — clean
  console throughout. One UI polish caught by the user mid-verification:
  the "Add" button in `SpecialtyManager` was `size="sm"` (h-8) next to the
  picker's default-size trigger (h-10); fixed by dropping the explicit size.

**2026-08-14, new session — Specialty description field + assignment
narrowed to Manager-only.** Two user-driven corrections to the specialties
feature above, done together since both touch the same files.

- **Description field**: `specialties.description` (`text`, `NOT NULL`)
  added to the Drizzle schema, `SpecialtySchema`/`specialtyRefSchema`/
  `CreateSpecialtySchema` (required, max 1000 chars), `SPECIALTY_FIELDS`,
  and the `facility`/`user` specialty-link `include`/`select` blocks (so
  the nested `specialty` ref carries it too). Frontend: a `TextArea` field
  in the `/specialties` create/rename dialog, a new "Description" table
  column, and a `title` tooltip on `SpecialtyManager`'s assigned badges.
- **Single-specialty naming rule**: the user flagged that a combined entry
  ("Obstetrics & Gynecology") violates "one specialty per entry" — split
  into two seed rows, and `CreateSpecialtySchema.name` now has a `.regex()`
  rejecting `" & "` or a standalone `"and"` (word-boundary, case-
  insensitive) with the message "Enter a single specialty — split combined
  names like 'X & Y' into separate entries." Applies to rename too (via
  `UpdateSpecialtySchema`'s `.partial()`).
- **Assignment narrowed to Manager-only, viewing unchanged**: the user
  decided Administrator should manage the specialty *vocabulary*
  (`modules/specialties`) but never assign/unassign it to a specific
  facility or Doctor/Nurse — that stays with the facility's own Manager.
  Split `facilities/service.ts`'s `canManageFacility` into
  `canViewFacilitySpecialties` (unchanged: Administrator or own-facility
  Manager — still used by the `GET` handler) and
  `canAssignFacilitySpecialties` (Manager-only, own facility — used by
  assign/unassign); removed `users/service.ts`'s
  `canManageStaffSpecialties` Administrator bypass entirely (used only by
  assign/unassign there too — its `GET` handler already used the broader
  `canViewUser` and is unaffected). Route-level `app.authorize` on all four
  assign/unassign endpoints (`facilities` + `users`) narrowed from
  `[ADMINISTRATOR, MANAGER]` to `[MANAGER]`; the `GET` list routes stay
  `[ADMINISTRATOR, MANAGER]`. Frontend mirrors this: both
  `canManageFacilitySpecialties` and `canManageStaffSpecialties` in
  `web/src/lib/permissions.ts` dropped their `isAdministrator(...) ||`
  branch, so `SpecialtyManager` renders read-only (badges, no picker) for
  Administrator on facility/user detail pages.
- **Layout**: on both the facility and user detail pages, the Specialties
  card moved from a full-width stacked card to the right column
  (`grid lg:grid-cols-3`, profile/edit form `col-span-2`, Specialties
  `col-span-1`) — stacks back to a single column below the `lg` breakpoint.
  The user detail page's profile card was factored into a local
  `profileCard` JSX variable so it can be reused both inside the grid
  (clinical staff) and standalone (non-clinical staff, no Specialties card).
- Reseeded (`reset.ts` + `migrate` + `seed`) to populate `description` on
  all 13 specialties (12 → 13 after the Obstetrics/Gynecology split) and
  pick up the new column as `NOT NULL`. Live-verified: Manager assign/
  unassign still works on their own facility; Administrator sees the same
  facility read-only (badges only, no picker); the combined-name regex
  correctly blocked "Ear & Nose" with the intended error and accepted
  "Otolaryngology"; Add-button height now matches the picker (`h-12`
  added directly, since the picker's trigger is a non-default `h-12`
  override, not the Button default `h-10`) confirmed via zoomed screenshot.
