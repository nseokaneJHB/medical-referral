# 017 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This is a code/config audit (confirming an endpoint
is dark, confirming a table is never touched) rather than a UI flow —
there's no self-service screen to walk yet, and the admin-reset flow
itself is a single form already implicitly covered by whatever
recording eventually gets made for the profile/settings page work this
ties into.

## Related

- Backlog: [Self-service password change (+ profile/settings
  page)](../../backlog.md#self-service-password-change--profilesettings-page) —
  the primary, already-tracked gap (raised by the user previously); this
  scenario's two new findings (session invalidation, audit logging) were
  added as an addendum to that same entry rather than split out.

## Enrichment ideas

- Once the self-service password-change/settings-page work is picked up,
  this is a natural place to also decide whether it should cover
  full "forgot password while locked out" recovery (an email-based
  token flow) or intentionally stay scoped to "change your password
  while already signed in," leaving locked-out recovery as an
  Administrator-only path by design.
- If session invalidation on reset is ever added, worth deciding whether
  it should be "invalidate everything, including the current request's
  own session if the reset is self-initiated" or "invalidate all
  sessions except the one used to perform the reset" — different UX
  depending on whether this is a security response or routine
  administration.
- A live reproduction worth doing later: reset a test user's password as
  Administrator while that user has an active session open in another
  browser/incognito window, confirm the old session keeps working
  end-to-end (not just in theory from reading the code).
