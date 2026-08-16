# 003 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made for this scenario — the walkthrough was verified via
direct authenticated API calls (curl) and a single browser check of an
existing seeded referral, not an interactive multi-step flow (see "When a
recording is worth it" in `docs/scenarios/README.md`).

## Related

- Bug: BUG-006 — a referral can never actually be rejected through the
  live app (fixed) — the actual blocker on walking this scenario end to
  end at the time; `STATUS_TRANSITIONS` and the per-role target lists
  were never reconciled for `REJECTED`, so no role/state combination
  could trigger it, even though seed data simulates it happening 15% of
  the time.
- Backlog: [No appeal mechanism for rejected
  referrals](../../backlog.md#no-appeal-mechanism-for-rejected-referrals) —
  the separate, still-open scope question of what recourse should exist
  once a referral *is* rejected, and whether `Create referral` should be
  able to pre-fill from a prior referral.

## Enrichment ideas

- Once BUG-006 is resolved (rejection becomes reachable through the live
  app), re-walk this scenario end to end as a real Nurse/Doctor pair
  instead of relying on an already-seeded record — confirm the same
  read-only/Timeline behavior holds for a referral rejected through the
  UI, not just one written directly to the database.
- A variant where the referral was rejected with a specific, substantive
  reason (e.g. "wrong specialty") vs. seed data's `notes: null` — does the
  Nurse-facing experience differ at all based on whether a reason was
  given?
- Whether Redirect (`canRedirectReferral`) is meant to be the *actual*
  real-world substitute for "this doesn't belong at our facility" in
  day-to-day use, with `REJECTED` reserved for a harder, less common "this
  referral itself is invalid" outcome — worth confirming with whoever owns
  the product intent once BUG-006 is scoped.
