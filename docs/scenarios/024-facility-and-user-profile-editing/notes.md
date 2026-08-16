# 024 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. BUG-013 was verified via a direct authenticated API
call plus a database query (edit the address, confirm zero timeline
rows, restore it) — more precise than a screen recording. The missing
user-profile-edit finding is a route-absence check, nothing to
demonstrate visually.

## Related

- Bug: BUG-013: Editing a facility's name or address leaves no audit
  trail (fixed) — live-verified, full reproduction steps.
- Backlog: [User profile pages](../../backlog.md#user-profile-pages) —
  corrected in place during this investigation to reflect that
  self-service name editing was only ever a design decision, never
  actually built.
- Backlog: [Self-service password change (+ profile/settings
  page)](../../backlog.md#self-service-password-change--profilesettings-page) —
  the sibling gap (no password self-service) found earlier in
  [017](../017-password-recovery/scenario.md); both gaps point at the
  same missing profile/settings page.
- Related scenarios: [020 — Audit trail
  completeness](../020-audit-trail-completeness/scenario.md) and
  [023 — Patient data retention, correction, and deletion
  requests](../023-patient-data-retention/scenario.md) — the third and
  now-fourth instances of the same "existing audit mechanism, one path
  doesn't use it" pattern, found in sequence across this session.

## Enrichment ideas

- Four independent hits on the identical class of gap (BUG-008, 011,
  012, 013) is enough of a pattern that it might be worth a structural
  fix rather than four separate patches — e.g. a lint rule, a shared
  wrapper around `core.X.update` that requires a paired timeline write,
  or a test that asserts every `PATCH`/status-change route has a
  corresponding audit entry. Worth raising as its own idea once all four
  bugs are actually fixed, rather than before — fixing them individually
  first confirms the right audit-row shape for each entity type.
- When the profile/settings page is eventually built, it's a natural
  place to also close the facility name/address audit gap (BUG-013) at
  the same time, since both are "editing your own organization's/
  account's basic info" from a user's perspective, even though they're
  different entities in the code.
