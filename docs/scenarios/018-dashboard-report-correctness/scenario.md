# 018 — Dashboard and report number correctness

**Role(s):** Doctor, Manager, Administrator
**Area:** Referrals, Dashboard
**Last reviewed:** 2026-08-16

## Use case

A Doctor checks their dashboard to see what's on their plate today. A
Manager compares their facility's numbers against what an Administrator
sees system-wide, or glances at the dashboard right after handling a
referral to confirm it moved off the pending pile. In every case, the
person is trusting a number on screen to make a real decision without
re-deriving it by hand.

## Problem

Dashboard and report numbers are only useful if they mean what they
appear to mean: current, complete, and consistent with the more detailed
screens they're summarizing. A silently undercounted or silently stale
number is worse than an obviously broken one, because nothing prompts
the person relying on it to double-check.

## Solution

Facility scoping itself is solid across every role — Nurse, Doctor,
Manager, and Administrator each get an aggregate query scoped exactly to
what their permission model already allows them to see elsewhere, with no
query anywhere reading a facility/user id from client input. Referral
counts don't get inflated by redirects either: a referral is one mutable
row for its whole life, so no aggregate double-counts it from row
duplication, and status is always grouped by current value, not
transition history, so a referral can't double-count across the statuses
it passed through on its way to where it is now.

One real, live-confirmed gap was found: a Doctor's own dashboard
("Pending Referrals" stat, status chart) and the shared referrals report
both scope to only referrals directly assigned to that Doctor — leaving
out the unassigned referrals sitting at their own facility that `GET
/referrals` (and the underlying view permission) already correctly treat
as part of the same Doctor's actionable queue. Full reproduction and root
cause in BUG-010: A Doctor's dashboard and report undercount their own
actionable queue (fixed).

Two further findings, reasoned from code rather than reproduced live this
pass, in [Dashboard/report numbers can silently go stale after a
mutation, and aren't simply additive across
facilities](../../backlog.md#dashboardreport-numbers-can-silently-go-stale-after-a-mutation-and-arent-simply-additive-across-facilities):
no mutation invalidates the frontend's cached dashboard/report data, so a
5-minute-old count can sit on screen after an action that should have
changed it; and a referral crossing facilities is legitimately counted on
both the origin and destination Manager's dashboards, so summed
per-facility totals don't simply add up to the Administrator's
system-wide total — each number is correct for its own scope, but they
aren't directly comparable the way someone might assume.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Every aggregate query scopes correctly to the caller's facility/own referrals | Read every `where` clause in `dashboard/service.ts` and `reports/service.ts` | ✅ Confirmed, 2026-08-16 — no cross-tenant leak found |
| 2 | A redirected referral is never double-counted from row duplication | Traced `referralRedirect` and `countRecords`'s `GROUP BY` behavior | ✅ Confirmed, 2026-08-16 — one mutable row per referral, always |
| 3 | A Doctor's dashboard/report numbers match their actual actionable queue | Compared `GET /referrals` against `GET /dashboard/doctor/summary` and `GET /reports/referrals` for the same Doctor | ❌ Confirmed undercounted, 2026-08-16 — live-verified via API, see BUG-010 |
| 4 | Dashboard numbers refresh immediately after a referral mutation | Grepped every mutation handler for dashboard/report query-key invalidation | ❌ Confirmed absent, 2026-08-16 — code-traced, not live-reproduced this pass |
| 5 | Per-facility Manager totals sum to the Administrator's system-wide total | Traced the Manager and Administrator aggregate queries' scoping logic | ❌ Confirmed not directly additive, 2026-08-16 — expected given the permission model, but worth knowing before comparing the two |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
