# 021 — Cross-facility free-text content safety

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Referrals, Patients, Appeals, Transfers, Audit
**Last reviewed:** 2026-08-16

## Use case

A Nurse at one facility writes a referral reason, a status note, or an
appeal explanation. A Doctor or Manager at a completely different
organization — one that doesn't share staff, infrastructure, or trust
with the first — later reads it on their own screen. Multi-tenant
free-text fields like this are a classic place for one organization's
input to end up rendered in another's browser.

## Problem

Any field one user writes and a different, less-trusted-by-default user
later views is a potential stored-content-injection vector — if the
rendering path ever treats that text as markup instead of plain text, a
malicious or careless entry from one facility could execute in another
facility's session. Even when the rendering itself is safe today, the
backstops that would catch a *future* mistake matter just as much as the
current behavior.

## Solution

The core rendering path is clean. Every free-text field checked —
referral `visit_reason`/`referral_reason`, status and redirect `notes`,
moderation and appeal `reason`, patient `address` — is rendered
everywhere it appears (referral detail, patient medical history,
appeals, transfers, the audit log) via plain JSX text interpolation,
which React auto-escapes by default. The only `dangerouslySetInnerHTML`
in the entire frontend is a hardcoded, developer-authored theme-init
script, not user data — no markdown or HTML-rendering library touches
any of these fields. SQL injection surface is equally clean: the
free-text search/filter paths (referral-reason search, patient
name/phone search) route through Drizzle's parameterized query builder,
never raw string-built SQL.

One real gap sits behind that otherwise-clean picture: the app does have
a strict, well-formed Content-Security-Policy (`script-src 'self'`, no
inline scripts allowed) — but it's registered only on the API service,
a separate origin from the web frontend that actually serves and runs
the React app where any future XSS would need to execute. The web
frontend has no CSP of its own. So today's safety rests entirely on
"the rendering code happens to be correct everywhere," with no second
layer of defense positioned to catch it if that ever stops being true.
Free-text fields also have no server-side length cap, which isn't
exploitable on its own but is one more defense-in-depth layer this app
doesn't currently have. Full detail in [The strict CSP only covers the
API origin, not the web frontend where it would actually matter, and
free-text fields have no length/content
limits](../../backlog.md#the-strict-csp-only-covers-the-api-origin-not-the-web-frontend-where-it-would-actually-matter-and-free-text-fields-have-no-lengthcontent-limits).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Free-text fields render as plain text everywhere, not interpreted as HTML | Traced every render site for `visit_reason`/`referral_reason`/notes/reason/`address` | ✅ Confirmed, 2026-08-16 |
| 2 | `dangerouslySetInnerHTML` or a markdown/HTML renderer touches user content anywhere | Grepped the entire frontend | ✅ Confirmed clean, 2026-08-16 — only hit is a static, non-user-controlled theme script |
| 3 | Free-text search/filter queries are parameterized, not raw SQL | Read `buildWhere`'s `contains` operator and its callers | ✅ Confirmed clean, 2026-08-16 |
| 4 | The app's CSP applies to the origin that actually renders user content | Read the CSP registration and the API/web port and CORS split | ❌ Confirmed it doesn't, 2026-08-16 — CSP is API-only, web frontend has none |
| 5 | Free-text fields have a server-side length cap | Read the base `stringSchema` and every field built on it | ❌ Confirmed absent, 2026-08-16 |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
