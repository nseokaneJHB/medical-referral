# 018 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. BUG-010 was verified via direct authenticated API
calls (comparing three endpoints' JSON responses side by side), which
shows the discrepancy more precisely than a screen recording would. The
stale-cache finding would make a good short recording once it's either
confirmed or fixed — a live browser attempt this pass got as far as
opening a referral to test a mutation but didn't find a working affordance
to change its assigned doctor as the signed-in Manager in the time spent,
so that half of this scenario is currently code-traced only (see
Enrichment ideas).

## Related

- Bug: BUG-010: A Doctor's dashboard and report undercount their own
  actionable queue (fixed) — live-verified, full reproduction steps.
- Backlog: [Dashboard/report numbers can silently go stale after a
  mutation, and aren't simply additive across
  facilities](../../backlog.md#dashboardreport-numbers-can-silently-go-stale-after-a-mutation-and-arent-simply-additive-across-facilities) —
  the two code-traced findings.

## Enrichment ideas

- Finish the live reproduction of the stale-cache finding: find the
  actual UI path for a Manager to change a referral's assigned doctor
  (the referral detail page's "Assigned doctor" field rendered as plain
  text with no visible edit control during this pass — worth checking
  whether it requires a different entry point, e.g. an action from the
  referrals list's row menu, or is gated on something not yet
  understood), then confirm live whether the dashboard's numbers are
  actually stale for up to 5 minutes afterward.
- Once BUG-010 is fixed, re-run the same three-endpoint comparison
  (`GET /referrals` vs. `dashboard/doctor/summary` vs.
  `reports/referrals`) to confirm they agree.
- Worth checking whether the Nurse dashboard has any analogous scoping
  mismatch — this pass only found the gap on the Doctor side, but didn't
  exhaustively re-diff Nurse's `GET /referrals` scoping against
  `nurseSummary`/the Nurse branch of `referralsReport` field by field.
