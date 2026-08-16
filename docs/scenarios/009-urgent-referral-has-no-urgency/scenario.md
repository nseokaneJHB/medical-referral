# 009 — An Urgent referral has no actual urgency

**Role(s):** Nurse, Doctor, Manager
**Area:** Referrals, Dashboard
**Last reviewed:** 2026-08-16

## Use case

A Nurse refers a patient who needs care fast and marks the referral
`Urgent` rather than `Medium` or `Low`. That label is the Nurse's way of
telling everyone downstream — the receiving facility's Doctors, their own
Manager, anyone triaging incoming work — that this one shouldn't wait in
the ordinary queue.

## Problem

A priority field only does its job if it changes something for someone.
If marking a referral Urgent looks identical, from every other user's
side, to leaving it Medium — same position in every list by default, same
dashboard treatment, no alert to anyone — then the Nurse's signal never
actually reaches the person who needs to act on it faster.

## Solution

Priority is real data — stored, filterable, and clearly color-coded (a
red badge for Urgent, distinct from the other three levels) — but walking
the scenario end to end confirms it has no functional effect anywhere in
the system today:

- **No server-side logic reads it** for anything except list filtering
  and a plain count on the reports page. Assignment, auto-accept,
  redirect, and every status-transition rule key off status, role, and
  facility/ownership only.
- **Referral lists don't default-sort by priority.** An Urgent referral
  only surfaces first if someone manually clicks the Priority column
  header — otherwise every list is ordered by creation date like any
  other referral.
- **No dashboard gives Urgent referrals distinct visual treatment** beyond
  appearing in the same generic priority breakdown chart every other
  level appears in.
- **There is no notification system in this app at all** — no email, no
  in-app alert, no push — so even a hypothetical priority-driven
  escalation rule would have no way to actually reach anyone.
- **Only the original referring Nurse can change priority later**, and
  only before the referral reaches a terminal status — a receiving
  Doctor who realizes a case is more urgent than initially marked has no
  way to raise that themselves.

See [notes.md](notes.md) for the backlog write-up, which separates this
into two independent items: making priority functionally meaningful, and
the much larger question of whether a notification system belongs in
this app at all.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Any server-side business logic (assignment, transitions, escalation) reads priority | Read `referralAssign`/`referralUpdate`/`referralRedirect`/`referralStatusUpdate` (`api/src/modules/referrals/service.ts`) | ❌ Confirmed absent, 2026-08-16 — priority used only for list filtering and report counts |
| 2 | Referral lists default-sort by priority | Read `parseSortList`'s default (`api/src/modules/referrals/service.ts:199`) | ❌ Confirmed absent, 2026-08-16 — defaults to `created_at`, priority sort is manual-only |
| 3 | Any dashboard gives Urgent referrals distinct callout treatment | Read every role's dashboard (`web/src/routes/_authenticated/index.tsx`) | ❌ Confirmed absent, 2026-08-16 — same generic breakdown chart as every priority level |
| 4 | Any notification system exists anywhere in the app | Repo-wide grep for "notif" across api/src, web/src, shared/src | ❌ Confirmed absent, 2026-08-16 — zero matches |
| 5 | A Doctor (not just the original Nurse) can re-triage priority | Read `canEditReferralFull` and the `PATCH /referrals/:id` route's role authorization | ❌ Confirmed absent, 2026-08-16 — Doctor has no write access to this field at all |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
