# 032 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

Skipped — no meaningful visual story beyond a search box returning a
row, and the interesting part (collation behavior, Unicode regex) isn't
visible in a recording anyway. The Solution section's live search
confirmation is the record.

## Related

- Bug reports: [BUG-016](../../bugs.md#bug-016-creating-a-patient-always-returns-a-500-even-though-the-patient-is-created) — found incidentally while registering this scenario's test patient, not an i18n-specific defect
- Related scenario: [027 — Search boxes and literal wildcard characters](../027-search-wildcard-correctness/scenario.md), which covers search-input safety from a different angle (wildcard characters, not character set)

## Enrichment ideas

- Test a non-Latin script name (e.g. CJK or Arabic) end-to-end, not just
  accented Latin — not done this pass
- Test sort ordering of accented names (does `Café` sort next to `Cafe`
  or after `Z`?) — not checked
- If UI translation is ever prioritized, this scenario's "data survives
  the round trip" finding is a reasonable starting foundation to build
  from
