# 009 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This is a pure absence finding — there's nothing to
show on screen, since the entire point is that marking a referral Urgent
looks and behaves identically to any other priority level everywhere
except its own badge color.

## Related

- Backlog: [Referral priority is purely cosmetic, and there is no
  notification system at
  all](../../backlog.md#referral-priority-is-purely-cosmetic-and-there-is-no-notification-system-at-all) —
  full write-up, split into two separable items (functional priority vs.
  a notification system).
- Backlog: [Referral staleness has no UI
  signal](../../backlog.md#referral-staleness-has-no-ui-signal) (scenario
  002) and [No way to identify or hold accountable a staff member sitting
  on stale
  referrals](../../backlog.md#no-way-to-identify-or-hold-accountable-a-staff-member-sitting-on-stale-referrals)
  (scenario 006) — both would benefit directly from a notification system
  existing, independent of the priority question.

## Enrichment ideas

- If priority is ever made functional, decide whether that's a default
  sort change (urgency-then-date instead of pure date), a dashboard
  callout, or both — and whether a Doctor should get some form of
  re-triage/escalation path even without full edit rights on the field.
- If a notification system is ever considered, this scenario plus
  002/006 together make a reasonable combined case for prioritizing it —
  worth referencing together rather than re-justifying from scratch.
- A narrower, cheaper first step worth flagging: even without full
  notifications, a Doctor-visible "flag this referral back to the Nurse"
  action (independent of full priority-edit rights) might close part of
  the re-triage gap without the larger build.
