# 027 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. Verified via direct authenticated API calls (comparing
`total` counts across three search terms), which demonstrates the bug
more precisely and repeatably than a UI screen recording would — the
interesting part is a number, not a visual.

## Related

- Bug: BUG-014: Search boxes treat literal `%`/`_` in a search term as
  SQL wildcards, not text (fixed) — live-verified, full reproduction
  steps.

## Enrichment ideas

- Once fixed, worth testing the `_` case specifically too (this pass
  only live-verified `%`, since it produces the clearest, easiest-to-
  measure "matches everything" signal) — e.g. searching for a referral
  reason containing a literal underscore and confirming it no longer
  wildcard-matches unrelated single characters in that position.
- A good regression test candidate: search for each of `%`, `_`, and a
  combined `%_%` across all five affected endpoints (patients, referrals,
  facilities, users, specialties), asserting the result count matches
  rows that actually contain those literal characters, not the
  unfiltered total.
- Worth checking whether any frontend search input already trims or
  otherwise massages the search string in a way that would interact with
  the escaping fix (e.g., if the UI already strips certain characters,
  the backend fix might need to account for what actually reaches it).
