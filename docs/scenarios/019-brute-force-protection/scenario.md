# 019 — Brute-force and account-takeover resistance

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Auth
**Last reviewed:** 2026-08-16

## Use case

Someone tries to get into an account that isn't theirs — a disgruntled
ex-colleague who knows a username, or an automated attempt running a
leaked password list against the app's user base. Nothing about this
requires a mistake by the account holder; the system itself needs to make
repeated guessing expensive or impossible.

## Problem

Password hashing alone (however strong) only slows down an attacker who
already has the password hash — it does nothing to limit how many live
guesses a remote attacker can make against the sign-in endpoint itself.
That's a separate control, and a real-world attacker will always prefer
the cheaper option: guessing through the front door repeatedly, rather
than trying to crack a hash they don't have.

## Solution

This builds directly on [017 — Password recovery and reset
security](../017-password-recovery/scenario.md): the two areas share the
same underlying account-security surface.

The only sign-in throttling in the app is a single, global rate limit —
`@fastify/rate-limit` registered with no per-route override, falling back
to its default per-IP key: 5 requests per 60 seconds, shared across every
route in the entire API, not just sign-in. It has no email/account
dimension: trying 5 different accounts from one IP and trying one account
5 times consume the exact same budget. There is no per-account lockout,
failure counter, or CAPTCHA anywhere — `signIn` checks the password
statelessly on every call, and while every failed attempt against a known
email is written to the `logins` audit table, nothing ever reads that
history back to affect a future attempt. Full detail in [No per-account
brute-force protection on sign-in, and cookie security flags depend on
`NODE_ENV` being set
correctly](../../backlog.md#no-per-account-brute-force-protection-on-sign-in-and-cookie-security-flags-depend-on-nodeenv-being-set-correctly).

Net effect: an attacker distributing guesses across enough source IPs
faces no effective limit against one targeted account, since the limit
resets per IP. The `logins` table itself was checked as a possible side
channel (does its presence/absence of rows for an email leak whether that
email exists) and confirmed not to be a meaningful one — it's
Administrator-only to read, and an Administrator already has full,
direct visibility into the user list regardless.

Session cookies are otherwise handled well — `httpOnly` is unconditionally
set — but `secure` and strict `sameSite` are conditional on `NODE_ENV
=== "production"` with no deploy-time check enforcing that, which is a
related, separate configuration-risk finding folded into the same backlog
entry.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | The sign-in rate limit is keyed per-account, not just per-IP | Read the `@fastify/rate-limit` registration and its key generator | ❌ Confirmed IP-only, 2026-08-16 |
| 2 | A burst of failed attempts against one account triggers any lockout | Read `signIn` in full, and the `user`/`account` schemas for a lockout column | ❌ Confirmed absent, 2026-08-16 |
| 3 | The `logins` audit table is read back to influence future sign-in decisions | Grepped for any read of `logins` outside the Administrator audit page | ❌ Confirmed absent, 2026-08-16 — pure audit record only |
| 4 | The `logins` table leaks whether an email exists to anyone below Administrator | Read the audit route's role gate and the table's write condition | ✅ Confirmed not a meaningful new leak, 2026-08-16 — Administrator-only, redundant with existing user-list access |
| 5 | Session cookies set `httpOnly`, `secure`, and `sameSite` correctly | Read both the Fastify cookie plugin and better-auth's cookie config | ⚠️ Confirmed `httpOnly` always on; `secure`/strict `sameSite` conditional on `NODE_ENV`, 2026-08-16 |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
