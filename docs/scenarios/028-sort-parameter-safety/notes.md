# 028 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This is a code-safety audit with a clean result — no
live payload or broken behavior to demonstrate. Not a good candidate for
a recording even later, since there's nothing to show going right or
wrong visually.

## Related

- Backlog: [Two minor code-quality gaps in sort-parameter handling (both
  currently
  unreachable)](../../backlog.md#two-minor-code-quality-gaps-in-sort-parameter-handling-both-currently-unreachable) —
  full write-up and open questions.
- Related scenario: [027 — Search boxes and literal wildcard
  characters](../027-search-wildcard-correctness/scenario.md) — the
  sibling investigation on the filtering side of the same query-building
  layer, which did find a real, live bug (BUG-014). Worth reading
  together: one confirms a gap, the other confirms a clean bill of
  health in an adjacent area of the same code.

## Enrichment ideas

- If the `order`-as-array widening is ever done (to support real
  per-field sort direction), it's a good opportunity to also add the
  `.statusCode = 400` hardening to `buildOrder`'s inline throw in the
  same pass, since both touch the same small area of code.
- Worth periodically re-running this kind of "is client input properly
  allowlisted before reaching the query builder" check whenever a new
  list endpoint or filterable field is added — `parseSortList`'s
  schema-as-allowlist pattern is worth holding up as the reference
  example for any new dynamic-query-building code.
