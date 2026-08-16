# 026 — One person, two facilities; and appealing again after a fair denial

**Role(s):** Doctor, Nurse, Manager, Administrator
**Area:** Users, Facilities, Appeals

**Last reviewed:** 2026-08-16

## Use case

A Doctor consults at two hospitals during the week — a common real-world
arrangement, not an edge case. Separately: someone's account was flagged,
they appealed, and the appeal was fairly reviewed and denied. Nothing
about that outcome should be the end of the story if they later have new
information — but the next reviewer who sees a second appeal for the
same flag has no way of knowing there was a first one.

## Problem

Two independent real-world situations, investigated together because
both turned out to be genuinely undesigned-for cases rather than broken
features: a data model that assumes one person means one facility, and
an appeals process with no memory of its own history once a decision is
made.

## Solution

**One person cannot hold two facility affiliations under one identity.**
`facility_id` is a single column directly on `user`, not a many-to-many
relationship, and `user.email` is uniquely constrained — so the same
real person practicing at two facilities needs two entirely separate
accounts under two different email addresses, appearing to the system as
two unrelated people rather than one person with two affiliations. This
isn't called out anywhere as a deliberate one-facility-only decision; it
simply doesn't appear to have come up in prior design work. Full detail
in [A real person can't hold staff accounts at two facilities under one
identity](../../backlog.md#a-real-person-cant-hold-staff-accounts-at-two-facilities-under-one-identity).

**Appeal re-filing after a fair denial is unlimited, and invisible to
the next reviewer.** This is distinct from BUG-009 (fixed), which was
about a second appeal filed *while the first is still pending*.
Here, the first appeal has already been properly decided — denied — and
the underlying status never changes on a denial, so the appealable-status
check simply passes again the moment someone re-files. The reviewer
queue actively filters out already-decided appeals rather than keeping
them as context, so a repeat appeal for the same flag/suspension shows up
looking exactly like a first-time one, with no denied-count or prior-date
indicator anywhere in the queue or detail view. Full detail in
[Unlimited appeal re-filing after a fair denial, with no signal to the
next
reviewer](../../backlog.md#unlimited-appeal-re-filing-after-a-fair-denial-with-no-signal-to-the-next-reviewer).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A user can be affiliated with more than one facility | Read the `user` schema for a facility relationship | ❌ Confirmed single facility only, 2026-08-16 — no join table exists |
| 2 | Two accounts for the same person can share one email address | Read the `user.email` uniqueness constraint | ❌ Confirmed blocked, 2026-08-16 — unique on `user`, requires two distinct emails |
| 3 | Multi-facility staffing is documented anywhere as a deliberate scope decision | Searched `docs/roles-permissions.md` and `docs/backlog.md` | ❌ Confirmed undocumented, 2026-08-16 — appears not to have come up |
| 4 | A denied appeal blocks re-filing a new one for the same flag/suspension | Read `AppealManager.decide` and `canFileAppeal`/`canFileFacilityAppeal` | ❌ Confirmed unlimited re-filing, 2026-08-16 — denial doesn't change status |
| 5 | A reviewer sees any signal that a repeat appeal was already denied before | Read `AppealManager.list`/`resolveAuthority` and the appeals UI | ❌ Confirmed absent, 2026-08-16 — decided appeals are filtered out of the queue entirely |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
