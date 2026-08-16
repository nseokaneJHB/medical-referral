# Scenario Documentation

Status: **living library of real-world use cases.** This documents how the
system solves actual referral-coordination problems — walked by hand
(browser, real roles, real data) against the running system so the
documentation reflects what the app actually does, not just what it's
supposed to do. Each scenario is a self-contained reference: use case,
problem, and how the app solves it. New scenarios get added as they're
thought of; existing ones get expanded (new edge cases, new roles) rather
than duplicated.

**A scenario document is not a bug report or a test-results log.** It
describes a use case and its solution — it should read the same whether
the underlying behavior was correct on the first try or took three
iterations to fix. If walking a scenario turns up something wrong along
the way, that finding belongs in `docs/bugs.md` (defects) or
`docs/backlog.md` (gaps/scope questions) — its own dedicated file — not
folded into the scenario's narrative. A scenario can link to those docs,
but shouldn't carry pass/fail status, "was broken until," or tracking
tables itself. See [[BUG-001 in docs/bugs.md]] for an example of a real
defect this style of hands-on walkthrough caught that a type-check/lint
pass would not have — but note that BUG-001 lives in `bugs.md`, not
duplicated into whatever scenario surfaced it.

## How to find scenarios — start from the real world, not the UI

Scenarios come from the **problem this system exists to solve**, not from a
walk of its routes/screens. A referral-tracking system exists because
patients get referred between facilities and things go wrong in that
process in the real world: referrals sit untouched, patients fall through
the cracks between two facilities who each think the other is handling it,
a facility gets overloaded and needs to redirect intake, a referral gets
made to a facility that can't actually treat the specialty, staff need to
be held accountable for referrals they dropped, a rejected referral needs
to be appealed, an auditor needs to reconstruct who did what after an
incident. **Start from questions like these, then find where in the system
that story plays out** — not the other way around ("here's a button, what
does it do").

A scenario mapped from the UI produces "test the Flag button." A scenario
mapped from the real world produces "a nurse discovers a patient never
arrived at the receiving facility three days after referral, and needs to
find out why, escalate it, and make sure it doesn't happen silently again"
— which might touch flagging, but also status history, notifications (or
the lack of them), audit, and appeal paths, and is far more likely to
surface a real gap than a button-by-button pass would. Mapping scenarios to
routes/CRUD screens will systematically miss the failure modes that matter
most, because those failure modes live in the gaps *between* screens and
roles, not inside any one of them.

Good sources for real-world scenarios: the actual referral lifecycle
end-to-end (not one status transition in isolation), what happens when two
roles disagree or don't communicate, what an auditor/compliance reviewer
would need to reconstruct after something goes wrong, what happens at
volume/scale (a busy facility, a backlog), and what happens when someone
acts in bad faith or by mistake (wrong role, wrong facility, duplicate
action, abandoned flow).

## Folder convention

```
docs/scenarios/
  README.md                        <- this file, methodology + index
  001-referral-falls-through-cracks/
    scenario.md                    <- use case, problem, solution, tracking table
    notes.md                       <- recording breakdown, related links, enrichment ideas
    recording.mp4                  <- optional, if a recording was made
  002-.../
    scenario.md
    notes.md
    ...
```

- One folder per scenario, numbered in creation order (`NNN-kebab-slug`).
  Numbering is just for stable ordering/reference (e.g. "see 004") — it
  doesn't imply priority or execution order.
- Each folder has a `scenario.md` (required) and a `notes.md` (required —
  even if there's no recording yet, it still holds Related/Enrichment
  ideas). A recording is optional — see "Recording" in the `notes.md`
  template below for when it's worth the effort and how it's made.
- A scenario that grows enough distinct sub-cases (e.g. every referral
  status transition) can keep them as one `scenario.md`/`notes.md` pair
  with multiple rows in the tracking table, rather than splintering into
  many folders. Split into a new scenario when the *actor's goal* changes,
  not when a step count grows.

## `scenario.md` template

`scenario.md` is the use case itself — use case, problem, solution, and a
tracking table confirming the solution still matches reality. It does not
carry recording breakdowns, related links, or enrichment ideas — those live
in the same folder's `notes.md`, linked from the bottom of `scenario.md`.

````markdown
# NNN — Scenario Title

**Role(s):** Nurse | Doctor | Manager | Administrator | (unauthenticated)
**Area:** Patients | Referrals | Users | Facilities | Specialties | Audit | Transfers | Appeals | Auth
**Last reviewed:** 2026-08-15

## Use case

The real-world story: who is doing this, in what situation, and why. Written
from the actor's point of view, not the system's — e.g. "A nurse at a
receiving facility gets a call that a referred patient never showed up, and
needs to check the referral's status and flag it for follow-up," not "test
the referral status field."

## Problem

The underlying real-world problem this part of the system exists to solve —
what goes wrong without it, and why it matters (data integrity, wrong-role
access, silent failure, confusing UX, accountability, etc).

## Solution

How the app solves this today — the intended behavior, referencing the
relevant permission rule / schema / code path where useful (e.g.
`canActOnReferral` in `api/src/lib/permission.ts`). Describe what actually
happens when the use case is walked, in plain declarative terms ("the
destination facility field shows X because Y"), not as a pass/fail check
against a spec.

If walking the scenario surfaces something wrong or incomplete, don't
document that here — write it up in `docs/bugs.md` (a defect) or
`docs/backlog.md` (a gap/scope question), then link it from `notes.md`'s
**Related** section. This section stays a clean description of the
current, intended solution.

## Tracking table

Confirms the Solution section still holds — not a bug/pass-fail log, just
"was this actually checked, and when."

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Nurse opens a referral | "Destination facility" matches the header | ✅ Confirmed live in browser, 2026-08-15 |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
````

## `notes.md` template

````markdown
# NNN — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

The user records manually (GNOME screen-recording UI or Awesome Screen
Recorder) — there's no tool access to drive an OS-level or extension
recorder programmatically, and it produces a real video instead of a
frame-capped GIF. Their recorder caps out at **5 minutes per take**, so:

- All investigation/root-causing (zooming in on odd UI, checking network
  requests, reading code to confirm a hypothesis) happens *before* asking
  the user to hit record — never mid-take.
- The click/type/navigate sequence is planned in advance once the
  investigation is done, then executed in one clean, fast pass — batched
  tool calls, minimal screenshots, no meandering.
- Say "starting now" right before the first action and "done, you can stop"
  right after the last one, so the user isn't guessing when to press stop.
- If a take runs long or goes sideways, redo it clean rather than padding
  the recording with recovery steps.

`recording.mp4` (or `.webm`, whatever the recorder outputs) goes in the
scenario's folder, plus a timestamp table describing what's happening and
why at each point:

| Time | What's happening | Why |
|------|-------------------|-----|
| 0:00 | Landing on referral list, signed in as Nurse | Starting state |
| 0:05 | Opening referral #1234, clicking Flag, submitting reason | Exercising the use case |
| 0:11 | Flag banner appears on the patient record | Confirms the solution working end to end |

## Related

- Backlog items: links into `docs/backlog.md`, if this use case has an open
  gap worth tracking
- Bug reports: links into `docs/bugs.md`, if walking this scenario
  surfaced a defect — the defect's write-up lives there, not here
- Other scenarios that share setup/state (e.g. depends on a referral created
  in scenario 001)

## Enrichment ideas

Optional, per-scenario. Ideas for widening this scenario next time it's
revisited — not commitments, just a parking spot so the idea isn't lost.
Examples of the *kind* of thing that goes here (not a checklist to
mechanically apply to every scenario):

- A negative-path variant (wrong role attempts the same action)
- A concurrency variant (two users acting on the same record at once)
- A boundary/empty-state variant (0 results, max-length input, expired data)
- Whether this scenario is worth converting into an automated `api` test
  once the behavior is stable
````

## When a recording is worth it

Worth capturing when the scenario is visual/interactive enough that a
reader benefits from seeing it (multi-step flows, anything where "what does
this actually look like" matters). Skip it for scenarios that are really
just API/permission checks with no meaningful UI story — the Solution
section's description is enough there. Don't let recording-for-its-own-sake
slow down coverage. See "Recording" in the `notes.md` template above for
how a take actually gets made (user records manually, 5-minute cap,
plan-then-execute).

## Scenario index

Update whenever a scenario is added. This is the fastest way to see what's
documented without opening every folder.

| # | Scenario | Role(s) | Area | Last reviewed |
|---|----------|---------|------|----------------|
| [001](001-referral-verification-and-audit-trail/scenario.md) | Referral verification and audit-trail reconstruction | Nurse, Administrator | Referrals, Audit | 2026-08-16 |
| [002](002-referral-falls-through-the-cracks/scenario.md) | Referral falls through the cracks | Nurse, Doctor, Manager | Referrals, Dashboard | 2026-08-16 |
| [003](003-rejected-referral-appeal/scenario.md) | Rejected referral appeal | Nurse, Doctor | Referrals | 2026-08-16 |
| [004](004-facility-overload-redirect/scenario.md) | Facility overload / redirect | Doctor, Manager | Referrals, Facilities, Dashboard | 2026-08-16 |
| [005](005-wrong-specialty-referral/scenario.md) | Wrong-specialty referral | Nurse, Doctor | Referrals, Facilities, Specialties | 2026-08-16 |
| [006](006-accountability-for-dropped-referrals/scenario.md) | Accountability for dropped referrals | Manager, Administrator | Referrals, Audit, Users | 2026-08-16 |
| [007](007-facility-moderation-vs-inflight-referrals/scenario.md) | Facility moderation vs. in-flight referrals | Administrator, Nurse, Doctor | Facilities, Referrals | 2026-08-16 |
| [008](008-patient-transfer-mid-referral/scenario.md) | Patient transfer with an in-flight referral | Nurse, Doctor, Manager | Patients, Transfers, Referrals | 2026-08-16 |
| [009](009-urgent-referral-has-no-urgency/scenario.md) | An Urgent referral has no actual urgency | Nurse, Doctor, Manager | Referrals, Dashboard | 2026-08-16 |
| [010](010-duplicate-appeal-submission/scenario.md) | Appealing a rejected or flagged account | Nurse, Doctor, Manager, Administrator | Users, Facilities, Appeals | 2026-08-16 |
| [011](011-staff-departure-caseload-handoff/scenario.md) | Staff departure and caseload handoff | Manager, Administrator, Doctor, Nurse | Users, Referrals | 2026-08-16 |
| [012](012-redirect-chain-visibility/scenario.md) | Referral redirect chains and cross-facility visibility | Nurse, Doctor, Manager | Referrals, Patients, Facilities | 2026-08-16 |
| [013](013-duplicate-patient-records/scenario.md) | Duplicate patient records | Nurse, Doctor, Manager | Patients | 2026-08-16 |
| [014](014-concurrent-actions-race-conditions/scenario.md) | Two people acting on the same record at once | Doctor, Manager, Administrator | Referrals, Appeals, Users | 2026-08-16 |
| [015](015-facility-staff-onboarding/scenario.md) | Facility and staff onboarding edge cases | Manager, Administrator, Doctor, Nurse | Users, Facilities, Auth | 2026-08-16 |
| [016](016-specialty-lifecycle/scenario.md) | Specialty lifecycle: rename, delete, and reference integrity | Administrator | Specialties | 2026-08-16 |
| [017](017-password-recovery/scenario.md) | Password recovery and reset security | Nurse, Doctor, Manager, Administrator | Users, Auth | 2026-08-16 |
| [018](018-dashboard-report-correctness/scenario.md) | Dashboard and report number correctness | Doctor, Manager, Administrator | Referrals, Dashboard | 2026-08-16 |
| [019](019-brute-force-protection/scenario.md) | Brute-force and account-takeover resistance | Nurse, Doctor, Manager, Administrator | Auth | 2026-08-16 |
| [020](020-audit-trail-completeness/scenario.md) | Audit trail completeness across the app | Administrator, Manager | Audit, Users, Facilities, Specialties, Referrals | 2026-08-16 |
| [021](021-cross-facility-content-safety/scenario.md) | Cross-facility free-text content safety | Nurse, Doctor, Manager, Administrator | Referrals, Patients, Appeals, Transfers, Audit | 2026-08-16 |
| [022](022-bulk-actions-and-scale/scenario.md) | Operating at volume: bulk actions and list limits | Doctor, Manager, Administrator | Referrals, Users, Appeals, Transfers | 2026-08-16 |
| [023](023-patient-data-retention/scenario.md) | Patient data retention, correction, and deletion requests | Nurse, Doctor, Manager | Patients, Audit | 2026-08-16 |
| [024](024-facility-and-user-profile-editing/scenario.md) | Editing a facility's profile, and the missing user profile page | Manager, Administrator, Nurse, Doctor | Facilities, Users, Audit | 2026-08-16 |
| [025](025-email-verification/scenario.md) | Email verification and signup identity assurance | Nurse, Doctor, Manager, Administrator | Auth, Users | 2026-08-16 |
| [026](026-multi-facility-staff-and-repeat-appeals/scenario.md) | One person, two facilities; and appealing again after a fair denial | Doctor, Nurse, Manager, Administrator | Users, Facilities, Appeals | 2026-08-16 |
| [027](027-search-wildcard-correctness/scenario.md) | Search boxes and literal wildcard characters | Nurse, Doctor, Manager, Administrator | Patients, Referrals, Facilities, Users, Specialties | 2026-08-16 |
| [028](028-sort-parameter-safety/scenario.md) | Sort-parameter safety across list endpoints | Nurse, Doctor, Manager, Administrator | Patients, Referrals, Facilities, Users, Specialties | 2026-08-16 |
| [029](029-history-visibility-and-data-export/scenario.md) | History visibility at scale, and getting data out of the app | Manager, Administrator, Nurse, Doctor | Audit, Referrals, Facilities, Users | 2026-08-16 |
| [030](030-accessibility-keyboard-and-screen-reader/scenario.md) | Screen-reader and keyboard-only access to core workflows | Nurse, Doctor | Patients, Referrals, Auth | 2026-08-16 |
| [031](031-date-range-filters-across-timezones/scenario.md) | Date-range filters across timezones | Nurse, Doctor, Manager, Administrator | Patients, Referrals, Dashboard | 2026-08-16 |
| [032](032-non-english-names-and-accent-search/scenario.md) | Non-English names and accent-insensitive search | Nurse, Doctor, Manager, Administrator | Patients, Users, Facilities, Specialties | 2026-08-16 |
