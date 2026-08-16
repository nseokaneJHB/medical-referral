# 020 — Audit trail completeness across the app

**Role(s):** Administrator, Manager
**Area:** Audit, Users, Facilities, Specialties, Referrals
**Last reviewed:** 2026-08-16

## Use case

An Administrator reconstructing what happened after an incident — a
disputed reassignment, a compliance question, a "who did this and when"
— pulls up the audit log for an entity and expects every state-changing
action on it to be there, not just the ones someone remembered to log.

## Problem

An audit trail is only trustworthy if it's complete. A single silent gap
doesn't just lose one record — it undermines confidence in the whole log,
because anyone reconstructing history now has to wonder what else might
be missing. This continues directly from BUG-008 (fixed),
which found one such gap in referral doctor-reassignment; this scenario
checked whether that was an isolated oversight or part of a pattern.

## Solution

Mixed results. Most of the app's status-changing actions are solid:
patient flag/unflag, all four facility moderation actions (approve,
reject, flag, suspend), and all four transfer-decision paths (both sides,
both outcomes) each unconditionally write a correctly-populated
`timeline` row — traced fully, no gaps found in any of them.

Two real gaps turned up in the same pass, different in shape:

- **BUG-011: Administrator-created accounts leave no audit trail at
  all (fixed)** —
  live-verified: creating a user via `POST /administrator/users` produces
  an immediately-`ACTIVE` account with zero `timeline` rows, unlike every
  other path that activates a user (Manager/Administrator approving a
  pending signup), which always logs it. This is the same *class* of gap
  as BUG-008 — an existing, working mechanism (`ModerationManager`) that
  one specific call path simply doesn't use.
- **[Specialty assignment/unassignment is completely untracked in the
  audit
  trail](../../backlog.md#specialty-assignmentunassignment-is-completely-untracked-in-the-audit-trail)** —
  a broader, structural gap: six handlers across facility, user, and
  referral specialty links never write a timeline row, and there isn't
  even a `TIMELINE_ACTION` value defined for it. Unlike BUG-008/BUG-011,
  there's no existing mechanism being bypassed here — the capability to
  track this kind of change was never built for this entity relationship
  at all, which is why it's tracked as a backlog gap rather than a bug.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Patient flag/unflag always writes a timeline row | Read both functions in full | ✅ Confirmed, 2026-08-16 |
| 2 | All four facility moderation actions always write a timeline row | Read `applyFacilityStatusChange` and every call site | ✅ Confirmed, 2026-08-16 |
| 3 | All four transfer-decision paths always write a timeline row | Read `decideTransferSide` and its four entry points | ✅ Confirmed, 2026-08-16 |
| 4 | Administrator-created accounts get a timeline row for their activation | Created a test account live, checked `timeline` directly | ❌ Confirmed absent, 2026-08-16 — see BUG-011 |
| 5 | Specialty assign/unassign (facility, user, or referral) writes any timeline row | Read all six handlers across three modules | ❌ Confirmed absent, 2026-08-16 — no mechanism exists at all |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
