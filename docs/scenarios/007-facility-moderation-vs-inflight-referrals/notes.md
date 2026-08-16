# 007 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This scenario was verified entirely by code read (the
underlying claim — moderation status isn't checked in most of these
places — is an absence, not a UI flow), plus one already-existing code
comment in `shared/src/constant.ts` explicitly confirming the limitation
is known and intentional rather than an oversight. Live-testing this would
require suspending a real seeded facility, which locks out every member
of staff at that facility from the entire app for as long as the test
runs — a large, slow-to-cleanly-reverse blast radius for a finding the
code already documents about itself. Worth a live pass once this gets
picked up for real and the enforcement direction is decided.

## Related

- Backlog: [Facility moderation (FLAGGED/SUSPENDED) doesn't actually
  restrict
  referrals](../../backlog.md#facility-moderation-flaggedsuspended-doesnt-actually-restrict-referrals) —
  full write-up.
- Related scenario: [004 — Facility overload /
  redirect](../004-facility-overload-redirect/scenario.md) and
  [005 — Wrong-specialty
  referral](../005-wrong-specialty-referral/scenario.md) both found gaps
  in the same two pickers (`referralCreate`'s destination field,
  `RedirectReferralAction`'s facility search) — this scenario adds a
  third dimension (moderation status) to a picker that already has two
  other known gaps (capacity, specialty). All three point at the same
  underlying pattern: `referralCreate` and the shared facility-search
  pickers do much less validation than a reader would assume from how
  much validation `referralRedirect` does on the same kind of choice.

## Enrichment ideas

- A live pass once picked up: suspend a disposable/newly-created test
  facility (not a heavily-referenced seeded one), confirm a Nurse
  elsewhere can still create a referral into it via direct API call, then
  clean up by restoring its status.
- A variant checking the origin side specifically: if a Nurse's own
  facility gets flagged (not suspended, so they're not locked out
  entirely), can they still create outgoing referrals normally? Per the
  research, yes — nothing checks origin status at all — but this hasn't
  been separately confirmed live.
- Once enforcement is decided and built, this is a natural candidate for
  an actual `docs/bugs.md`-style regression check: verify `SUSPENDED`
  blocks the destination-aware case this write-up found missing, without
  breaking the existing account-lockout behavior that already works.
