# 006 — Accountability for dropped referrals

**Role(s):** Manager, Administrator
**Area:** Referrals, Audit, Users
**Last reviewed:** 2026-08-16

## Use case

A Manager notices a referral has been sitting untouched for far longer
than it should have. Before they can do anything productive about it,
they need to answer two questions: who was actually responsible for
moving it forward, and did anyone with the authority to reassign it or
follow up ever actually try? Without that, "it fell through the cracks"
never turns into "here's who needs to pick up the pace" or "here's why it
happened."

## Problem

Accountability requires a trail. If a referral can silently change hands,
or a Manager has no way to see which of their Doctors is actually
carrying the workload, then even a Manager who's paying close attention
has no way to act on what they notice — they can see *that* something is
stuck, but not *who* to talk to about it, or whether it was already
quietly handed off and dropped again.

## Solution

Walking this scenario end to end surfaces both a real defect and a
broader gap in what the app can currently show:

- **Reassigning a referral's doctor** — the most direct lever a Manager
  has when a Doctor is sitting on a case — works correctly as a database
  update, but doesn't produce any audit trail once the referral is past
  `PENDING`. See BUG-008 (fixed)
  for the full write-up; it's a real defect, not an intentional scope
  limit, since the permission model explicitly allows this reassignment
  at any non-terminal status.
- **Workload visibility stops at the facility level.** The Manager
  dashboard's referral counts (`managerSummary`,
  `api/src/modules/dashboard/service.ts`) are grouped only by status —
  there's no way to see which specific Doctor is holding how many
  referrals, or for how long.
- **The audit feed is a flat, unfilterable log.** `AuditManager
  .listForFacility` (`api/src/management/audit.ts`) is exactly the kind of
  data an accountability question needs (who changed what, when), but the
  page built on top of it (`web/src/routes/_authenticated/audit/index.tsx`)
  offers no way to filter or group by staff member — a Manager has to
  read every row themselves and tally it by hand.
- **Disabling a Doctor's account doesn't touch their assigned referrals.**
  If a Manager's actual conclusion is "this Doctor isn't responding, I
  need to lock their account and hand off their work," disabling the
  account (`ModerationManager.applyUserStatusChange`,
  `api/src/management/moderation.ts`) does exactly that and nothing more
  — any referrals still assigned to them stay exactly as they were,
  silently orphaned to a now-inaccessible account.
- **There's no deadline or SLA concept anywhere** to formally define what
  "stale" or "dropped" even means, beyond the raw age of a referral (which
  itself has no visible signal today — see the existing "Referral
  staleness has no UI signal" backlog entry from scenario 002).

See [notes.md](notes.md) for the full backlog write-up and related links.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A Manager reassigns an already-`ACCEPTED` referral's doctor — does it leave a timeline trace? | Signed in as `manager@gmail.com`, reassigned an `ACCEPTED` referral from one Doctor to another via **Save changes** | ❌ Confirmed live in browser, 2026-08-16 — `doctor` field updated correctly, zero new timeline rows; see BUG-008 (fixed) |
| 2 | Manager dashboard shows per-doctor referral workload | Read `managerSummary` (`api/src/modules/dashboard/service.ts`) | ❌ Confirmed absent, 2026-08-16 — grouped by status only, never by doctor |
| 3 | Audit feed can be filtered/sorted by staff member | Read `AuditManager.listForFacility` and the Manager audit page's search params | ❌ Confirmed absent, 2026-08-16 — flat chronological log, pagination only |
| 4 | Disabling a Doctor's account reassigns or flags their in-flight referrals | Read `ModerationManager.applyUserStatusChange` and its callers | ❌ Confirmed absent, 2026-08-16 — only updates the user's own status |
| 5 | Any deadline/SLA concept exists anywhere in the schema or constants | Repo-wide grep for sla/deadline/due-date/escalation/overdue terms | ❌ Confirmed absent, 2026-08-16 — zero matches |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
