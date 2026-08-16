# 014 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made, and not a good candidate for one even later — this
was investigated by reading code (tracing the exact `WHERE` clauses and
transaction boundaries on each write path), not by live testing.
Reliably demonstrating a sub-millisecond race through a browser or even
two parallel curl requests isn't a clean, repeatable visual — the code
citations in `scenario.md` are the precise evidence here, not a
recording. If a fix lands (e.g. a conditional `WHERE` clause returning a
real 409), a recording of the *fixed* behavior — one request succeeds,
the other gets a clear "already claimed/decided" error — would be a good
candidate then.

## Related

- Backlog: [No concurrency control on any status-transition write —
  systemic race
  condition](../../backlog.md#no-concurrency-control-on-any-status-transition-write--systemic-race-condition) —
  full write-up, file:line detail for all three cases, and fix-direction
  options.
- Related scenario: [010 — Duplicate appeal
  submission](../010-duplicate-appeal-submission/scenario.md) — a
  different failure mode on the same appeal-decision code path
  (BUG-009's bug is about a *second appeal row* becoming undecidable, not
  about two people deciding the *same* row at once — but both stem from
  appeal resolution being tracked at the entity level rather than with
  proper per-row guards).

## Enrichment ideas

- If picked up, this is a good candidate for an automated test rather
  than a scenario walkthrough — a test harness can fire two truly
  parallel requests against a running API instance and assert on the
  final DB state (single `DOCTOR_ASSIGNED` row, single timeline decision
  row, loser gets a 409) far more reliably than a manual or browser-based
  reproduction ever could.
- Worth checking whether the same gap extends to facility-status writes
  (approve/reject/flag/suspend) and patient flag/unflag, which weren't
  individually traced in this pass but share the same
  `ModerationManager`/`updateRecords()` foundation and are very likely to
  have the identical shape.
- A narrower, cheaper first fix worth considering on its own: referral
  self-assign specifically, since "two Doctors claim the same case" is
  probably the highest-frequency real-world occurrence of this pattern
  (busy shared queue, no coordination between Doctors) compared to the
  appeal/staff-decision cases, which involve fewer people acting on a
  narrower set of records.
