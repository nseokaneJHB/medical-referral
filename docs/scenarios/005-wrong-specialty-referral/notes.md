# 005 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This scenario is a code-absence finding across three
different flows (creation, assignment, redirect) rather than one
interactive sequence worth showing — the one live check performed
(self-assigning across a specialty mismatch) produces no visible
difference from a normal self-assign, so a recording of it wouldn't
communicate anything a screenshot or plain description doesn't already.

## Related

- Backlog: [No specialty-match validation at referral creation,
  assignment, or
  redirect](../../backlog.md#no-specialty-match-validation-at-referral-creation-assignment-or-redirect) —
  full writeup of the three gaps and the one narrow fix (wiring
  `specialty` through `useFacilitySearch`) that would help two of them at
  once.
- Related scenario: [004 — Facility overload /
  redirect](../004-facility-overload-redirect/scenario.md) — shares the
  Redirect flow and its facility picker; that scenario's backlog finding
  (no facility load/capacity visibility) and this one's (no specialty
  filtering) are two independent gaps in the same picker, worth fixing
  together if `useFacilitySearch` ever gets revisited.

## Enrichment ideas

- A variant from the Manager's point of view: does a Manager assigning a
  Doctor to a referral get any signal at all (even just a visual one) that
  the Doctor they're picking lacks the needed specialty? Not yet checked
  — the research so far confirmed the *check* doesn't exist, but didn't
  specifically confirm whether the doctor-picker dropdown displays each
  Doctor's specialties at all (which would at least make the mismatch
  visible even without blocking it).
- Once `useFacilitySearch` supports a `specialty` filter (if the backlog
  item gets picked up), re-walk this scenario to confirm creation and
  redirect both correctly narrow their facility choices, and decide
  whether that filtering hard-blocks or just deprioritizes/reorders
  non-matching facilities.
- A "facility has the specialty on file, but literally zero Doctors with
  it on staff" variant — even a facility/specialty match at the
  referral level doesn't guarantee an actual doctor is available to see
  it; worth checking whether that's visible anywhere before this
  scenario's fix gets scoped.
