# 014 — Two people acting on the same record at once

**Role(s):** Doctor, Manager, Administrator
**Area:** Referrals, Appeals, Users
**Last reviewed:** 2026-08-16

## Use case

Two Doctors both see the same unassigned referral in their queue and both
tap "Claim" within moments of each other. Or two Managers both open the
same pending appeal, or the same pending staff application, and decide it
almost simultaneously — one approving, one rejecting, each unaware the
other got there first. Whoever loses the race should get a clear signal
that the record was already handled, not a false "success."

## Problem

Any system where more than one authorized person can act on the same
record needs to decide what happens when two of them act at (nearly) the
same instant. Silently letting both writes through — with the last one to
land simply overwriting the first, and no error to the loser — produces
exactly the failure mode staff dread most: believing an action succeeded
when it didn't, with no error message to tell them otherwise.

## Solution

Every status-transition write examined in this codebase follows the same
shape: fetch the record, check its current value in application code, then
write unconditionally by primary key (`where: { id }` only, on all 17
`.update(` call sites checked across `api/src/modules/*` and
`api/src/management/*`). None of them condition the write on the value
actually being changed — the DB access layer's `updateRecords()`/
`buildWhere()` helpers (`api/src/core/helpers.ts:233+,975-1016`) support
that (arbitrary non-PK `WHERE` clauses, including `isNull`), but no caller
ever uses it that way. There's no version column on any table and no
`SELECT ... FOR UPDATE` usage anywhere.

Concretely, for referral self-assign
(`api/src/modules/referrals/service.ts:390-448`): two Doctors both reading
`existing.doctor === null` before either writes will both pass the guard
and both successfully claim the referral. The final `doctor` value is
whichever `UPDATE` commits last — not whoever clicked first — and both
requests insert their own `DOCTOR_ASSIGNED` timeline row, leaving an audit
trail with two assignments and no marker for which is current. The
displaced Doctor sees no error.

The same shape shows up for appeal decisions
(`AppealManager.decide`, `api/src/management/appeal.ts:164-215`) and
staff approve/reject (`ModerationManager.applyUserStatusChange`,
`api/src/management/moderation.ts:63-96`): the pre-write status guard
(`isOpen()` / `status !== PENDING`) runs in its own separate round trip
before the write, so it only protects against requests spaced far enough
apart — it does nothing for genuinely concurrent ones. Two Managers
deciding the same appeal in opposite directions both succeed; the
entity's final status is last-write-wins, while the timeline permanently
keeps both a positive and a negative decision row for the same appeal,
with nothing in the data model to say which one actually stuck. Full
write-up and fix-direction options are in [No concurrency control on any
status-transition write — systemic race
condition](../../backlog.md#no-concurrency-control-on-any-status-transition-write--systemic-race-condition).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Referral self-assign uses an atomic conditional update (`WHERE doctor IS NULL`) | Read `referralAssign`'s DB call | ❌ Confirmed absent, 2026-08-16 — `where: { id }` only |
| 2 | Appeal decision uses an atomic conditional update or lock between `isOpen()` and the write | Read `AppealManager.decide` and its callers | ❌ Confirmed absent, 2026-08-16 — two unguarded round trips |
| 3 | Staff approve/reject uses an atomic conditional update | Read `ModerationManager.applyUserStatusChange` and its callers | ❌ Confirmed absent, 2026-08-16 — `where: { id }` only, not even wrapped in a transaction in the plain approve/reject handlers |
| 4 | This pattern is isolated to one or two spots vs. systemic | Grepped every `.update(` call site in `api/src/modules/*` and `api/src/management/*` | ❌ Confirmed systemic, 2026-08-16 — 17/17 call sites key `WHERE` on primary key only |
| 5 | A losing concurrent write surfaces any error or conflict signal | Traced the full write path for all three cases above | ❌ Confirmed silent, 2026-08-16 — no unique constraint, version column, or lock catches it anywhere |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
