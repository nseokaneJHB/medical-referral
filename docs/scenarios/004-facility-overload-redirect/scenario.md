# 004 — Facility overload / redirect

**Role(s):** Doctor, Manager
**Area:** Referrals, Facilities, Dashboard
**Last reviewed:** 2026-08-16

## Use case

A facility starts receiving more incoming referrals than its Doctors can
reasonably work through — a specialty is in unusually high demand, or the
facility is simply smaller than the ones sending it patients. Someone at
that facility needs to notice the backlog and get new referrals routed to
a facility that can actually take them, instead of letting patients wait
behind a growing queue.

## Problem

An overloaded facility that keeps absorbing referrals it can't service in
a reasonable time is a silent failure mode — nothing looks broken from any
single referral's point of view, but the patient behind it waits longer
than they should, and nobody at the receiving facility is necessarily
even aware they're the bottleneck versus every other facility.

## Solution

Walking this scenario end to end today, from a Doctor at the overloaded
facility acting on one referral at a time: opening a `PENDING`, unassigned
referral shows a **Redirect** action
(`web/src/routes/_authenticated/referrals/$referralId.tsx`, gated by
`canRedirectReferral` in both `web/src/lib/permissions.ts` and
`api/src/lib/permission.ts:124-133`) alongside "Assign to me" — available
to a Doctor when the referral is unassigned and sent to their own
facility, or already assigned to them. Its dialog lets the Doctor adjust
the needed specialties, search for a new destination facility (excluding
the current one), and requires a reason before submitting.

On submit, `PATCH /referrals/:id/redirect`
(`api/src/modules/referrals/service.ts:484-611`) resets the referral to
`PENDING` and unassigned, points `destination_facility_id` at the new
facility, and writes a `REDIRECTED` timeline row recording the previous
and next facility plus the reason — so the new facility's Doctors see it
show up fresh in their own pending queue, and the full hop history is
auditable later. Two safeguards are enforced server-side: the destination
must currently be an `APPROVED` facility, and it can't be a facility this
referral has already passed through (its origin, current destination, or
any earlier redirect hop) — preventing a referral from being bounced back
and forth between the same two facilities.

That's as far as the *mechanism* goes, and it only covers the very last
step — a Doctor manually deciding to move one referral they're already
looking at. Nothing upstream of that helps anyone notice the overload in
the first place: no facility-level count of pending referrals is
surfaced anywhere as its own metric (a Manager's dashboard shows a raw
per-status breakdown for their facility, but no threshold, no comparison
to other facilities, no age weighting), there's no "closed for intake"
signal a Manager could raise, and Redirect itself is Doctor-only and
strictly one referral at a time — a Manager, who's the role most likely
to be the one who actually notices facility-wide overload, has no way to
act on it directly or to redirect more than one referral without a
Doctor opening each one individually. See [notes.md](notes.md) for where
these gaps are tracked, along with a real defect found in the one-referral
Redirect flow itself.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Doctor redirects a single unassigned, `PENDING` referral to a different, unvisited `APPROVED` facility | Signed in as `doctor@gmail.com`, redirected 3 separate seeded referrals via the UI, reason required and enforced | ✅ Confirmed live in browser, 2026-08-16 — each redirect correctly reset the referral to unassigned/`PENDING` at the new facility and wrote an accurate `REDIRECTED` timeline row (verified directly against the database each time) |
| 2 | Redirect refuses a facility the referral has already visited, or one that isn't `APPROVED` | Read `api/src/modules/referrals/service.ts:484-611`'s `visitedFacilityIds` and status checks | ✅ Confirmed by code read, 2026-08-16 — both checks return `409` before any write |
| 3 | Any dashboard/facility view surfacing referral load or capacity across facilities | Read `api/src/modules/dashboard/service.ts`, `api/src/modules/facilities/service.ts`, the Manager dashboard, and the facility schema | ❌ Confirmed absent, 2026-08-16 — no capacity field, no cross-facility comparison, no threshold/alerting anywhere; tracked in [notes.md](notes.md) |
| 4 | A Manager (not just a Doctor) can trigger or influence a redirect | Read `canRedirectReferral` (`api/src/lib/permission.ts:124-133`) and its route-level `authorize` gate | ❌ Confirmed Doctor-only, 2026-08-16 — no Manager path exists, even facility-scoped; tracked in [notes.md](notes.md) |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
