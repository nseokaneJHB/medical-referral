# 032 — Non-English names and accent-insensitive search

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Patients, Users, Facilities, Specialties
**Last reviewed:** 2026-08-16

## Use case

A nurse registers a patient named "José Müller-García," or a Manager's
staff roster includes a Doctor named "Ó Briain." Later, anyone searching
for that person — by typing the name with or without its accents, since
not every keyboard/habit reliably produces "é" or "ü" — needs to actually
find them, and the name needs to display back exactly as it was entered,
not mangled or silently truncated.

## Problem

A referral-tracking system serving a real population can't assume every
patient or staff name is plain ASCII. If name fields reject or corrupt
non-Latin characters, or if search only matches an exact accent-for-accent
string, staff either can't register real people accurately or can't find
them again later — a search for "cafe" that fails to find a stored "Café"
looks, from the searcher's side, like the record doesn't exist at all.

## Solution

Name validation is Unicode-aware by design: the shared `nameSchema`
(`shared/src/schema/field.ts`) uses `/^[\p{L}\p{M}\s.'-]+$/u` — Unicode
letter and mark categories, not an ASCII range — so accented Latin
characters, non-Latin scripts, apostrophes ("O'Brien"), and hyphenated
names all validate correctly. `Patient.first_name`/`last_name`
(`shared/src/schema/patient.ts`) carry no regex at all, so patient names
are entirely unrestricted.

Search across the app (`api/src/core/helpers.ts`'s `contains`/
`mode: "insensitive"` clauses) runs as `LOWER(column) LIKE
LOWER(pattern)` against MySQL 8.4's default connection collation
(`utf8mb4_0900_ai_ci` — accent-and-case-insensitive), with no collation
override anywhere in the schema or `compose.yml`. Confirmed live:
registered a patient named "José Müller-García," then searched the
patients list for "jose" (no accent) and separately for "muller" (no
umlaut) — both found the record, and the name displayed back with its
original diacritics intact on the list page.

There's no i18n/localization framework anywhere in the app (no
`i18next`/`react-intl`/`Accept-Language` handling) — every UI string is
hard-coded English. That's an accepted, out-of-scope gap for this pass
(full UI translation is a different, much larger feature), not a defect;
this scenario is scoped to whether *data* — names people actually
type in — survives the round trip correctly, which it does.

While registering the test patient for this scenario, patient creation
itself surfaced an unrelated defect — a 500 response on every patient
creation despite the write succeeding (`patientCreate` in
`api/src/modules/patients/service.ts` omitted `flagged`/`flag_reason`
from its response, which Fastify's Zod response validation then
rejected). Not specific to accented input — reproduced identically with a
plain-ASCII name too, just discovered along the way. **Fixed 2026-08-16**
— the response now merges in `UNFLAGGED_STATUS`, confirmed live via a
clean "Created" toast on patient submission.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | An accented/multi-part name ("José Müller-García") is accepted by patient registration | Submitted live via `/patients/new` | ✅ Confirmed live, 2026-08-16 — validated and stored (patient creation itself hit an unrelated response-serialization defect along the way, since fixed — see Solution above) |
| 2 | Searching without accents ("jose") finds a name stored with accents ("José") | Searched the patients list live | ✅ Confirmed live, 2026-08-16 |
| 3 | Searching without an umlaut ("muller") finds a name stored with one ("Müller") | Searched the patients list live | ✅ Confirmed live, 2026-08-16 |
| 4 | The stored name displays back with its original diacritics, undamaged | Read the patients list row for the test patient | ✅ Confirmed live, 2026-08-16 |

See [notes.md](notes.md) for related links and enrichment ideas.
