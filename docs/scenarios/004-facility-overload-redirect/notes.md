# 004 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made yet. The walkthrough that found and verified the BUG-007
fix (see Related below) was done via scripted browser automation, not a
clean single take worth recording as "the solution." Now that the fix is
live, this would be a good candidate for a real recording next time this
scenario is revisited (see Enrichment ideas). The rest of the scenario
(facility load visibility, Manager-level redirect) is a pure code-absence
finding with no UI to show.

## Related

- Bug (fixed): BUG-007 — redirecting a referral succeeded but the detail
  page never repainted, then 404'd on reload — found while walking this
  scenario live, fixed and verified live the same day (see git history;
  no longer in `docs/bugs.md` per its prune-on-fix convention). The fix:
  since redirecting almost always revokes the current Doctor's own view
  access to the referral, the page now navigates back to the referral
  list on success instead of trying to keep re-rendering a record it can
  no longer see.
- Backlog: [No facility load/capacity visibility, and Redirect is
  single-referral,
  Doctor-only](../../backlog.md#no-facility-loadcapacity-visibility-and-redirect-is-single-referral-doctor-only) —
  the broader scope gap: nothing helps anyone notice an overloaded
  facility before a Doctor is already looking at one of its referrals,
  and there's no Manager-level or bulk redirect action.
- Related scenario: [002 — Referral falls through the
  cracks](../002-referral-falls-through-the-cracks/scenario.md) shares the
  same underlying theme (a referral silently sitting somewhere it
  shouldn't) from the opposite angle — that one is about a referral nobody
  is watching, this one is about a facility that's watching but can't
  offload what it can't handle.

## Enrichment ideas

- Record this scenario live now that BUG-007 is fixed, including the
  new-facility side: sign in as a Doctor at the *destination* facility and
  confirm the redirected referral shows up correctly in their pending
  queue with the right specialty tags carried over.
- A variant where the same referral gets redirected twice in a row
  (A → B → C) — confirm the loop-prevention check correctly blocks sending
  it back to A or B, not just re-blocks the immediately-prior hop.
- If a facility-load metric or Manager-level redirect ever gets built,
  come back and re-walk this scenario against the real feature instead of
  the current single-referral, Doctor-only mechanism.
- A "wrong specialty" variant of this same use case — a facility isn't
  overloaded, it just can't treat what was referred to it at all — may be
  worth its own scenario rather than folding into this one, since the
  underlying signal (specialty mismatch, not volume) and probably the fix
  (routing validation at creation time, not a post-hoc redirect) are
  different.
