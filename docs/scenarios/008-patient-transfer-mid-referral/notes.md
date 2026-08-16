# 008 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. Verified by code read rather than a live walkthrough —
fully exercising this scenario live would mean creating a referral,
requesting a transfer, approving it twice as two different Managers
(origin then destination), and confirming the visibility change, all on
real seeded data. That's a heavier, harder-to-cleanly-reverse mutation
(a genuine `patient.facility_id` change, not just a referral field) than
this finding needed to justify it — the code itself is unambiguous about
the absence of any referral-aware check. Worth a full live walkthrough
once this gets picked up for real and a fix direction is chosen.

## Related

- Backlog: [Patient transfer doesn't account for in-flight referrals, and
  referral access doesn't follow the
  patient](../../backlog.md#patient-transfer-doesnt-account-for-in-flight-referrals-and-referral-access-doesnt-follow-the-patient) —
  full write-up and open questions.
- Related scenario: [002 — Referral falls through the
  cracks](../002-referral-falls-through-the-cracks/scenario.md) — a
  different mechanism producing the same underlying failure mode (a
  referral that's technically fine in the database but invisible to
  whoever should be acting on it next).

## Enrichment ideas

- A full live walkthrough once this is picked up: create a referral for a
  patient, request and fully approve a transfer for that patient to a
  different facility, then sign in as staff at the new facility and
  confirm the referral is genuinely invisible to them — turning this
  code-read finding into a directly observed one.
- Check whether the *destination* facility of an open referral matches
  the *transfer destination* in any interesting way — e.g. a patient
  being transferred to the exact facility their referral was already
  headed to. Does that overlap make the gap better or worse (does the
  referral become visible for an unrelated reason, and would that create
  a false sense that the general problem is handled)?
- Worth checking whether `Patients` list/detail pages show any signal at
  all that a patient has a pending or recently-completed transfer, for
  context on how discoverable this whole feature is day to day (separate
  from the referral-visibility gap this entry focuses on).
