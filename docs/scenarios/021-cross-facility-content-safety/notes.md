# 021 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. This is a code-level rendering/config audit (grepping
for dangerous render patterns and checking a header's scope) rather than
a UI flow — there's no live payload worth demonstrating since the
rendering path is confirmed clean today. Not a good candidate for a
recording even later, since a CSP gap and a missing length cap aren't
visually demonstrable in the way a UI bug is.

## Related

- Backlog: [The strict CSP only covers the API origin, not the web
  frontend where it would actually matter, and free-text fields have no
  length/content
  limits](../../backlog.md#the-strict-csp-only-covers-the-api-origin-not-the-web-frontend-where-it-would-actually-matter-and-free-text-fields-have-no-lengthcontent-limits) —
  full write-up, file:line detail, and open questions.
- Related scenario: [019 — Brute-force and account-takeover
  resistance](../019-brute-force-protection/scenario.md) — the other
  security-focused pass this session; together they cover
  authentication/account security and content-injection safety as the
  two main non-permission-model security angles checked.

## Enrichment ideas

- If a reverse proxy or edge layer is ever added in front of both
  services (not present in this repo today), confirming it applies an
  equivalent CSP to the web origin would close this gap without needing
  a web-app-level change.
- Worth a periodic re-check of this scenario whenever a new
  rich-text/markdown feature is proposed anywhere in the app (release
  notes, referral attachments, etc.) — that's exactly the kind of change
  that could reintroduce a real rendering gap behind a CSP that, per this
  finding, currently wouldn't catch it.
- A useful automated check going forward: a lint rule or CI grep that
  fails if `dangerouslySetInnerHTML` is ever added to `web/src` outside
  the one existing, reviewed instance in `__root.tsx` — cheap tripwire
  against regression on the one thing keeping this clean today.
