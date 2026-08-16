# 001 — Notes

Supporting material for [scenario.md](scenario.md): recording breakdown,
related links, and enrichment ideas. Keep this separate from
`scenario.md` itself — that file stays a clean use case/problem/solution
description (plus its own tracking table).

## Recording

`recording.mp4` in this folder (2:59.86, 1280x720). Timestamps verified by
extracting frames from the file:

| Time | What's happening | Why |
|------|-------------------|-----|
| 0:00 | Landing on sign-in page, recording live | Starting state |
| 0:28–0:34 | Nurse signs in | Case 1 setup |
| 0:58 | Referrals list, opening Wallace Cole's row via the Actions menu | Navigating to the record under test |
| 0:88–0:96 | Referral detail page: "Destination facility" shows "East Irving Regional Hospital", matching the header | Confirms the solution working end to end |
| ~1:38 | Nurse signs out | Transition between cases |
| 1:52–2:20 | Administrator signs in | Case 2 setup |
| 2:54 | Login audit table: 2,445 rows, all login/logout, no referral/facility data | Shows exactly what this view covers today |
| 2:56 | Administrator signs out, recording ends | End of walkthrough |

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
