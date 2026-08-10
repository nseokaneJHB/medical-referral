# Roles & Permissions — Planning Doc

See also: [docs/backlog.md](./backlog.md) for parked ideas raised in passing
(facility specialties, user profile pages, etc.) that overlap with this work
but aren't in scope yet.

Status: **PLANNING — no code changes yet.** This is a living doc for a multi-session
design discussion. Update it as decisions land; don't let it drift from the
conversation.

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
