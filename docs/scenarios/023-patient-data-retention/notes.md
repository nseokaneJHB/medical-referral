# 023 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. BUG-012 was verified via a direct authenticated API
call plus a database query (edit a real field, confirm zero timeline
rows, restore it) — more precise than a screen recording. The retention/
archival/erasure findings are all confirmed-absent-by-search results,
which don't have anything to visually demonstrate.

## Related

- Bug: BUG-012: Editing a patient's demographic fields leaves no audit
  trail (fixed) — live-verified, full reproduction steps.
- Backlog: [No patient data retention, archival, or deletion-request
  handling of any
  kind](../../backlog.md#no-patient-data-retention-archival-or-deletion-request-handling-of-any-kind) —
  full write-up, file:line detail, and open questions.
- Related scenario: [013 — Duplicate patient
  records](../013-duplicate-patient-records/scenario.md) — a different
  patient-data-integrity problem (two records for one real person)
  investigated earlier; this scenario is about one record's own data
  being wrong or needing to go away entirely, not a duplicate.
- Related bug: BUG-008 and BUG-011 (both fixed) —
  BUG-012 is the third instance of the same shape of gap (an existing
  audit mechanism that one specific call path doesn't use), first
  systematically checked for in [020 — Audit trail
  completeness](../020-audit-trail-completeness/scenario.md), which
  didn't happen to check `patientUpdate` specifically.

## Enrichment ideas

- Worth re-running the [020](../020-audit-trail-completeness/scenario.md)-style
  sweep specifically against every remaining `PATCH`/update handler not
  yet checked (facility update, user update) to see if this same pattern
  recurs a fourth time — three independent hits on the identical class
  of gap suggests it's worth a codebase-wide check rather than
  finding-by-finding.
- If a patient "archived" status is ever added, this is a natural place
  to also decide whether archived patients should still count in
  historical dashboard/report totals (see
  [018](../018-dashboard-report-correctness/scenario.md)) or be excluded
  going forward.
- Once BUG-012 is fixed, confirm live that the new timeline row's
  `previous`/`next`/`notes` shape is actually useful for reconstructing
  what changed — a naive "something was edited" row without the old and
  new values wouldn't meaningfully close this gap.
