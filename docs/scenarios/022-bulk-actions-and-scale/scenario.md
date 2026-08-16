# 022 — Operating at volume: bulk actions and list limits

**Role(s):** Doctor, Manager, Administrator
**Area:** Referrals, Users, Appeals, Transfers
**Last reviewed:** 2026-08-16

## Use case

A facility onboards ten new hires in one week, and a Manager now has ten
pending staff applications sitting in a queue. A Doctor comes back from a
weekend to twenty unassigned referrals. In both cases, the person doing
the work already knows what decision they want to make for most or all
of the items — the only question is how many individual clicks it takes
to get there.

## Problem

A tool meant to help a facility manage volume should get easier to use as
volume goes up, not harder. If every action requires opening one record,
clicking through a confirmation, and returning to the list before the
next one, the tool itself becomes the bottleneck during exactly the
moments (a hiring wave, a busy weekend) when it matters most.

## Solution

There is no bulk-action capability anywhere in this app today — not a
partial implementation, a complete absence across every action type
checked. Staff approve/reject/flag/disable, referral self-assign and
redirect, and every appeal/transfer decision are all strictly
single-record, both at the API layer (every route takes one id in
`params`, never an array) and in the UI (every list — staff, referrals,
appeals, transfers — renders a per-row action menu with no checkbox
column or "select all"). A referral self-assign isn't even reachable from
the referrals list itself; a Doctor has to open each unassigned
referral's own detail page individually. Full detail in [No bulk actions
anywhere, and pagination `limit` has no upper
cap](../../backlog.md#no-bulk-actions-anywhere-and-pagination-limit-has-no-upper-cap).

A related, more technical finding from the same investigation: list
`limit` has no server-side ceiling anywhere in the codebase — the shared
pagination schema has no upper bound, and every list handler passes the
raw client-supplied value straight into the SQL `LIMIT` clause. Three
list endpoints (appeals, transfers, audit) don't even attach a
querystring validation schema at all, unlike every other list endpoint.
This is a legitimate "let me see everything on one page" convenience
today, but it's also an unguarded resource-exhaustion surface.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A Manager can approve/reject more than one pending staff member in a single action | Read the staff moderation routes and the staff list UI | ❌ Confirmed absent, 2026-08-16 — strictly one id per call, no checkbox UI |
| 2 | A Doctor can self-assign more than one unassigned referral at once | Read the referral-assign route and the referrals list UI | ❌ Confirmed absent, 2026-08-16 — self-assign isn't even reachable from the list, only the detail page |
| 3 | Multiple appeals or transfers can be decided in one action | Read the appeal/transfer decision routes and their queue UIs | ❌ Confirmed absent, 2026-08-16 |
| 4 | List `limit` is capped server-side | Read the shared pagination schema and every list handler's use of it | ❌ Confirmed uncapped, 2026-08-16 |
| 5 | Every list endpoint validates its `page`/`limit` query params | Grepped every route file for an attached `querystring` schema | ❌ Confirmed inconsistent, 2026-08-16 — appeals, transfers, and audit have none at all |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
