# 023 — Patient data retention, correction, and deletion requests

**Role(s):** Nurse, Doctor, Manager
**Area:** Patients, Audit
**Last reviewed:** 2026-08-16

## Use case

A patient (or their legal representative) asks a facility to remove
their data. Separately, a facility discovers a patient record was
created for entirely the wrong person and wants it gone, or a Nurse
notices a typo in a patient's date of birth and needs to fix it. And
independently of either: once a patient's care wraps up and nothing else
happens with their record, does it just sit there forever?

## Problem

A record that can be corrected but never removed, and that never expires
or gets archived, needs a real answer to "what happens at the end of
this patient's relationship with the system" — either an intentional
one, or an honest acknowledgment that the question hasn't been designed
for yet. A healthcare-adjacent system in particular will eventually face
a genuine deletion or correction request; not having a considered answer
isn't neutral, it's a gap that surfaces at the worst possible time (an
actual request, or an audit).

## Solution

Correcting a patient's own data works today: a Nurse with access can
`PATCH` any of a patient's demographic fields (name, date of birth,
gender, phone, address) except `facility_id`, which is correctly
blocked. This is a straightforward, working capability. What surrounds
it is thinner than it looks:

- **The correction itself is unaudited.** See BUG-012 (fixed) —
  live-verified: a demographic edit writes zero `timeline` rows, even
  though the same patient's advisory `flagged`/`unflagged` marker
  correctly logs every change with who and why.
- **There is no archive, discharge, or deactivate concept for a patient
  record at all** — not a missing route, a missing *concept*: the
  `patients` table has no status column of any kind, unlike User,
  Facility, and Referral, which all have real status enums. A patient
  record is either fully present or cannot be removed or hidden,
  period.
- **A patient's record sits in its owning facility's list permanently**,
  with no time- or activity-based filter — there's no notion of "this
  patient hasn't had any activity in two years, maybe archive them."
- **No erasure, retention, or data-export concept exists anywhere in
  the codebase or docs** — a genuine zero-hit search, not even as an
  aspirational note. The system's only stance on removing patient data
  is the opposite of what an erasure request needs: hard delete was
  deliberately removed, specifically because it would orphan referral
  history — with no compensating design for how a legitimate request
  would actually get handled instead.

Full detail, including a documentation correction made during this
investigation (`docs/database.md` previously implied Patient had the
same status-lifecycle pattern as User/Facility/Referral — it doesn't),
is in [No patient data retention, archival, or deletion-request handling
of any
kind](../../backlog.md#no-patient-data-retention-archival-or-deletion-request-handling-of-any-kind).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A Nurse can correct a patient's own wrong demographic data | Live-tested a `date_of_birth` edit via `PATCH /patients/:id` | ✅ Confirmed working, 2026-08-16 |
| 2 | That correction is recorded in the audit trail | Checked `timeline` directly after the edit above | ❌ Confirmed absent, 2026-08-16 — see BUG-012 |
| 3 | A patient record can be archived, discharged, or otherwise deactivated | Read the full `patients` schema for any status column | ❌ Confirmed absent, 2026-08-16 — no such concept exists |
| 4 | Old, inactive patient records are excluded from a facility's default list | Read every filter in the `patients()` list query | ❌ Confirmed absent, 2026-08-16 — no time/activity filter of any kind |
| 5 | Any erasure/GDPR/retention/export concept exists anywhere | Repo-wide search across `api/src`, `web/src`, and `docs/*.md` | ❌ Confirmed absent, 2026-08-16 — genuine zero-hit |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
