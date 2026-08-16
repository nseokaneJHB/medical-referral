# 019 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. Demonstrating this live would mean actually running a
brute-force attempt against a real or seeded account, which isn't
appropriate to do even in a disposable dev environment without a clear
reason beyond confirming what the code already makes unambiguous. The
code citations in `scenario.md` are the evidence here.

## Related

- Backlog: [No per-account brute-force protection on sign-in, and cookie
  security flags depend on `NODE_ENV` being set
  correctly](../../backlog.md#no-per-account-brute-force-protection-on-sign-in-and-cookie-security-flags-depend-on-nodeenv-being-set-correctly) —
  full write-up, file:line detail, and open questions.
- Related scenario: [017 — Password recovery and reset
  security](../017-password-recovery/scenario.md) — the other half of
  this account-security investigation (recovery/reset), done in the
  prior pass.

## Enrichment ideas

- If per-account lockout is ever added, it should be designed alongside
  the still-parked [Self-service password change (+ profile/settings
  page)](../../backlog.md#self-service-password-change--profilesettings-page)
  work — a lockout with no self-service recovery path would make a
  locked-out legitimate user entirely dependent on an Administrator,
  compounding rather than solving a usability gap.
- Worth confirming empirically, in a disposable environment only, what
  `NODE_ENV` this project's actual deployed environment (not local dev)
  runs under — the backlog entry's cookie-flag finding is about a
  silent misconfiguration risk, and knowing today's actual value would
  say whether it's currently latent or already live.
- A worthwhile follow-up once any fix lands: confirm whether better-auth
  supports a `customRules`-style per-endpoint rate limit override (the
  research surfaced that its `rateLimit` config currently mirrors the
  same IP-only global limit) — if so, a stricter, email-aware rule
  scoped to just the sign-in endpoint might be a smaller change than a
  fully custom lockout mechanism.
