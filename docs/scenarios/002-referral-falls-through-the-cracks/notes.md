# 002 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made for this scenario — the walkthrough was verified via
direct authenticated API calls (curl), not a browser click-through, so
there's no interactive flow that would benefit from a video (see "When a
recording is worth it" in `docs/scenarios/README.md`).

## Related

- Backlog: [Referral staleness has no UI signal](../../backlog.md#referral-staleness-has-no-ui-signal) —
  tracks the actual gap this scenario surfaced: no dashboard age
  indicator, no visible/sortable created-date column, no referral-level
  flag/escalation mechanism, and a referral timeline that shows nothing
  useful for a referral that's had zero status changes since creation.
- A related defect (`sort=created` crashing every list endpoint with a
  500, since fixed 2026-08-16) was found and resolved while investigating
  this scenario — no longer tracked as an open bug; see git history for
  the fix.

## Enrichment ideas

- A negative-path variant: a referral that's been redirected once already
  and is now stale again at its *second* destination facility.
- Whether "pending > N days" is worth exposing as an actual dashboard
  widget once the backlog item above is scoped, rather than left as a
  hypothetical in this scenario.
- A Manager's point of view specifically on a referral that's stale on the
  *outgoing* side (their facility referred out, and the other side hasn't
  acted) vs. the *incoming* side (their facility is the one sitting on it)
  — right now both look identical in the list, distinguished only by
  reading the origin/destination columns.
