# 006 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. The one live-verified finding (BUG-008 — reassignment
leaving no timeline trace) has no interesting visual to show — the bug
*is* the absence of something appearing in the Timeline section, which a
static before/after comparison communicates better than video. The rest
of this scenario is code-absence findings with no UI to walk at all.

## Related

- Bug: BUG-008 — reassigning a referral's doctor past `PENDING` leaves no
  audit trail (fixed) — found and verified live during this scenario's
  investigation.
- Backlog: [No way to identify or hold accountable a staff member sitting
  on stale
  referrals](../../backlog.md#no-way-to-identify-or-hold-accountable-a-staff-member-sitting-on-stale-referrals) —
  the broader set of visibility gaps (per-doctor workload, unfilterable
  audit feed, no reassignment on account disable, no SLA concept).
- Backlog: [Referral staleness has no UI
  signal](../../backlog.md#referral-staleness-has-no-ui-signal) (from
  scenario 002) — a prerequisite to this scenario: accountability only
  becomes actionable once staleness itself is visible at all.
- Backlog: [Administrator audit page shows logins only, not actual
  actions](../../backlog.md#administrator-audit-page-shows-logins-only-not-actual-actions)
  (from scenario 001) — the Administrator side of the same audit-visibility
  theme; this scenario found the Manager side (who does get the richer
  feed) still can't use it for per-staff accountability.

## Enrichment ideas

- Once BUG-008 is fixed, re-verify that a fresh reassignment on a
  non-`PENDING` referral now produces a correct, readable timeline entry
  (not just *a* row, but one that clearly names both the outgoing and
  incoming doctor).
- A variant walking the Administrator side: can an Administrator, with
  cross-facility visibility, answer an accountability question any better
  than a Manager today? (Likely not, given the existing "Administrator
  audit page shows logins only" finding — but not directly re-verified in
  this pass.)
- If per-doctor workload visibility ever gets built, come back and check
  whether it also accounts for referrals that were reassigned away from a
  Doctor (once BUG-008 makes that visible) — a workload count that only
  reflects current assignment, with no memory of past churn, would still
  hide a Doctor who repeatedly gets reassigned away from cases.
