# 013 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This is a code-level absence check (confirming no
lookup, constraint, or tooling exists anywhere) rather than a UI flow —
there's no working "did you mean this patient?" affordance yet to
demonstrate. Worth recording once even a basic same-facility duplicate
warning exists.

## Related

- Backlog: [No duplicate-patient detection, same-facility or
  cross-facility](../../backlog.md#no-duplicate-patient-detection-same-facility-or-cross-facility) —
  full write-up, file:line detail, and open questions.
- Related scenario: [012 — Referral redirect chains and cross-facility
  visibility](../012-redirect-chain-visibility/scenario.md) — same
  facility-scoped visibility boundary (`canAccessPatientRecord`), viewed
  here from the identity-matching angle rather than the
  access-persistence angle.

## Enrichment ideas

- A live reproduction: create two patients with identical
  name+DOB at the same facility via the UI, confirm both persist as
  fully independent rows with no warning at any point.
- Worth checking whether the seed script (`api/script/seed.ts`) ever
  accidentally generates near-duplicate fakers (same name/DOB via
  faker collision) — if so, that's a free live example already sitting
  in the dev database.
- If a same-facility "possible duplicate" prompt is ever built, a good
  boundary case to test is a false positive (two different real people
  who happen to share a common name and rough birth year) — the fix
  shouldn't make legitimate second registrations harder.
