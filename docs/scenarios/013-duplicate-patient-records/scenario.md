# 013 — Duplicate patient records

**Role(s):** Nurse, Doctor, Manager
**Area:** Patients
**Last reviewed:** 2026-08-16

## Use case

A Nurse registers a new patient. In reality, that person may already have
a record — either at the Nurse's own facility (they didn't think to
search first, or searched a nickname/maiden name/typo and came up empty)
or at a different facility entirely, because the person was already
treated elsewhere before showing up here as apparently "new."

## Problem

Duplicate identity records are one of the most common real-world data
integrity failures in any system that tracks people across multiple
independent intake points. When it happens, a single person's care
history splits across two disconnected records: referrals, flags, and
timeline entries for the same real patient end up scattered across two
IDs that nothing ever links back together, and nobody treating the
"second" record has any way to know the first one exists.

## Solution

There isn't one today — this is an end-to-end gap, not a partially-built
feature. `patientCreate` (`api/src/modules/patients/service.ts:145-167`)
performs no lookup of any kind before inserting: no query by name, date of
birth, or phone against existing rows, at the creating Nurse's own
facility or anywhere else. It unconditionally generates a new UUID and
writes a new row.

Nothing backs this up at the schema level either — the `patients` table
(`api/src/drizzle/schema/patient.ts:17-47`) has a primary key on `id` and
plain, non-unique indexes for query performance only. And even a proposed
fix runs into a second problem immediately: there's no stable identifier
on the patient record to match on in the first place. The full identifying
field set is `first_name`, `last_name`, `date_of_birth`, plus optional
`gender`/`phone`/`address` — no government ID, no medical record number,
no email (`shared/src/schema/patient.ts:24-29`).

The cross-facility half of this is structurally worse than "unbuilt" —
it's currently impossible to solve without also changing the visibility
model. A Facility B Nurse has no way to see, search, or compare against a
patient already registered at Facility A unless a referral already links
the two facilities for that exact person (`canAccessPatientRecord`,
`api/src/modules/patients/service.ts:116-134` — see also
[012](../012-redirect-chain-visibility/scenario.md), which covers the
same visibility boundary from the access-persistence angle rather than
the identity-matching angle). That referral can't exist yet in this
scenario, since the whole premise is that B doesn't know A's record is
there. Full write-up, open questions, and suggested fix directions are in
[No duplicate-patient detection, same-facility or
cross-facility](../../backlog.md#no-duplicate-patient-detection-same-facility-or-cross-facility).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Creating a patient checks for an existing match first | Read `patientCreate` in full | ❌ Confirmed absent, 2026-08-16 — no lookup of any kind before insert |
| 2 | A unique constraint exists on any identifying field | Read the `patients` table schema and migration | ❌ Confirmed absent, 2026-08-16 — only a primary key on `id`, all other indexes non-unique |
| 3 | The patient schema has any stable external identifier (government ID, MRN, email) to key a match on | Read the full `CreatePatientSchema`/`PatientModel` field list | ❌ Confirmed absent, 2026-08-16 — name, DOB, gender, phone, address only |
| 4 | A facility can discover a patient already registered at a different facility, absent a linking referral | Read `canAccessPatientRecord` and the patient list/search endpoint | ❌ Confirmed impossible, 2026-08-16 — facility-scoped visibility blocks it structurally |
| 5 | Any Administrator/Manager tooling exists to merge or link duplicate records after the fact | Read `administrator/service.ts` and `manager/service.ts` in full | ❌ Confirmed absent, 2026-08-16 — no merge/link concept anywhere |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
