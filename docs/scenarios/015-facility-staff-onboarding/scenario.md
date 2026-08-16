# 015 — Facility and staff onboarding edge cases

**Role(s):** Manager, Administrator, Doctor, Nurse
**Area:** Users, Facilities, Auth
**Last reviewed:** 2026-08-16

## Use case

A brand-new facility signs up for the system along with its founding
Manager. Later, more Nurses and Doctors join that facility. Separately, an
Administrator needs to be able to reject or suspend a facility that turns
out to be fraudulent or non-compliant, and the system needs to keep
working sensibly if a facility ever ends up with no Manager at all —
whether that's on day one (before its founder is approved) or later (its
only Manager leaves or is removed).

## Problem

Multi-tenant onboarding has a chicken-and-egg problem at its core: normally
a Manager approves their own facility's new staff, but a facility's very
first Manager has no Manager to approve *them*. Getting the bootstrap
sequence wrong either locks every new facility out permanently or opens a
hole where unapproved facilities can operate. Separately, if facility-level
moderation (reject/suspend) doesn't actually affect what its staff can do
in practice, punishing a bad-faith facility is theater, not enforcement.

## Solution

This flow is largely solid, confirmed end to end:

- **A brand-new facility and its founding Manager are created together as
  a paired-PENDING unit.** `authentication/service.ts:79-89` creates the
  facility as `FACILITY_STATUS.PENDING`; the Manager account defaults to
  `USER_STATUS.PENDING` (`api/src/lib/auth.ts:77-82`). Neither is usable
  yet, but both exist.
- **The bootstrap problem is solved by giving the Administrator, not a
  Manager, authority over the very first approval.** `managerApprove`
  (`api/src/modules/administrator/service.ts:65-128`) approves the
  Manager and, in the same transaction, approves the paired facility if
  it's still `PENDING` — the two resolve together, atomically. There's
  never a window where one is approved and the other isn't (for the
  founding pair specifically).
- **Anyone trying to join an existing facility — staff or an additional
  Manager — is blocked unless that facility is `APPROVED`.**
  `authentication/service.ts:90-109` returns a 409 for signups naming a
  PENDING, REJECTED, FLAGGED, or SUSPENDED facility. This one check
  covers every non-approved status, not just "does the facility exist."
- **A PENDING user can sign in but can't do anything gated.**
  `authenticate` middleware deliberately allows any authenticated session
  through so a PENDING/REJECTED/FLAGGED/DISABLED user can still check
  their own status and file an appeal — but every role-gated route goes
  through `authorize`, which blocks non-`ACTIVE` accounts
  (`isAccountUsable`) and blocks accounts at a non-usable facility
  (`isFacilityUsable`), both in `api/src/lib/permission.ts`.
- **Rejecting or suspending a facility doesn't touch its staff rows, but
  does lock them out in practice, immediately.**
  `ModerationManager.applyFacilityStatusChange`
  (`api/src/management/moderation.ts:104-139`) only ever updates the
  `facility` row — staff `user` rows stay `ACTIVE` in the database. But
  because `authorize` re-checks the facility's *current* status on every
  request, staff at a REJECTED or SUSPENDED facility are blocked from
  every gated route the moment that status changes, with no separate
  cascade needed. (`FLAGGED` is deliberately excluded from this — staff
  at a flagged facility keep working, per the "exit-only" design already
  covered in [007](../007-facility-moderation-vs-inflight-referrals/scenario.md).)
- **A facility that loses its only Manager isn't a dead end.** The
  Administrator staff-approval routes each check whether the target
  facility currently has an active Manager
  (`api/src/modules/administrator/service.ts:300-313` and equivalent in
  `staffReject`/`staffFlag`) and only step in when it doesn't — otherwise
  they defer with a 403 telling the caller the facility's own Manager
  handles it. The same "orphaned facility" concept is reused for patient
  transfer decisions (`canDecideTransfer`,
  `api/src/lib/permission.ts:190-199`).

The one gap: this orphaned-facility fallback is entirely reactive.
Nothing proactively flags "Facility X just dropped to zero active
Managers" — it's only discovered the next time someone happens to try
acting on that facility's staff. See the addendum in [Referral priority is
purely cosmetic, and there is no notification system at
all](../../backlog.md#referral-priority-is-purely-cosmetic-and-there-is-no-notification-system-at-all)
for the fuller context (this is the same root cause — no alerting
mechanism anywhere in the app — showing up in a different place).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A brand-new facility and its founding Manager both start PENDING | Read `authentication/service.ts`'s signup handler | ✅ Confirmed, 2026-08-16 |
| 2 | Approving the founding Manager also approves the paired facility, atomically | Read `managerApprove` | ✅ Confirmed, 2026-08-16 — same transaction |
| 3 | Signing up to join a non-APPROVED facility is blocked | Read the join-existing-facility signup path | ✅ Confirmed, 2026-08-16 — 409 for PENDING/REJECTED/FLAGGED/SUSPENDED alike |
| 4 | A PENDING user is blocked from gated routes but can still check status/appeal | Read `authenticate` and `authorize` middleware | ✅ Confirmed, 2026-08-16 |
| 5 | Rejecting/suspending a facility locks out its staff without a DB cascade | Read `applyFacilityStatusChange` and `authorize`'s per-request facility check | ✅ Confirmed, 2026-08-16 |
| 6 | A manager-less facility's staff approvals fall through to the Administrator | Read the `hasActiveManager` checks in `administrator/service.ts` | ✅ Confirmed, 2026-08-16 |
| 7 | The system proactively flags a facility that just became manager-less | Same code paths as #6 | ❌ Confirmed absent, 2026-08-16 — reactive discovery only |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
