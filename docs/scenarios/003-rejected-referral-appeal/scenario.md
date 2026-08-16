# 003 — Rejected referral appeal

**Role(s):** Nurse, Doctor
**Area:** Referrals
**Last reviewed:** 2026-08-16

## Use case

A Nurse refers a patient to another facility. The receiving side reviews
it and decides not to take the case — wrong specialty, insufficient
information, whatever the reason. The Nurse needs to understand why, and
either contest that decision or move her patient's care forward some
other way without losing the work already put into the referral.

## Problem

A rejection is a dead end for care coordination unless there's a clear
next step. Without a way to contest a rejection or efficiently resubmit,
a Nurse has to notice the rejection, figure out why on her own, and
manually redo the entire referral from scratch for the same patient —
each of those steps is a place the patient's care can quietly stall.

## Solution

Walking this scenario as far as it currently goes: a referral cannot
actually be moved to `REJECTED` through the app today — no role, at any
point in a referral's lifecycle, can trigger that transition via
`PATCH /referrals/:id/status` (`api/src/modules/referrals/service.ts`).
See [notes.md](notes.md) for where that's tracked.

Looking at an already-rejected referral (the status exists and is fully
supported for display, even though nothing in the live app can currently
produce it) shows what the intended end state looks like:
`web/src/routes/_authenticated/referrals/$referralId.tsx` renders the
referral fully read-only once its status is `REJECTED` — the destination
facility, priority, and assigned-doctor fields lose their editable
`Save changes` form entirely, the specialty tags lose their add/remove
controls, and the "Update status" section (which every other non-terminal
status shows) doesn't render at all, since it's conditioned on
`availableTransitions.length > 0` and a terminal status always computes
an empty list. The "Timeline" section does correctly show the full
status-change history with timestamps and whoever made each change.

There is no appeal action anywhere in this flow, and `Create referral`
(`web/src/routes/_authenticated/referrals/new.tsx`) starts from a
completely blank form — nothing carries over from a prior referral, so a
Nurse who wants to try again has to re-enter the patient, destination
facility, reasons, priority, and specialties by hand.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Any role attempts to reject a referral via the real status-update flow | Sign in as the assigned Doctor, move an owned referral through Accepted → In Progress, then attempt → Rejected | ✅ Confirmed live via API, 2026-08-16 — every attempt is refused; see [notes.md](notes.md) for the tracked cause |
| 2 | An already-rejected referral's detail page | View a seeded `REJECTED` referral as its assigned Doctor | ✅ Confirmed live in browser, 2026-08-16 — fully read-only, accurate Timeline, no appeal or edit action anywhere |
