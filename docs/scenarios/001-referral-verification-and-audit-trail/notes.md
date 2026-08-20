# 001 — Notes

Supporting material for [scenario.md](scenario.md): recording breakdown,
related links, and enrichment ideas. Keep this separate from
`scenario.md` itself — that file stays a clean use case/problem/solution
description (plus its own tracking table).

## Related

- Backlog: [Administrator audit page shows logins only, not actual actions](../../backlog.md#administrator-audit-page-shows-logins-only-not-actual-actions) — tracks case 2's current scope, and the open question of whether Administrators should see a broader trail
- A Manager running the same audit-log check would see the richer
  `ManagerFacilityAudit` feed on the same `/audit` URL — worth a follow-up
  scenario showing that view directly

## Enrichment ideas

- A Manager's version of case 2, showing `ManagerFacilityAudit` side by
  side with the Administrator's login-only view on the same page
- A negative-path variant for case 1: a referral whose destination
  facility was deleted/suspended after being set
- Whether case 1's seeded-facility approach is worth converting into an
  automated `web` test once the pattern is used elsewhere
