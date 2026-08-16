# 020 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. BUG-011 was verified via a direct authenticated API
call plus a database query (create an account, confirm zero timeline
rows) — more precise than a screen recording. The confirmed-working
cases (patient flag, facility moderation, transfers) are better shown by
the code citations already gathered than a recording of "nothing went
wrong."

## Related

- Bug: BUG-011: Administrator-created accounts leave no audit trail at
  all (fixed) — live-verified, full reproduction steps.
- Backlog: [Specialty assignment/unassignment is completely untracked in
  the audit
  trail](../../backlog.md#specialty-assignmentunassignment-is-completely-untracked-in-the-audit-trail) —
  full write-up, file:line detail for all six handlers.
- Related bug: BUG-008 (fixed) —
  the original finding that prompted this broader sweep.

## Enrichment ideas

- Once BUG-011 is fixed, confirm live that a newly admin-created account
  produces a timeline row with a sensible `previous`/`next` shape,
  consistent with what `staffApprove`/`managerApprove` already produce
  for the same "user becomes ACTIVE" outcome.
- If the specialty-tracking backlog item is ever picked up, this is a
  good candidate to test alongside [016 — Specialty
  lifecycle](../016-specialty-lifecycle/scenario.md), since both concern
  the same set of link tables from different angles (reference-integrity
  there, audit trail here).
- Worth doing one more sweep of this kind later against any *new*
  status-changing action added to the app going forward — the pattern
  found twice now (an existing audit mechanism that one specific call
  path doesn't route through) is exactly the kind of thing that's easy
  to reintroduce when a new admin/manager action gets added without
  reusing the shared `ModerationManager`/`timeline.create` pattern.
