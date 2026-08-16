# 025 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This is a config/code absence check (confirming a
better-auth feature was never enabled) rather than a UI flow — there's
no verification screen to demonstrate since none exists.

## Related

- Backlog: [No email verification at signup — an account activates on an
  unverified email
  address](../../backlog.md#no-email-verification-at-signup--an-account-activates-on-an-unverified-email-address) —
  full write-up, file:line detail, and open questions.
- Backlog addendum: [No per-account brute-force protection on
  sign-in...](../../backlog.md#no-per-account-brute-force-protection-on-sign-in-and-cookie-security-flags-depend-on-nodeenv-being-set-correctly) —
  the `CORS_ORIGIN` validation gap found in the same pass was added here
  rather than as a new entry, since it's the same "no guardrail against
  a deployment mistake" shape as that entry's `NODE_ENV` finding.
- Related scenario: [017 — Password recovery and reset
  security](../017-password-recovery/scenario.md) — the sibling
  better-auth-capability-never-wired-up gap (password reset instead of
  email verification).
- Related scenario: [005 — Wrong-specialty
  referral](../005-wrong-specialty-referral/scenario.md) — re-confirmed,
  not newly found, during this pass.

## Enrichment ideas

- If email verification and self-service password reset are ever
  scoped together (both need a mailer), this is worth planning as one
  piece of infrastructure work rather than two separate features that
  each independently need "how do we send email from this app" solved.
- Worth deciding whether verification should be retroactively required
  for already-approved accounts, or only apply going forward — a
  from-here-on policy is much simpler to implement than a migration that
  has to handle every existing account's unverified state.
- A useful low-effort interim step, if full email verification is out of
  scope for now: just surfacing "not verified" as a visible signal on the
  pending-approval screen, without necessarily blocking anything — gives
  the approving human more informed judgment at near-zero implementation
  cost.
