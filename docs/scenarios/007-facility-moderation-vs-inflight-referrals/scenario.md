# 007 — Facility moderation vs. in-flight referrals

**Role(s):** Administrator, Nurse, Doctor
**Area:** Facilities, Referrals
**Last reviewed:** 2026-08-16

## Use case

An Administrator suspends a facility — a fraud investigation, a
compliance violation, whatever the reason — and expects that to actually
mean something: new referrals shouldn't route there, and anyone still
routing patients toward it should be stopped. Separately, a lighter
"flagged" facility should still be able to wind down its existing cases
without taking on new ones.

## Problem

A moderation action that doesn't actually restrict anything is worse than
no moderation action at all, because it creates false confidence — an
Administrator who suspends a facility reasonably assumes patients have
stopped being routed there. If referrals keep flowing normally underneath
that assumption, the investigation or compliance response the suspension
was meant to support is undermined without anyone realizing it.

## Solution

This app's own code is candid about where it stands: the comment above
`FACILITY_STATUS` in `shared/src/constant.ts` states directly that
"Enforcement of what either [FLAGGED or SUSPENDED] actually restricts on
Patients/Referrals is out of scope this pass — only the status
transitions + recorded reason exist for now." Walking the scenario
confirms exactly what that leaves in place today:

- **`SUSPENDED` produces a real effect, but not a referral-aware one.**
  `UNUSABLE_FACILITY_STATUSES` (`api/src/lib/permission.ts`) and the
  `authorize` middleware together lock out *every* role-gated request
  from a user whose own employer facility is suspended — a blanket
  account freeze, not a check on which facility a given referral actually
  touches. A Doctor at an unaffected facility can freely create or
  redirect referrals into a facility that was suspended minutes earlier.
- **`FLAGGED` triggers none of that** — it's absent from
  `UNUSABLE_FACILITY_STATUSES` entirely, so the "lighter, exit-only
  carve-out" described in the same code comment doesn't actually carve
  anything out yet.
- **Referral creation never looks at facility status at all.** The only
  thing keeping a Nurse from picking a suspended facility as a destination
  through the web UI is the destination picker's own default filter
  (APPROVED-only) — a client-side convenience, not something
  `referralCreate` itself enforces. `referralRedirect` is the one place
  that does check (`destination.status !== APPROVED`), and only for the
  new destination on that one action.
- **Nothing runs when a facility's status changes.** Flagging or
  suspending a facility only updates that facility's own row and writes
  one audit entry — every referral already connected to it, at any
  status, is completely unaffected.
- **The referral screen can't show this even if it wanted to** — the
  facility status field never makes it into the referral API response, so
  there's no way to notice from a referral's own page that one side of it
  is under a moderation hold.

See [notes.md](notes.md) for the full backlog write-up. This is
explicitly a known, already-documented limitation (per the code comment
above), not a newly-discovered defect — this scenario's contribution is
pinning down precisely what it does and doesn't cover.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | `SUSPENDED` blocks new referrals *into* a suspended destination specifically | Read `referralCreate`, `authorize` middleware, `UNUSABLE_FACILITY_STATUSES` | ❌ Confirmed absent, 2026-08-16 — only a same-facility account lockout exists, not a destination-aware check |
| 2 | `FLAGGED` restricts anything at all | Read `UNUSABLE_FACILITY_STATUSES` and every other reference to `FLAGGED` outside display/moderation code | ❌ Confirmed absent, 2026-08-16 — zero enforcement |
| 3 | Existing in-flight referrals get flagged/paused/cancelled when their facility is suspended | Read `ModerationManager.applyFacilityStatusChange` | ❌ Confirmed absent, 2026-08-16 — only updates the facility row and writes one timeline entry |
| 4 | Referral screen shows either facility's current moderation status | Read `REFERRAL_INCLUDE` and the referral detail/list pages | ❌ Confirmed absent, 2026-08-16 — facility `status` isn't even in the API response |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
