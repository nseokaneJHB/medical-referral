# 016 — Specialty lifecycle: rename, delete, and reference integrity

**Role(s):** Administrator
**Area:** Specialties
**Last reviewed:** 2026-08-16

## Use case

An Administrator manages the shared specialty list (Cardiology,
Pediatrics, etc.) that facilities, doctors, and referrals all tag
themselves against. Over time that list needs upkeep — a typo gets fixed,
a duplicate gets cleaned up, a specialty is retired — without corrupting
every facility/doctor/referral that already points at it.

## Problem

Reference data that's linked from many places is only as safe as its
deletion/rename path. Renaming has to actually reach every consumer (not
leave a stale denormalized copy somewhere), and deleting something still
in use has to fail safely rather than leave dangling references that
crash whatever reads them next.

## Solution

This is mostly solid, with two small latent gaps worth closing.

**Rename works correctly everywhere.** `specialtyUpdate`
(`api/src/modules/specialties/service.ts:119-157`) is a plain in-place
update on the specialty's own row; every consumer — facility, doctor, and
referral specialty links alike — resolves the specialty's current name
live via `specialty_id` at read time (`buildRelations`,
`api/src/core/helpers.ts:521-741`), never from a copied/denormalized
name. There is no stale-name risk anywhere in the app, including in the
audit timeline, which doesn't log specialty names at all.

**Deletion is deliberately not exposed, and the reasoning is documented in
the code itself.** There is no delete route
(`api/src/modules/specialties/route.ts:24-30` — "a hard delete here would
orphan existing facility/user links"), no delete API client function, and
no delete button in the admin UI. The database backs this up
independently: every foreign key pointing at `specialties.id` is
`ON DELETE NO ACTION`, so even a direct SQL delete attempt against a
referenced specialty would be rejected by MySQL, which the app already
translates into a friendly 409 rather than a raw DB error.

Two gaps found underneath that otherwise-solid design, full detail in
[Specialty lifecycle has two small latent gaps: an orphan-link crash trap
and case-insensitive duplicate
names](../../backlog.md#specialty-lifecycle-has-two-small-latent-gaps-an-orphan-link-crash-trap-and-case-insensitive-duplicate-names):

- A dead, unused `core.specialty.delete` method exists with no reference
  check of its own, and the code that resolves specialty links already
  knows how to handle "the specialty row is gone" (it sets the relation
  to `null`) — but the API response contract declares that relation
  non-nullable, so if this combination were ever reached (a future admin
  tool, a raw cleanup script), the result would be an unhandled 500, not
  the friendly, already-established 409 pattern used for every other
  reference-integrity violation in this app.
- Specialty name uniqueness is checked by exact string match only —
  "Cardiology" and "cardiology" aren't recognized as duplicates by the
  application, and whether the database's `UNIQUE(name)` constraint
  catches it depends on a collation setting the codebase never
  explicitly configures.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Renaming a specialty updates its display everywhere it's referenced | Read `specialtyUpdate` and every consumer's read path | ✅ Confirmed, 2026-08-16 — resolved live via `specialty_id`, no denormalization anywhere |
| 2 | A specialty still in use can be deleted through the live app | Read the specialty route file and admin UI | ✅ Confirmed blocked, 2026-08-16 — no delete route/button exists at all |
| 3 | A direct DB-level delete of a referenced specialty is rejected | Read the FK definitions and migration | ✅ Confirmed blocked, 2026-08-16 — `ON DELETE NO ACTION` on all three link tables |
| 4 | An orphaned `specialty_id` (if ever created) degrades gracefully rather than crashing | Traced `buildRelations`'s null-relation handling against the Zod response schema | ❌ Confirmed it would crash, 2026-08-16 — non-nullable schema vs. nullable join result, unhandled 500 |
| 5 | Creating "Cardiology" and "cardiology" as separate specialties is blocked | Read `specialtyCreate`'s duplicate check | ❌ Confirmed not blocked at the app level, 2026-08-16 — exact string match only |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
