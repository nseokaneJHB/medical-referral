# 016 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. Both open findings require a state the live app
cannot currently produce (an orphaned `specialty_id`, or a
case-insensitive duplicate slipping past the app check depending on DB
collation) — there's nothing to demonstrate live yet. The
correctly-working rename/delete-block behavior is also better shown by
the code citations than a screen recording of "nothing happened."

## Related

- Backlog: [Specialty lifecycle has two small latent gaps: an orphan-link
  crash trap and case-insensitive duplicate
  names](../../backlog.md#specialty-lifecycle-has-two-small-latent-gaps-an-orphan-link-crash-trap-and-case-insensitive-duplicate-names) —
  full write-up, file:line detail, and open questions.

## Enrichment ideas

- The orphan-crash trap could actually be reproduced in a disposable dev
  database (manually delete a referenced `specialties` row via direct
  SQL, bypassing the app, then fetch that facility/user/referral's
  specialty list and confirm the 500) — worth doing once, carefully, in
  a throwaway environment to turn "traced through code" into "confirmed
  live," without touching real seed data.
- Worth checking what MySQL collation this project's Docker image
  actually defaults to (`SHOW TABLE STATUS LIKE 'specialties'` or
  `SHOW CREATE TABLE specialties`) to know today, empirically, whether
  the case-insensitive duplicate gap is currently masked by the DB layer
  or not — the code-level analysis couldn't determine this without
  reading the actual deployed schema.
- If the orphan-crash trap is ever hardened, a good general principle to
  apply codebase-wide: check whether any other non-nullable Zod response
  field is fed by a `buildRelations` one-relation lookup that can return
  `null` on a miss — this specific combination might not be unique to
  specialties.
