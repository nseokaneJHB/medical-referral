# 017 — Password recovery and reset security

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Users, Auth
**Last reviewed:** 2026-08-16

## Use case

A Nurse, Doctor, or Manager forgets their password and can't sign in.
Someone needs to get them back into their account — and separately, if an
account is ever reset because it might be compromised (not just
forgotten), that reset needs to actually cut off whatever access the
compromise already achieved, not just change the password going forward.

## Problem

Account recovery sits at the intersection of usability and security: too
little self-service and every forgotten password becomes an
Administrator's problem; too little rigor around what a reset actually
does (session handling, audit trail) and a "security" reset doesn't
actually secure anything.

## Solution

There is no self-service path at all today — recovery is entirely
Administrator-mediated. `userResetPassword`
(`api/src/modules/administrator/service.ts:707-753`) requires no
verification of the target's old password, generates a fresh
cryptographically random temporary password (`generateTemporaryPassword`,
`api/src/lib/util.ts:52-53`), hashes it via the project's standard Argon2id
path (`api/src/lib/password.ts`), and sets `must_change_password: true` on
the user. This half of the picture is already fully tracked in [Self-service
password change (+ profile/settings
page)](../../backlog.md#self-service-password-change--profilesettings-page):
that flag is never actually enforced or actionable anywhere, so the
Administrator-generated temporary password silently becomes the account's
permanent password with no way for the recipient to ever set their own.

Two adjacent findings from this pass, not previously tracked, folded into
the same backlog entry as an addendum rather than split out:

- **A password reset doesn't end existing sessions.** If the reset is
  happening because an account may be compromised, whatever session an
  attacker already holds keeps working — the reset changes future
  sign-ins, not current ones.
- **The reset isn't written to the persisted, queryable audit trail** —
  only to the ephemeral structured request log — so there's no way to
  later answer "who reset this account's password, and when" from inside
  the app itself.

Password hashing itself is solid throughout: every credential-writing
path — sign-up, sign-in, admin-created accounts, and admin resets — routes
through the project's Argon2id functions
(`api/src/lib/password.ts`), never better-auth's default hasher. Rate
limiting is also in place globally (`@fastify/rate-limit`, 5 requests per
60 seconds) across every route, sign-in included.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A self-service "forgot password" flow exists | Searched `api/src`/`web/src` for reset routes, UI, and better-auth config | ❌ Confirmed absent, 2026-08-16 — better-auth's reset endpoints are configured but never activated (no `sendResetPassword` callback) |
| 2 | Admin password reset requires the old password | Read `userResetPassword` | ❌ Confirmed not required, 2026-08-16 |
| 3 | Admin-set/reset passwords route through Argon2id, not better-auth's default hasher | Traced every credential-writing call site | ✅ Confirmed, 2026-08-16 |
| 4 | A password reset invalidates the target's other active sessions | Read `userResetPassword` and the `session` table/schema | ❌ Confirmed absent, 2026-08-16 — sessions untouched |
| 5 | A password reset is recorded in the queryable audit trail | Grepped `administrator/service.ts` for `timeline.create` | ❌ Confirmed absent, 2026-08-16 — only an ephemeral request-log event name is set |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
