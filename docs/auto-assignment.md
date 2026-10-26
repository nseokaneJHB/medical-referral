# Automatic doctor assignment (workload + specialty based)

**Status:** Design agreed 2026-09-16, implemented same day (typecheck clean).
Not yet live-verified against a running database — see note at the end.
Written up here per this repo's planning-doc convention before handing off
exact diffs.

## What this touches, in plain terms

- **Referral creation contract changes.** Specialty tags move from a
  separate post-create loop of API calls into the `POST /referrals` request
  body itself, created in the same transaction as the referral.
- **New auto-assignment function**, called (a) once right after a referral
  (and its specialty links) are created, and (b) again from three other
  existing mutation points whenever an unassigned referral's eligible-doctor
  pool could have changed.
- **New revalidation function**, called whenever a specialty tag is added to
  or removed from an already-assigned, still-open referral, to catch the
  assigned doctor no longer matching.
- **Frontend rework** of `web/src/routes/_authenticated/referrals/new.tsx`
  to send staged specialties in the create call instead of looping
  `assignReferralSpecialty` afterward.
- **No new infrastructure** — no Kafka, no cron, no job queue. Everything
  runs synchronously, in-process, inside the existing Fastify/Drizzle
  transaction machinery.
- **Manual assignment is untouched** — Manager `PATCH /referrals/:id` and
  Doctor self-claim `POST /referrals/:id/assign` keep working exactly as
  today, as an override path alongside auto-assignment.

## Why this shape (context from investigation)

- No "availability" concept exists anywhere today (`user.ts`, `facility.ts`
  both confirmed clean of any capacity/availability column).
- No job/queue/cron infrastructure exists (`api/src/management/`,
  `package.json` confirmed clean) — ruled out background-sweep and
  Kafka-based designs as unnecessary infrastructure for what is fundamentally
  a synchronous "pick the best doctor right now" decision.
- `docs/backlog.md`'s "No specialty-match validation..." entry already
  documents a **confirmed, reproduced** bug: a Psychiatry-only doctor
  self-assigned to an Internal Medicine referral with no warning. Any
  auto-assignment design that ignores specialty matching would systematize
  that exact bug rather than fix it — so specialty matching is mandatory
  scope here, not a follow-up.
- The current frontend creates a referral, then fires specialty-tag calls
  *after*, sequentially (`new.tsx`, `onSubmit`). Naively auto-assigning at
  raw creation would match against zero known specialties and could lock in
  a doctor before the real requirement is even in the database — recreating
  the same bug at an earlier point. Fixed at the root by folding specialties
  into the create request instead of working around the race.

## Decisions

1. **Availability = workload, not a manual toggle.** A doctor's current
   count of non-terminal referrals (`status` not in `COMPLETED` /
   `REJECTED` / `CANCELED`, i.e. `TERMINAL_REFERRAL_STATUSES`) assigned to
   them via `referral.doctor`. Lower count = more available. No new column,
   no self-service toggle.
2. **Strictly same-facility.** Only doctors where `user.facility_id ===
   referral.destination_facility_id` are candidates. Cross-facility
   auto-assignment is explicitly out of scope ("look at that possibility
   after").
3. **Specialty matching is required, overlap-based.** A referral can need
   multiple specialties (`referral_specialties` is many-to-many). A
   candidate doctor is eligible if they have **at least one** overlapping
   specialty (via `user_specialties`) with the referral's tagged set —
   not all of them, since requiring full coverage from a single doctor could
   make otherwise-reasonable matches impossible. If the referral has **zero**
   tagged specialties, the specialty filter is skipped entirely (any
   eligible doctor counts).
4. **Doctor eligibility beyond facility/specialty:** `role = DOCTOR`,
   `status = ACTIVE` (excludes `PENDING`, `DISABLED`, `REJECTED`, `FLAGGED`,
   `DEPARTED`).
5. **Tie-break:** among doctors tied on lowest workload, pick deterministically
   (proposed: lowest `user.id`) rather than randomly, so behavior is
   reproducible/testable. Open to a different deterministic tiebreak if
   preferred (e.g. earliest `created_at`) — flag at review if so.
6. **No match found → leave unassigned, `PENDING`.** Identical to today's
   existing valid "unassigned" state. No extra flag/badge.
7. **Assignment behaves like existing doctor-assignment paths:** if the
   referral was `PENDING`, auto-assigning also moves it to `ACCEPTED` (same
   auto-accept convention already used by Manager-assign and doctor
   self-claim). A `timeline` row is written either way
   (`TIMELINE_ACTION.DOCTOR_ASSIGNED`), noting it was automatic, for the
   same auditability reason every other assignment path already logs.
8. **Auto-assign failures never block referral/specialty creation.** The
   referral + its specialty links are created and committed first; the
   auto-assign attempt happens as an isolated, best-effort step (its own
   try/catch, logged on failure) afterward. A bug in the new matching logic
   degrades to "referral created, unassigned" — it can never prevent a
   referral from being created.
9. **Retry for stale unassigned referrals is event-triggered, not
   polled.** Auto-assign gets re-attempted for a facility's outstanding
   unassigned, non-terminal referrals whenever something could plausibly
   free up a matching doctor:
   - a referral tied to that facility transitions to a terminal status
     (frees the previous doctor's workload) — hook: `referralStatusUpdate`
     (`api/src/modules/referrals/service.ts`, ~line 869).
   - a doctor at that facility is re-activated (`status` → `ACTIVE`) —
     hook: wherever `applyUserStatusChange` lands
     (`api/src/management/moderation.ts:66-101`).
   - a doctor at that facility gains a specialty — hook: `users/service.ts`
     around line 353 (`core.specialty.linkCreate("user", ...)`, confirmed
     this endpoint exists and is the only place `user_specialties` rows get
     created outside seed data).

   No time-based polling/cron layered on top, per your call — if an edge
   case is later found to slip through all three hooks, revisit then.
10. **Revalidation on specialty tag change for already-assigned referrals**
    (closes the gap the advisor flagged: folding specialties into creation
    only protects the moment of creation — a Nurse/Doctor can still tag or
    untag a specialty on an already-assigned, still-open referral via the
    existing `referralSpecialtyAssign`/`Unassign` endpoints,
    `api/src/modules/referrals/service.ts` ~line 705 and ~797). After either
    call succeeds, if the referral is non-terminal and has an assigned
    doctor:
    - Recompute the referral's current specialty set.
    - If it's non-empty and the assigned doctor has zero overlap with it,
      unassign (`doctor = null`, revert `ACCEPTED` → `PENDING` if it had
      auto-accepted), log a timeline entry, then immediately re-run
      auto-assign against the now-current specialty set (may reassign a
      different, matching doctor right away, or leave it unassigned if none
      exists).
    - If the referral has zero specialties (last tag just removed) or the
      doctor still overlaps, no action.

## Explicitly out of scope (flagged, not silently dropped)

- Cross-facility auto-assignment (revisit later, per your note).
- A manual doctor availability toggle (workload-based only, for now).
- Any UI change beyond the create-form rework (no new "auto-assigned" badge
  requested).
- Redirect (`referralRedirect`) does not auto-assign at the new destination
  facility — it already resets `doctor: null` / status `PENDING` on
  redirect today, which is exactly the "unassigned" state the event-triggered
  hooks above already know how to fill on the next relevant event at that
  facility. Not adding a dedicated hook there unless you want one.

## Technical touchpoints (for implementation)

- `shared/src/schema/referral.ts` — extend the create request schema with
  optional `specialty_ids: string[]`.
- `api/src/modules/referrals/type.ts` / `service.ts` (`referralCreate`,
  ~line 100) — accept `specialty_ids`, create referral + specialty links in
  one transaction, then call the new auto-assign function outside that
  transaction (or in a nested try/catch) so its failure can't roll back
  creation.
- `api/src/management/auto-assignment.ts` (`AutoAssignmentManager`) — houses
  the eligibility query (facility + role + status + specialty overlap), the
  workload count (reuse `core.referral.count({...}, "doctor")`-style
  grouping, restricted to the eligible doctor id set and non-terminal
  statuses), the pick, and the revalidation function. Lives in
  `management/` rather than `modules/referrals/`, matching this codebase's
  existing convention (`ModerationManager`, `AppealManager`) for
  cross-module business logic composed of `core/*` repos — `appeal.ts`
  needs to call into it too (doctor reinstatement), and `management/*.ts`
  importing from `modules/*` would invert the codebase's normal dependency
  direction.
- `api/src/modules/referrals/service.ts` — wire the three recheck hooks
  into `referralStatusUpdate`, and the specialty tag/untag revalidation into
  `referralSpecialtyAssign`/`referralSpecialtyUnassign`.
- `api/src/management/moderation.ts` — hook doctor re-activation.
- `api/src/modules/users/service.ts` (~line 353) — hook doctor
  gains-a-specialty.
- `web/src/routes/_authenticated/referrals/new.tsx` — send staged
  specialty IDs in the create payload; drop the post-create tagging loop
  and its partial-failure handling (no longer needed once it's atomic).
- `web/src/api/account.ts` / referrals API client — update the create
  request type to match the new shared schema.
- Migrations: no new columns needed (workload is derived, not stored) — if
  any schema shape changes at all, regenerate fresh per convention rather
  than accumulate.

## Open item for review

Tie-break rule (#5) is a judgment call with no strong signal either way —
flag if you'd rather it be something other than lowest `user.id`.

## Verification status

Implementation applied and typecheck-clean across all three workspace
packages (the only `pnpm typecheck` failures are 4 pre-existing `by_type`
errors in `administrator/service.ts` / `manager/service.ts`, confirmed via
`git stash` + typecheck on unmodified `main` — unrelated to this feature,
not introduced by it).

Live-verified 2026-09-16 against the API-only container (`referral-tracking-database`
+ `referral-tracking-api`, existing seeded data — 4 Doctors at one facility
with mixed specialties/workloads):

- **Creation-time match, specialty filter correct**: referral tagged
  `Obstetrics` at creation → picked "Megan Jaskolski" (workload 1),
  correctly excluding "Derek Doctor" (no Obstetrics) even though he wasn't
  the most loaded; auto-accepted PENDING → ACCEPTED; timeline row and
  `referral_specialties` link both correct.
- **Creation-time match, no specialty filter, tie-break**: referral with no
  specialty tags → picked "Kattie Gerlach V", the least-loaded of all 4
  eligible doctors.
- **Revalidation catches a post-creation mismatch**: tagged `Cardiology`
  (a specialty nobody at the facility held) onto the just-assigned Kattie
  referral → correctly detected zero overlap, reverted ACCEPTED → PENDING,
  unassigned, logged it, retried auto-assign, and correctly landed on
  "unassigned, PENDING" since no eligible doctor existed yet.
- **Event-triggered recheck resurrects a stuck referral**: granted "Derek
  Doctor" the `Cardiology` specialty via the Manager specialty-assign
  endpoint → the stuck unassigned referral was immediately picked up and
  assigned to him, no polling involved.
- No errors in API logs across the whole sequence.

Not separately re-verified live: the "referral goes terminal" and "doctor
reinstated via appeal" recheck hooks — both call the same `recheckFacility`
already proven correct above, just from a different call site; each diff
was hand-verified against the exact specified change (see PR diff), so the
remaining risk is wiring-only, not logic.
