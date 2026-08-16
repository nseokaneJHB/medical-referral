# 031 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

Skipped — this scenario is a backend date-boundary/query-construction
question with no meaningful visual story (the UI behavior is identical
regardless of timezone; the divergence is in what data a filter returns,
not what the filter looks like). The Solution section's live
request-inspection and code citations are the record.

## Related

- Bug reports: [BUG-017](../../bugs.md#bug-017-date-range-filters-are-anchored-to-utc-not-the-viewers-local-timezone) — the systemic UTC-anchoring defect this scenario surfaced
- Related scenario: [018 — Dashboard and report number correctness](../018-dashboard-report-correctness/scenario.md), which covers report-number accuracy but didn't specifically probe timezone handling
- Related scenario: [029 — History visibility and data export](../029-history-visibility-and-data-export/scenario.md), which touches audit-trail timestamp display

## Enrichment ideas

- Live-verify the exact midnight-boundary exclusion by creating a record
  right at a local-day boundary and confirming which UTC-anchored
  "day" it lands in from a non-UTC viewer's perspective — not done this
  pass since it requires waiting for a specific clock time rather than
  something reproducible on demand
- Check whether `created_at`/`changed_at` display (as opposed to
  filtering) has any similar inconsistency once a fix for the filter
  side is decided
- Consider whether the fix belongs client-side (send an ISO instant with
  offset from the date picker) or server-side (accept a client-supplied
  UTC offset/timezone param) — not decided, just the two obvious
  directions
