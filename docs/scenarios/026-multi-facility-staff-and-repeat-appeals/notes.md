# 026 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. Both findings are schema/permission-logic absence
checks rather than UI flows — there's no multi-facility affordance or
appeal-history indicator to demonstrate since neither exists.

## Related

- Backlog: [A real person can't hold staff accounts at two facilities
  under one
  identity](../../backlog.md#a-real-person-cant-hold-staff-accounts-at-two-facilities-under-one-identity) —
  full write-up and open questions.
- Backlog: [Unlimited appeal re-filing after a fair denial, with no
  signal to the next
  reviewer](../../backlog.md#unlimited-appeal-re-filing-after-a-fair-denial-with-no-signal-to-the-next-reviewer) —
  full write-up and open questions.
- Bug: BUG-009 (fixed) —
  the related-but-distinct duplicate-appeal-while-pending defect.
- Related scenario: [010 — Duplicate appeal
  submission](../010-duplicate-appeal-submission/scenario.md) — same
  general area (appeal resolution), different failure mode.

## Enrichment ideas

- If multi-facility staffing is ever prioritized, worth checking how
  many other places in the codebase assume `request.user!.facility_id`
  is a single, always-present value before scoping the change — this
  could be a much bigger change than it first appears, touching
  permission checks throughout `api/src/lib/permission.ts` and every
  service module.
- For the repeat-appeal gap, the cheapest first step is probably just
  showing prior appeal history (count + most recent decision date) on
  the appeal detail view — a read-only addition that doesn't require
  deciding anything about whether to gate re-filing itself.
- Worth a live reproduction once decided: flag a test account, deny an
  appeal, immediately re-file, and confirm the second appeal really does
  render in the queue with zero distinguishing context from a first-time
  appeal.
