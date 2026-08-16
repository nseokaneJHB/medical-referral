# 028 — Sort-parameter safety across list endpoints

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Patients, Referrals, Facilities, Users, Specialties

**Last reviewed:** 2026-08-16

## Use case

A Nurse clicks a column header to sort a list by name, date, or status.
The value that click sends to the server (`?sort=created_at`) is
client-controlled input flowing into a database query — the same shape
of risk that made [027 — Search boxes and literal wildcard
characters](../027-search-wildcard-correctness/scenario.md)'s finding
possible, just on the ordering side of the query instead of the
filtering side.

## Problem

Any place client input picks which database column to act on is worth
checking specifically for whether that input is validated against a real
allowlist before reaching the query builder, or whether it could
influence the generated SQL more directly than intended.

## Solution

This one comes back clean — a genuinely reassuring result, not a
manufactured finding. `parseSortList`
(`api/src/lib/validator.ts:15-35`) checks every requested sort field
against `Object.keys(model)`, where `model` is the actual Drizzle table
object — the allowlist *is* the schema, not a separate hand-maintained
list that could drift out of sync. An unknown field is rejected with a
clean `400`, not silently accepted or passed through. `buildOrder`
(`api/src/core/helpers.ts:389-417`) then resolves each validated field
name to a real Drizzle column object before calling `asc()`/`desc()` on
it — a repo-wide search for raw SQL string concatenation into `ORDER BY`
anywhere in `api/src` came back empty. Sort direction is enum-validated
at the HTTP schema layer before the handler even runs. There is no
SQL-injection risk here, and unlike [027](../027-search-wildcard-correctness/scenario.md)'s
`contains`/`LIKE` finding, no correctness gap either — sorting by a
validated field does exactly what it says.

Two minor, currently-unreachable rough edges turned up in the same pass,
neither rising to the level of a bug: `buildOrder`'s own internal
validation throw doesn't set an HTTP status code (so it would 500 rather
than 400 if it were ever reached directly, which none of today's call
paths do), and independent per-field sort direction
(`?sort=a,b&order=asc,desc`) has code written as if it's supported but
is actually blocked by the route schema, which only accepts a single
shared direction. Full detail in [Two minor code-quality gaps in
sort-parameter handling (both currently
unreachable)](../../backlog.md#two-minor-code-quality-gaps-in-sort-parameter-handling-both-currently-unreachable).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Sort field names are validated against real columns before reaching the query builder | Read `parseSortList` against the Drizzle table objects it checks against | ✅ Confirmed, 2026-08-16 |
| 2 | No raw string interpolation into `ORDER BY` exists anywhere | Read `buildOrder` and grepped for raw-SQL patterns across `api/src` | ✅ Confirmed clean, 2026-08-16 |
| 3 | An invalid sort field returns a clean error, not a 500 or unexpected query | Traced `parseSortList`'s throw through the error-handling middleware | ✅ Confirmed, 2026-08-16 — clean `400` |
| 4 | Sort direction is validated against a real enum, not an arbitrary string | Read `orderDirectionSchema` and its use at the route layer | ✅ Confirmed, 2026-08-16 |
| 5 | Independent sort direction per field in a multi-field sort actually works | Traced `parseEnumList`/the per-field fallback logic against the route's `order` schema | ❌ Confirmed dead code, 2026-08-16 — schema only accepts one shared direction |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
