# 012 — Referral redirect chains and cross-facility visibility

**Role(s):** Nurse, Doctor, Manager
**Area:** Referrals, Patients, Facilities
**Last reviewed:** 2026-08-16

## Use case

A patient's referral bounces through more than one facility before it
settles — Facility A refers to Facility B, B is overloaded and redirects
to Facility C. Everyone involved has a reasonable expectation about who
should still be able to see what: the facility actively holding the case
should see it, a facility that's been cut out of the chain shouldn't, and
nobody outside the chain entirely should be able to find the patient by
searching around for them.

## Problem

A referral system spanning multiple facilities has to get facility-level
data boundaries right in both directions: too loose, and a patient's
sensitive record leaks to a facility with no real connection to their
care; too strict, and the facility actually treating the patient can't see
the history it needs to treat them safely. Multi-hop chains are where this
is easiest to get wrong, because "was this facility ever involved" and
"is this facility involved right now" quietly diverge.

## Solution

Patient visibility is not global — confirmed directly: `patients()`
(`api/src/modules/patients/service.ts:173-246`) hard-filters the list/
search endpoint to the caller's own current `facility_id` with no
involvement-based OR-clause, and the get-by-ID path
(`canAccessPatientRecord`, `api/src/modules/patients/service.ts:116-134`)
returns a non-enumerating 404 unless the caller's facility either owns the
patient outright or is the origin/destination of a non-terminal referral
for them (`api/src/lib/permission.ts:161-170`). A facility with no
ownership and no referral history for a patient cannot list, search, or
open that patient's record at all — there is no "search all patients"
capability anywhere in the app, front or back end.

Within a redirect chain specifically, that same rule produces an
asymmetry that's deliberate, not accidental: redirecting
(`referralRedirect`, `api/src/modules/referrals/service.ts:484-613`)
overwrites `destination_facility_id` on the *same* referral row but never
touches `origin_facility_id`. So after A→B→C:

- **Facility A (the true origin) keeps visibility for as long as the
  referral stays non-terminal — through every subsequent redirect**,
  because `canViewReferral`'s Manager branch and `canAccessPatientRecord`
  both match on `origin_facility_id` regardless of how many hops have
  happened since. A can see the referral's current state at C, even
  though A was never operationally part of that hop.
- **Facility B (the intermediate hop) loses visibility the moment it's
  redirected away** — the referral's `destination_facility_id` no longer
  points at B and its `doctor` field is cleared, so both the Manager and
  Doctor checks in `canViewReferral` (`api/src/lib/permission.ts:92-116`)
  correctly stop matching. This is confirmed intended, not a bug — see
  `docs/roles-permissions.md:114-116`.

So the first facility in a chain is structurally privileged over every
facility in the middle of it: origin access is permanent for the life of
the referral, intermediate access is momentary. The closest analogous gap
— a facility's access persisting after its *practical* involvement ends
because nothing marks the referral terminal — is already tracked from the
Patient Transfer angle in [Patient transfer doesn't account for in-flight
referrals, and referral access doesn't follow the
patient](../../backlog.md#patient-transfer-doesnt-account-for-in-flight-referrals-and-referral-access-doesnt-follow-the-patient);
this scenario is the same underlying shape (access outlives real
involvement) reached via Redirect instead of Transfer.

Separately, this investigation caught a stale doc claim: `docs/
roles-permissions.md` said a second non-terminal referral for the same
patient is rejected with a 409. It isn't — `referralCreate`
(`api/src/modules/referrals/service.ts:90-97`) explicitly allows multiple
concurrent active referrals per patient by design, matching what
`docs/backlog.md`'s scenario-008 entry already correctly states. The doc
was corrected in place rather than filed as a bug, since it was a
documentation-only inaccuracy with no corresponding code defect.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A facility with no ownership or referral history for a patient can list/search/find them | Read `patients()`'s `where` clause and the patient-search UI | ✅ Confirmed absent, 2026-08-16 — hard `facility_id` filter, no cross-facility search exists anywhere |
| 2 | A facility with no ownership or referral history can open a patient by ID directly | Read `canAccessPatientRecord` | ✅ Confirmed blocked, 2026-08-16 — non-enumerating 404 |
| 3 | After A→B→C, Facility A (origin) still sees the referral | Read `referralRedirect` and `canViewReferral`'s Manager branch | ❌ Confirmed persistent access, 2026-08-16 — origin is never cleared or updated by redirect |
| 4 | After A→B→C, Facility B (intermediate) still sees the referral | Same code paths, Doctor and Manager branches | ✅ Confirmed correctly revoked, 2026-08-16 — matches documented intent |
| 5 | `docs/roles-permissions.md`'s "one active referral per patient, 409" claim matches actual behavior | Read `referralCreate`'s own docstring and body | ❌ Confirmed stale/incorrect, 2026-08-16 — doc corrected in place |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
