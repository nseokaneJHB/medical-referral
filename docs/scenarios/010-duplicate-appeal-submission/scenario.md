# 010 — Appealing a rejected or flagged account

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Users, Facilities, Appeals
**Last reviewed:** 2026-08-16

## Use case

A Nurse, Doctor, or Manager whose account gets rejected, flagged, or
disabled — or a Manager whose facility gets rejected, flagged, or
suspended — wants someone with the authority to reconsider that decision.
They write up why, submit it, and expect a Manager or Administrator to
review and either reinstate them or explain why not.

## Problem

An appeal process only works if exactly one appeal is being decided at a
time and the reviewer has full context. If someone can end up with two
appeals open at once — maybe they clicked submit twice, or tried again
after not hearing back — the system needs to handle that gracefully, not
let one appeal silently interfere with the other.

## Solution

The core appeal flow works correctly: filing one is a single reason field
tied to the entity's own status, deciding it either flips the entity back
to its "good" status (approve) or leaves it untouched with the decision
recorded (deny), and a Manager can only decide appeals against a status
they personally imposed (Administrators can decide any of them, as the
universal fallback).

What the flow doesn't handle is more than one appeal existing at once for
the same person or facility. Nothing blocks filing a second appeal while
the first is still pending — both show up as separate rows in the
reviewer's queue, looking like two independent, actionable items. But the
system only tracks resolution at the *entity* level (one status field),
not per appeal — so deciding either one immediately, silently disqualifies
the other. See BUG-009 (fixed) for the exact reproduction and the
confusing error a reviewer hits if they act on the now-stale second row
before refreshing their view.

Separately, whichever appeal a reviewer does act on, they're deciding
mostly blind: the appeals queue shows the appellant's own stated reason,
but not the original reason their account or facility was rejected,
flagged, or suspended for in the first place — that's a different,
earlier record the reviewer would have to separately dig up from the
audit log. See [notes.md](notes.md) for that write-up.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A second appeal can be filed while the first is still pending | Flagged `nurse@gmail.com`, submitted two appeals via API in a row | ❌ Confirmed live, 2026-08-16 — both accepted with `201`, no conflict |
| 2 | Both appeals appear in the reviewer's queue | `GET /manager/appeals` as `manager@gmail.com` after both submissions | Confirmed live, 2026-08-16 — both listed as separate pending rows |
| 3 | Deciding one appeal correctly resolves the underlying account status | Approved the first appeal | ✅ Confirmed live, 2026-08-16 — Nurse correctly flipped back to `ACTIVE` |
| 4 | The second, now-stale appeal can still be meaningfully decided afterward | Attempted to approve the second appeal | ❌ Confirmed live, 2026-08-16 — `409`, "already been decided" (misleadingly — see BUG-009, fixed) |
| 5 | The appeals queue shows the original punitive reason alongside the appeal | Read the appeals list/detail UI and its backing query | ❌ Confirmed absent, 2026-08-16 — only the appellant's own reason is shown |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
