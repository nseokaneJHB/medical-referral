# 025 — Email verification and signup identity assurance

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Auth, Users

**Last reviewed:** 2026-08-16

## Use case

Someone fills out the sign-up form, claiming a name, role, facility, and
email address. A Manager or Administrator later reviews that pending
application and decides whether to approve it — trusting, among other
things, that the email address belongs to the person who typed it.

## Problem

An approval step is only as good as the information the approver can
trust. If the email address on a signup was never actually confirmed to
belong to the person providing it — a typo, someone else's address, or a
made-up one — the approving Manager has no way to know that, and the
system has silently skipped a basic identity-assurance step that most
account systems treat as standard.

## Solution

This continues the account-security thread from [017 — Password recovery
and reset security](../017-password-recovery/scenario.md) and
[019 — Brute-force and account-takeover
resistance](../019-brute-force-protection/scenario.md): the same pattern
found there (a better-auth capability that exists in the library but was
never wired up in this app) recurs here for email verification.

better-auth's email-verification support is present but unconfigured —
no `requireEmailVerification` flag, no `sendVerificationEmail` callback,
same absence shape as the missing password-reset email flow. The
`verification` table exists in the schema purely as unused scaffolding,
per the codebase's own comment confirming nothing currently issues a
verification token. `signUp` takes the submitted email at face value and
passes it straight through to account creation; the subsequent
Manager/Administrator approval step checks status, role, and facility
conflicts, but never the email's authenticity — the human approver is
vetting the human-readable parts of the application, not whether the
email is real. Full detail in [No email verification at signup — an
account activates on an unverified email
address](../../backlog.md#no-email-verification-at-signup--an-account-activates-on-an-unverified-email-address).

Two related findings from the same investigation are folded into the
existing [brute-force backlog
entry](../../backlog.md#no-per-account-brute-force-protection-on-sign-in-and-cookie-security-flags-depend-on-nodeenv-being-set-correctly)
rather than repeated here, since they're the same "no guardrail against
a deployment mistake" shape as that entry's `NODE_ENV` finding:
`CORS_ORIGIN` has no format validation of its own, and it feeds both
`@fastify/cors` (with `credentials: true`) and better-auth's
`trustedOrigins`, so a misconfigured value would extend trust to
CSRF-sensitive auth endpoints on top of general API access.

Separately, this investigation re-confirmed (not a new finding) that
referral specialty tags are purely descriptive with zero enforcement
anywhere in create/assign/redirect — already fully documented in
[005 — Wrong-specialty referral](../005-wrong-specialty-referral/scenario.md)
and its backlog entry.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Email verification is required before an account can be approved | Read the `emailAndPassword` config and the approval handlers | ❌ Confirmed absent, 2026-08-16 |
| 2 | A verification email is ever sent | Grepped for `sendVerificationEmail` and any use of the `verification` table | ❌ Confirmed absent, 2026-08-16 — unused scaffolding only |
| 3 | The approving Manager/Administrator sees any signal about email verification status | Read `managerApprove`/`staffApprove` in full | ❌ Confirmed absent, 2026-08-16 — no such signal exists |
| 4 | `CORS_ORIGIN` is validated as a well-formed origin, not an arbitrary string | Read the env schema and its use in `@fastify/cors`/better-auth | ❌ Confirmed unvalidated, 2026-08-16 — folded into the existing brute-force backlog entry |
| 5 | Referral specialty tags are enforced against facility/doctor specialties | Re-checked `referralCreate`/`referralAssign`/`referralRedirect` | ❌ Re-confirmed absent, 2026-08-16 — already documented in scenario 005, no new finding |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
