# 024 — Editing a facility's profile, and the missing user profile page

**Role(s):** Manager, Administrator, Nurse, Doctor
**Area:** Facilities, Users, Audit
**Last reviewed:** 2026-08-16

## Use case

A facility moves buildings or gets its name corrected, and its Manager
updates the record. Separately, any staff member expects to be able to
go somewhere and fix their own name if it's misspelled, the way almost
every system with a login lets you edit your own profile.

## Problem

This continues directly from [020 — Audit trail
completeness](../020-audit-trail-completeness/scenario.md), which found
the same shape of gap twice (BUG-011, BUG-012) and flagged facility/user
update paths as worth checking next. It also continues from [017 —
Password recovery and reset
security](../017-password-recovery/scenario.md)'s finding that no
self-service password change exists — this scenario found the sibling
gap on the *name* side of a user's own profile.

## Solution

**Facility data editing is a real, working capability with the same
audit gap as before.** A Manager (their own facility) or Administrator
can `PATCH` a facility's `name`/`address` — this works correctly — but
see BUG-013: Editing a facility's name or address leaves no audit
trail (fixed), live-verified: the edit produces zero `timeline` rows, while every
status change on that same facility (approve/reject/flag/suspend)
correctly writes one. This is the fourth confirmed instance of the exact
same pattern — an existing, working audit mechanism on an entity, with
one specific mutation path that doesn't use it (BUG-008 referrals,
BUG-011 user creation, BUG-012 patient data, now BUG-013 facility data).

**User profile editing doesn't exist at all — and a prior planning doc
overstated that it did.** There is no `PATCH /users/:id` route, no
handler for it anywhere in `api/src/modules/users/`. A user cannot edit
their own name or any other profile field through any path today.
`docs/roles-permissions.md` had confirmed this as a *design decision*
during an earlier planning session ("Own profile — CONFIRMED"), and the
backlog's own prior note mistakenly treated that design confirmation as
if the feature had shipped ("Superseded — resolved"). Corrected in
place: see [User profile
pages](../../backlog.md#user-profile-pages) — the design intent
(name-only self-service, never role/facility/status) still stands as
the plan, it just was never built.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A Manager/Administrator can edit a facility's name/address | Live-tested an `address` edit via `PATCH /facilities/:id` | ✅ Confirmed working, 2026-08-16 |
| 2 | That edit is recorded in the audit trail | Checked `timeline` directly after the edit above | ❌ Confirmed absent, 2026-08-16 — see BUG-013 |
| 3 | A user can edit their own name/profile fields | Read every route in `api/src/modules/users/route.ts` | ❌ Confirmed absent, 2026-08-16 — no such route exists at all |
| 4 | The backlog/planning docs accurately reflect that this was never built | Read `docs/roles-permissions.md`'s "Already shipped" section against the "User profile pages" backlog entry | ❌ Confirmed stale, 2026-08-16 — backlog entry corrected in place |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
