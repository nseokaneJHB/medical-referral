# 015 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This scenario is mostly a confirmation that a
multi-step, multi-role approval chain works as designed — a screen
recording of "nothing bad happens" is less useful than the code citations
already in `scenario.md`. Worth a recording of the founding-Manager
bootstrap flow specifically (signup → Administrator approval → facility
and Manager both flip to active) if this doc is ever used for onboarding
new team members to how the system works.

## Related

- Backlog: [Referral priority is purely cosmetic, and there is no
  notification system at
  all](../../backlog.md#referral-priority-is-purely-cosmetic-and-there-is-no-notification-system-at-all) —
  the orphaned-facility discovery gap found here was added as an
  addendum to this existing entry, since it's the same root cause (no
  alerting mechanism anywhere) rather than a new one.
- Related scenario: [007 — Facility moderation vs. in-flight
  referrals](../007-facility-moderation-vs-inflight-referrals/scenario.md) —
  covers what facility moderation does and doesn't restrict once a
  facility is already operating; this scenario covers the onboarding and
  Manager-bootstrap side instead.
- Related scenario: [011 — Staff departure and caseload
  handoff](../011-staff-departure-caseload-handoff/scenario.md) — the
  `DEPARTED` dead-code finding from that scenario is what a real
  "Manager leaves voluntarily" path would eventually need to go through;
  today the only way a facility actually loses its Manager is via admin
  disable/reject.

## Enrichment ideas

- A live walkthrough of the actual bootstrap sequence (sign up a new
  facility + Manager, approve as Administrator, confirm both flip
  together) would make a good short recording if this doc is ever
  revisited with browser access.
- Worth checking what happens if a facility's *second* Manager
  application is rejected after the facility is already `APPROVED` — the
  research for this scenario noted `managerReject` only cascades to the
  facility if it's still `PENDING`, so a second-Manager rejection
  correctly leaves an already-approved facility alone. Confirm this
  holds if the facility's *only* remaining Manager is the one rejected in
  that scenario (which would produce a manager-less approved facility,
  falling into the "orphaned facility" case covered here).
- A boundary case worth probing later: can an Administrator accidentally
  create a second permanently-orphaned facility by rejecting a Manager
  application that turns out to be the facility's last one, with no
  warning that they're about to do that.
