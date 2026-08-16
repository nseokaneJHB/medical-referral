# 011 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This scenario is a code/reachability audit (confirming
an action path does *not* exist anywhere), not a UI walkthrough — there's
no working flow to demonstrate yet. Worth recording once the backlog item
is picked up and an actual departure/handoff flow exists.

## Related

- Backlog: [No way to identify or hold accountable a staff member sitting
  on stale
  referrals](../../backlog.md#no-way-to-identify-or-hold-accountable-a-staff-member-sitting-on-stale-referrals) —
  the addendum bullet added during this scenario's investigation covers
  the `DEPARTED` dead-code finding and the ordinary-turnover framing in
  full file:line detail.
- Related scenario: [006 — Accountability for dropped
  referrals](../006-accountability-for-dropped-referrals/scenario.md) —
  same root gap (`ModerationManager.applyUserStatusChange` never touches
  referrals), approached from the discipline/stale-referral angle rather
  than ordinary staff turnover.

## Enrichment ideas

- Once a real departure/handoff flow is designed, a good first test is
  whether it *blocks* completion until every non-terminal referral
  assigned to the departing person is reassigned, rather than allowing
  the status change and leaving reassignment as a manual follow-up (the
  same open question already sitting in the linked backlog entry).
- Worth checking whether patients (not just referrals) can be "assigned"
  to a Doctor/Nurse anywhere outside the referral relationship — if so,
  a departure flow would need to account for that too, not just open
  referrals.
- A negative-path variant once a flow exists: what happens if two
  Managers try to action the same departing employee's caseload at once.
