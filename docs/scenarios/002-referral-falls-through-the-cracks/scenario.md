# 002 — Referral falls through the cracks

**Role(s):** Nurse, Doctor, Manager
**Area:** Referrals, Dashboard
**Last reviewed:** 2026-08-16

## Use case

A Nurse refers a patient from her facility to another for specialist care.
Time passes — a day, then several — with no confirmation the destination
facility has even looked at it. She has no way to know whether the
referral is genuinely still waiting its turn or has been silently missed
on the other end. Meanwhile, at the destination facility, a Doctor or
Manager who could pick it up has to already be looking at the right list
to notice it's there — nothing points them at it.

## Problem

A patient can fall through the cracks between two facilities who each
assume the other is handling it: the origin facility thinks the referral
is "sent," the destination facility doesn't know it's expected. Nothing in
the workflow proactively surfaces a referral that's sat untouched — it's
only ever found by someone choosing to go look for it.

## Solution

- **Nurse:** her dashboard's `pending` count
  (`nurseSummary` in `api/src/modules/dashboard/service.ts`) is a raw
  count of her own referrals sitting in `PENDING` — it doesn't distinguish
  one submitted minutes ago from one that's been sitting for a week. She
  can also open her own `/referrals` list and filter by Status to see each
  one's origin/destination facility side by side.
- **Doctor:** a Doctor's own `/referrals` list (`api/src/modules/referrals/service.ts`,
  the `referrals` handler's `ROLES.DOCTOR` branch) includes, with no
  filter needed, every referral already assigned to them *plus* every
  unassigned referral whose destination is their own facility — so simply
  opening their referral list surfaces anything sent to their facility
  that nobody has picked up yet, and they can self-assign it directly from
  there.
- **Manager:** the same list, for a Manager, includes every referral
  touching their facility in either direction — as origin or as
  destination (`ROLES.MANAGER` branch, same handler) — giving them the
  broadest single view of their facility's referral traffic, incoming and
  outgoing.

See [notes.md](notes.md) for the open gap this walkthrough surfaced (no
staleness signal exists anywhere in this flow) and how it's tracked.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Nurse's dashboard `pending` count vs. the actual age spread of her pending referrals | Compare the count to `created_at` on each pending referral | ✅ Confirmed live via API, 2026-08-16 — `pending: 10`, ages ranging from same-day to 7 days old, all counted identically |
| 2 | Doctor's own referral list surfaces an unassigned referral sent to their facility, without filtering | Sign in as the destination facility's Doctor, load `/referrals` with no filters | ✅ Confirmed live via API, 2026-08-16 — a referral pending 5 days (Fort Miracle Health Center → Leroyberg Regional Hospital, unassigned) appeared in `doctor@gmail.com`'s unfiltered list |
| 3 | Manager's referral list includes both incoming and outgoing traffic for their facility | Sign in as the facility's Manager, load `/referrals` with no filters | ✅ Confirmed live via API, 2026-08-16 — `manager@gmail.com`'s list included referrals with Leroyberg Regional Hospital as both origin and destination |
