# 027 — Search boxes and literal wildcard characters

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Patients, Referrals, Facilities, Users, Specialties

**Last reviewed:** 2026-08-16

## Use case

A Nurse types a search term into any list's search box — a patient's
partial phone number, a word from a referral's reason, a facility name.
They expect the results to match what they actually typed, not a
reinterpretation of it.

## Problem

A search feature that silently returns more (or fewer) results than the
literal text a person typed is worse than an obviously broken one — it
looks like it's working, and the person trusting the result list has no
reason to suspect it's incomplete or over-broad.

## Solution

Every text-search field in the app shares one implementation, and that
implementation has a real correctness gap: `LIKE` treats `%` and `_` as
wildcard characters, and the search term a user types is embedded into
the SQL pattern without escaping either one first. Live-verified: a
patient search for the single character `%` returns every patient in the
facility — identical to leaving the search box empty — while a genuinely
non-matching string correctly returns nothing, confirming the wildcard
characters specifically (not the search feature generally) are
mishandled. This is not a SQL-injection risk (the value is still
parameterized, never concatenated into raw SQL) — it's purely a
precision problem: a `%` or `_` a user meant literally gets treated as
"anything." Since patient name/phone, referral reason, facility
name/address, user name/email, and specialty name all search through the
same shared helper, the gap is systemic rather than confined to one
screen. Full detail in BUG-014: Search boxes treat literal `%`/`_` in a
search term as SQL wildcards, not text (fixed).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Searching for a literal `%` returns only rows that actually contain one | Live-tested `GET /patients?search=%` against the unfiltered total | ❌ Confirmed broken, 2026-08-16 — returned all 22 patients, identical to no filter |
| 2 | A genuinely non-matching search string returns zero results | Live-tested `GET /patients?search=zzzznonexistent` | ✅ Confirmed correct, 2026-08-16 — isolates the bug to wildcard characters specifically |
| 3 | Every search-enabled list endpoint shares the same gap | Traced `contains` usage in patients, referrals, facilities, users, and specialties services | ❌ Confirmed systemic, 2026-08-16 — all five share one unescaped helper |
| 4 | The search term is protected against SQL injection regardless of this gap | Re-confirmed the `contains` operator's parameterization | ✅ Confirmed safe, 2026-08-16 — a correctness bug, not a security one |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
