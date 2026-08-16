# 022 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This is a completeness check (confirming an
affordance doesn't exist anywhere) rather than a flow to walk — there's
no bulk action to demonstrate yet. Worth recording a before/after once
even one bulk action (staff approval is the likely first candidate,
per Enrichment below) is built, to show the time savings concretely.

## Related

- Backlog: [No bulk actions anywhere, and pagination `limit` has no
  upper
  cap](../../backlog.md#no-bulk-actions-anywhere-and-pagination-limit-has-no-upper-cap) —
  full write-up, file:line detail, and open questions.
- Related scenario: [006 — Accountability for dropped
  referrals](../006-accountability-for-dropped-referrals/scenario.md) —
  shares the same "volume/backlog" real-world framing, from the
  visibility angle rather than the action-efficiency angle.

## Enrichment ideas

- If bulk actions are ever prioritized, staff approval is probably the
  best first candidate: it has the clearest "hiring wave" real-world
  trigger, the smallest blast radius per item (approve/reject don't
  cascade into other entities the way a referral or appeal decision
  might), and the existing per-item logic (`ModerationManager`) is
  already a shared primitive that a batch wrapper could loop over
  cleanly.
- Worth a quick manual check of how a Manager/Doctor currently *copes*
  with volume in practice (do they just accept the one-at-a-time
  friction, or informally batch by opening many tabs?) before assuming
  bulk actions are the right fix versus, say, better list sorting/
  filtering to at least make triage faster even without batching the
  action itself.
- Once the pagination cap is added, a good regression check: confirm a
  request for an old, now-invalid huge `limit` value degrades gracefully
  (clamped to a max, not a 500) rather than just moving the failure mode
  from "unbounded" to "unhandled edge value."
