# 012 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This scenario is primarily a permission/data-boundary
code audit (proving negative and structural claims about who *can't* see
what across a multi-hop chain) rather than a visual UI flow — the
Solution section's citations are the clearest way to show it.

## Related

- Backlog: [Patient transfer doesn't account for in-flight referrals, and
  referral access doesn't follow the
  patient](../../backlog.md#patient-transfer-doesnt-account-for-in-flight-referrals-and-referral-access-doesnt-follow-the-patient) —
  the Transfer-side version of the same "access outlives real
  involvement" shape found here via Redirect.
- Docs fix: `docs/roles-permissions.md`'s stale "one active referral per
  patient, 409" claim was corrected in place during this investigation
  (not filed as a bug — documentation-only, no code defect).
- Related scenario: [004 — Facility overload /
  redirect](../004-facility-overload-redirect/scenario.md) — covers the
  redirect action itself; this scenario covers what redirect leaves
  behind for the facilities it passes through.

## Enrichment ideas

- A live walkthrough confirming the asymmetry end to end: create A→B→C
  by hand, then check as A, B, and C which of them can open the referral
  and the patient record. Worth doing once a browser session is
  available, since this pass was code-only.
- Worth checking whether the same origin-permanence pattern applies to a
  chain with more than one redirect (A→B→C→D) — the code reasoning
  suggests yes (origin is never touched by any redirect), but hasn't been
  traced past the two-hop case.
- If the Transfer-side backlog item above is ever picked up (e.g. closing
  out referrals automatically when their motivating transfer completes),
  the redirect-chain origin-permanence behavior should be revisited at
  the same time, since it's the same underlying question answered two
  different ways today.
