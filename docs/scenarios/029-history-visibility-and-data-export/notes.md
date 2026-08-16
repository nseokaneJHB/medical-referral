# 029 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. Both findings are code-level absence checks (no
pagination controls exist to click, no export button exists to press) —
there's nothing working to demonstrate yet. Worth a recording once either
gap is closed, to show the "before" (silent truncation, screen-only data)
and "after" side by side.

## Related

- Backlog: [An entity's history beyond the first page is invisible in
  the UI, and staff history has no viewer at
  all](../../backlog.md#an-entitys-history-beyond-the-first-page-is-invisible-in-the-ui-and-staff-history-has-no-viewer-at-all) —
  full write-up and open questions.
- Backlog: [No export, download, print, or CSV capability exists
  anywhere in the
  app](../../backlog.md#no-export-download-print-or-csv-capability-exists-anywhere-in-the-app) —
  full write-up and open questions.
- Backlog addendum: [No bulk actions anywhere, and pagination `limit`
  has no upper
  cap](../../backlog.md#no-bulk-actions-anywhere-and-pagination-limit-has-no-upper-cap) —
  the three history routes share the identical missing-querystring-schema
  gap already documented there for appeals/transfers/audit.
- Related scenario: [006 — Accountability for dropped
  referrals](../006-accountability-for-dropped-referrals/scenario.md) —
  the missing staff-history viewer directly compounds this existing
  gap.
- Related scenario: [023 — Patient data retention, correction, and
  deletion requests](../023-patient-data-retention/scenario.md) — the
  narrower, patient-specific instance of the export gap generalized here.

## Enrichment ideas

- The cheapest fix for the history-visibility half is probably just
  wiring `TimelineList` to the existing shared `PaginationFooter`
  component and passing through `page`/`limit` from the frontend request
  — the backend already supports it correctly, so this is a frontend-only
  change.
- If a staff history viewer is ever built, worth deciding whether it's a
  simple reuse of `TimelineList` (same component, different entity) or
  needs its own presentation given how different a user's history looks
  from a referral's (fewer, further-apart events, longer time spans).
- If export is ever prioritized, the audit log is the most clearly
  compliance-motivated starting point, per the open question in the
  backlog entry — worth checking with whoever owns compliance
  requirements for this system what format they'd actually need (CSV
  vs. PDF vs. something else) before building either.
