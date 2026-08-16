# 010 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This was verified via direct authenticated API calls
(curl), not a browser walkthrough — the interesting part (a confusing
error on a stale second appeal row) is more precisely demonstrated as a
raw request/response sequence than a UI recording would show. Worth a
browser-based recording once BUG-009 is fixed, to confirm the reviewer
experience is actually clean end to end.

## Related

- Bug: BUG-009 — a second appeal filed before the first is decided
  becomes permanently undecidable, with a misleading error (fixed) —
  found and verified live during this scenario's investigation.
- Backlog: [Appeal reviewers can't see the original rejection/flag/
  suspension
  reason](../../backlog.md#appeal-reviewers-cant-see-the-original-rejectionflagsuspension-reason) —
  full write-up of the second, independent usability gap found in the
  same investigation.
- Related scenario: [008 — Patient transfer with an in-flight
  referral](../008-patient-transfer-mid-referral/scenario.md) — the
  Transfer feature solves the structurally identical "don't allow a
  second open request" problem correctly (`TransferManager.isOpen`
  blocks a second transfer at submission time); this scenario's finding
  is effectively "the Appeal feature should do what Transfer already
  does here."

## Enrichment ideas

- Once BUG-009 is fixed, re-verify the same reproduction sequence
  confirms a second appeal is rejected at submission time (matching
  Transfer's behavior) rather than accepted and later producing a
  confusing decision-time error.
- A facility-appeal variant of the same reproduction (two Managers of the
  same facility — or the same Manager twice — filing duplicate facility
  appeals) to confirm the bug is symmetric across both appeal types, not
  just the account-appeal path this pass tested.
- Worth checking whether this same "entity-level resolution, not
  row-level" pattern exists anywhere else in the codebase beyond appeals
  — it's a structural pattern (a generic `timeline` table used for
  multiple independent workflow types), not necessarily unique to
  appeals, so a similar bug could in principle exist wherever else that
  same `supersededBy` mechanism is reused for a per-entity decision.
