# Two-factor authentication (TOTP + email OTP + backup codes)

**Status:** Backend implemented and live-verified 2026-09-16/17. Frontend
(enrollment UI, sign-in second-factor prompt) implemented and live-verified
2026-09-19 — see "Frontend verification status" below.

## What this touches, in plain terms

- **A new better-auth plugin** (`twoFactor()`, vendored inside the already-
  installed `better-auth@1.6.11` package — no new auth dependency) mounted
  in `api/src/lib/auth.ts`.
- **One new DB table** (`twoFactor`: TOTP secret + backup codes per user)
  and **one new column** (`user.twoFactorEnabled`) — both owned by the
  plugin's own schema, not hand-designed.
- **A new `logins.status` value** (`two_factor_pending`) so a correct
  password that's still waiting on a second factor gets its own audit row
  instead of being misreported as a full success or dropped entirely.
- **8 new hand-wired Fastify routes** — this codebase has no better-auth
  catch-all mount and no client SDK (confirmed by reading
  `api/src/modules/authentication/service.ts` and `web/src/api/auth.ts` in
  full), so every plugin endpoint actually used needs its own route +
  handler wrapping `auth.api.<method>({asResponse: true, ...})`, same as
  every existing auth capability.
- **New email-sending infrastructure that doesn't exist today** — a
  Nodemailer + SMTP wrapper, pointed at a **Mailpit** container in dev (your
  call), needed because email OTP was chosen as one of the two second-factor
  methods.
- **Frontend**: an Account-settings 2FA enrollment flow (QR code + TOTP
  confirm, backup codes display, email-OTP option), and a sign-in-time
  second-factor step when `POST /sign-in` comes back `twoFactorRedirect:
  true` instead of a session.
- **No forced enrollment** — 2FA stays fully opt-in for every role, so
  there's no new gate added to `_authenticated.tsx` (unlike
  `must_change_password`/NDA, which do block access).

## Why this shape (context from investigation)

- `better-auth`'s `twoFactor` plugin already bundles TOTP, email/SMS-style
  OTP, and backup codes as three sub-plugins under one factory — confirmed
  by reading `better-auth/dist/plugins/two-factor/{index,schema,types}.d.mts`
  directly. No reason to hand-roll TOTP.
- `api/src/lib/auth.ts` imports `betterAuth` from `better-auth/minimal`, not
  the full package — checked `better-auth/minimal`'s own type signature
  (`dist/auth/minimal.d.mts`) and confirmed it accepts the exact same
  `BetterAuthOptions` (including `plugins: BetterAuthPlugin[]`) as full
  `betterAuth`. "Minimal" only means "without Kysely," not "without plugin
  support" — this was a real risk worth ruling out before designing around
  a plugin that might not have loaded.
- The plugin ships its own additive rate limit (`window: 10s, max: 3`,
  scoped to every `/two-factor/*` path) on top of this app's global
  `rateLimit` config in `auth.ts` — a 6-digit code isn't brute-forceable
  through the app's own endpoints without separately re-implementing this,
  so nothing extra is needed there.
- No email-sending infrastructure exists anywhere in this repo today — no
  `nodemailer`/`resend`/`aws-sdk` dependency, no `SMTP_*`/`MAIL_*` env var,
  and `auth.ts`'s own comment on the `verification` block already notes
  "nothing currently issues verification tokens." Choosing email OTP as a
  method is what pulls this in as new scope, not an incidental add-on.
- The forced-onboarding gate pattern already exists and works
  (`_authenticated.tsx`'s `beforeLoad` chain: status → must-change-password
  → NDA) and would have been the natural mechanism for mandatory 2FA — not
  used here since 2FA was scoped fully opt-in.
- `modules/account/service.ts`'s `acceptNda` handler already solved the
  "better-auth's session cookie-cache goes stale after a custom-field update
  outside a fresh sign-in" problem, via `auth.api.getSession({
  disableCookieCache: true })` + forwarding the fresh `Set-Cookie`. Enabling/
  disabling 2FA needs the exact same fix (`twoFactorEnabled` is
  session-cache-relevant the same way `nda_accepted_version` is) — reusing
  this pattern rather than rediscovering it.

## Decisions

1. **Enrollment is opt-in for every role.** No mandatory 2FA, no new
   `beforeLoad` gate. A user turns it on for themselves from Account
   settings.
2. **Two second-factor methods ship: TOTP (authenticator app) and email
   OTP.** Backup codes are generated alongside TOTP enrollment (the plugin
   requires an active method to issue them against) as the recovery path
   for a lost device. A user can have TOTP, email OTP, or both enabled;
   whichever they used most recently is offered first at sign-in, with a
   "try another method" fallback (`twoFactorMethods` in the sign-in
   redirect body tells the frontend what's available).
3. **Email OTP sends through Mailpit in dev**, via a plain SMTP transport
   (Nodemailer) so swapping to a real provider later (SES, etc.) in
   production is an env var change, not a code change. Mailpit itself never
   delivers real mail — this is dev/test-only infrastructure, and a real
   SMTP/API-based provider must be chosen before production use.
4. **Trust-device is on**, using the plugin's default
   `trustDeviceMaxAge` (30 days). A verified device gets a signed cookie
   that skips the second factor on that browser until it expires, the user
   signs out, or they revoke it from Account settings.
5. **`skipVerificationOnEnable` stays `false` (the plugin default).**
   Turning 2FA on isn't considered active until the user proves they can
   actually produce a valid code — closes the failure mode where someone
   scans a QR code wrong, believes 2FA is on, and locks themselves out (or
   worse, believes they're protected when they aren't).
6. **A new `LOGIN_STATUS` value, `two_factor_pending`, is added.** Today
   `signIn` logs `SUCCESS`/`FAILED` right after the password check. With
   2FA, a correct password against a 2FA-enabled account isn't a full login
   yet — the current shape would either misreport it as `SUCCESS` before
   the second factor is checked, or (if logging were deferred) silently
   drop the attempt if the user abandons or fails the second factor. Both
   are wrong for a security-audit table whose own docstring says it exists
   to "track attempts, not just successes." Instead:
   - Password correct + 2FA required → log `two_factor_pending` immediately.
   - Second factor verified → update that same row to `SUCCESS` (mirrors
     how `signOut` already finds "the most recent open row" for a user).
   - Second factor fails: **discovered during implementation** — better-auth
     deliberately doesn't expose *whose* attempt just failed to a
     verify-totp/verify-backup-code/verify-otp caller (the pending user's
     identity lives only in its own signed two-factor cookie, not something
     my handler can read) — by design, so a wrong-code response can't be
     used to enumerate accounts. That means a failed attempt can't be
     resolved to `FAILED` at the moment it happens. Instead, `signIn`
     itself — which does know the user's id — sweeps that same user's own
     stale `two_factor_pending` rows (older than the plugin's
     `twoFactorCookieMaxAge`, i.e. definitely expired) to `FAILED` before
     processing a new attempt. A user who fails/abandons 2FA and never
     tries again keeps one row honestly stuck at `two_factor_pending`
     (correct, if slightly incomplete — it did stay pending) rather than a
     fabricated `FAILED` outcome the system never actually observed.
7. **Migration is required this time** (unlike auto-assignment) — new
   `two_factor_enabled` column, new `twoFactor` table, and an enum change on
   `logins.status`. Per this repo's pre-release convention, the migrations
   folder gets collapsed and regenerated fresh rather than layering a new
   migration file on top.
8. **Resolved, updating the earlier draft of this decision:** the plugin
   does support remapping its schema to snake_case after all — its
   `twoFactor()` factory takes its own `schema` option
   (`{ user: { fields: { twoFactorEnabled: "two_factor_enabled" } },
   twoFactor: { modelName: "two_factor", fields: { secret: "secret",
   backupCodes: "backup_codes", userId: "user_id", verified: "verified" } }
   }`), confirmed by reading `InferOptionSchema`'s actual type
   (`better-auth/dist/types/plugins.d.mts`) — a plain `{ field: "column" }`
   map, the same mechanism `auth.ts` already uses for `emailVerified` →
   `"verified"`. So this codebase's snake_case convention is kept fully
   intact for the new table/column; no exception needed.

## Explicitly out of scope (flagged, not silently dropped)

- SMS-based OTP (the plugin supports a generic `sendOTP` hook that email
  reuses, but no SMS provider was requested).
- Mandatory/role-gated enrollment — fully opt-in only, per your call. Easy
  to add later by reusing the `_authenticated.tsx` gate pattern if you want
  to revisit this.
- A real (non-Mailpit) email provider — needs to be chosen and configured
  before production use; out of scope for this pass.
- Admin-forced 2FA reset for a user who's locked themselves out (lost
  device + lost backup codes) — today that would require direct DB
  intervention. Worth a follow-up if this becomes a real support burden;
  parking in `docs/backlog.md` rather than building speculatively now.

## Technical touchpoints (for implementation)

- **`api/package.json`** — add `nodemailer` (+ `@types/nodemailer`).
- **`api/src/lib/env.ts`** — add `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`
  (defaulted for Mailpit: `mailpit` / `1025` / a no-reply address), following
  the existing `.default().transform(Number)` pattern used for
  `RATE_LIMIT_*`.
- **`compose.yml`** — new `referral-tracking-mailpit` service
  (`axllent/mailpit:latest` image), cross-checked against the working
  Mailpit setup in `transaction-despute-portal/compose.yml`:
  - `ports: ["1025:1025", "8025:8025"]` — unlike that project, this repo has
    no nginx proxy layer in front of its services, so the web UI (`:8025`)
    needs a direct host port mapping to actually be reachable in a browser
    for verifying a sent OTP email; their setup routes it through nginx
    instead and only `expose`s it internally.
  - `networks.referral-tracking.aliases: [mailpit]` — without this, the
    service's real Compose name (`referral-tracking-mailpit`) is what
    resolves on the network, not the short `mailpit` hostname the env
    defaults below assume. Their compose file sets the same alias for the
    same reason.
  - No volume needed (dev-only, ephemeral).
- **`env/development/.env.api`** (and `env/staging/.env.api`) — the new
  `SMTP_*` vars: `SMTP_HOST` (default `mailpit`), `SMTP_PORT` (default
  `1025`), `SMTP_USER`/`SMTP_PASS` (default empty — Mailpit needs no auth,
  but keeping the vars means swapping to a real provider later is a
  config-only change), `SMTP_FROM`.
- **`api/src/lib/mailer.ts`** (new) — a thin Nodemailer wrapper, modeled
  directly on `transaction-despute-portal/api/src/lib/mailer.ts`
  (`createTransport` with conditional `auth` only when `SMTP_USER` is set;
  `sendEmail` catches and logs send failures rather than throwing, so a
  transient SMTP hiccup can't fail the request calling it — matters here
  since it'll be called from the `send-otp` endpoint). Used only by the OTP
  send hook below.
- **`api/src/drizzle/schema/user.ts`** — add `two_factor_enabled` boolean
  column (actual name `twoFactorEnabled` per decision #8), default `false`.
- **`api/src/drizzle/schema/two-factor.ts`** (new) — `TwoFactorModel`:
  `id`, `secret`, `backupCodes`, `userId` (FK → user), `verified`.
- **`api/src/drizzle/schema/index.ts`** — export the new model.
- **`shared/src/constant.ts`** — add `LOGIN_STATUS.TWO_FACTOR_PENDING`; add
  the 8 new `API_PATHS` entries (`TWO_FACTOR_ENABLE`, `_DISABLE`,
  `_GET_TOTP_URI`, `_VERIFY_TOTP`, `_VERIFY_BACKUP_CODE`,
  `_GENERATE_BACKUP_CODES`, `_SEND_OTP`, `_VERIFY_OTP`).
- **`shared/src/schema/`** — new request/response schemas for each endpoint
  (password-confirm for enable/disable/get-uri/generate-codes; code +
  optional `trustDevice` for the three verify endpoints); extend
  `SessionResponse`/`AuthUserResponse` with `two_factor_enabled: boolean`.
- **`api/src/lib/auth.ts`** — import `twoFactor` from
  `better-auth/plugins`, add it to a new `plugins: [...]` array with
  `issuer: APP_NAME`, `trustDeviceMaxAge` left at plugin default,
  `otpOptions.sendOTP` calling the new mailer, `skipVerificationOnEnable:
  false`; register `TwoFactorModel` in the `drizzleAdapter`'s `schema`
  object alongside `user`/`account`/`session`/`verification`.
- **`api/src/modules/authentication/service.ts`** — `signIn` rework: after
  `signInEmail`, inspect the response body for `twoFactorRedirect`; log
  `two_factor_pending` instead of `SUCCESS` in that case (decision #6). New
  handlers `twoFactorVerifyTotp`, `twoFactorVerifyBackupCode`,
  `twoFactorSendOtp`, `twoFactorVerifyOtp` — unauthenticated-context routes
  (no app session yet, they run off the plugin's own short-lived two-factor
  cookie), each resolving the pending `logins` row to `SUCCESS`/`FAILED` on
  completion, mirroring `signOut`'s "find the most recent open row" query.
- **`api/src/modules/authentication/route.ts`** — mount the 4 routes above
  at top level (no `app.authenticate`), matching `sign-in`/`sign-up`.
- **`api/src/modules/account/service.ts`** — new handlers
  `twoFactorEnable`, `twoFactorDisable`, `twoFactorGetTotpUri`,
  `twoFactorGenerateBackupCodes` — authenticated-context (`app.authenticate`
  only, same as every other self-service account route), each re-issuing a
  fresh session cookie via `getSession({ disableCookieCache: true })`
  afterward per decision context above, since `twoFactorEnabled` is
  session-cache-relevant.
- **`api/src/modules/account/route.ts`** — mount the 4 routes above.
- **`web/src/api/auth.ts`** / **`web/src/api/account.ts`** — client
  functions for all 8 endpoints.
- **Frontend**: Account settings gets a 2FA section (enroll TOTP w/ QR,
  enroll email OTP, view/regenerate backup codes, disable, manage trusted
  devices). Sign-in page handles a `twoFactorRedirect` response by prompting
  for a code instead of treating it as a failed login.
- **Migrations** — `rm -rf` the migrations folder, regenerate fresh once
  the schema changes above land, per this repo's convention.

## Open items for review

- The exact list of `SMTP_*` env var names/defaults above is a proposal, not
  fixed — say if you want different names or additional ones (e.g. a
  separate `SMTP_FROM_NAME`).

## Verification status

Backend applied via haiku delegate, independently verified file-by-file via
`git diff` against the exact spec (per this repo's delegation convention) —
one deviation found and corrected: the delegate added a necessary but
initially-wrong `two_factor_enabled` mapping to `session()`'s response
(fixed: needed the plugin's canonical camelCase `twoFactorEnabled`, not the
remapped snake_case DB column name — those are two different things, only
one of which is a property key on better-auth's own session-user object).

Migrations collapsed and regenerated fresh per convention. Applying them
against the existing dev DB required a full `db:reset` (confirmed with you
first) — the collapsed single migration can't cleanly re-run against a
database that already had the old schema applied; not a defect in the new
migration itself.

Three real bugs were caught only by live end-to-end testing — typecheck
passed cleanly on all of them, since they're all runtime/config-shape
mismatches, not type errors:

1. **Model-name mismatch**: `twoFactor()`'s `schema.twoFactor.modelName:
   "two_factor"` override changed the internal lookup key better-auth uses
   for that table, but the `drizzleAdapter`'s own schema map was still keyed
   `twoFactor`. The physical MySQL table name is controlled independently
   by `mysqlTable("two_factor", ...)` in the schema file, so the
   `modelName` override was both unnecessary and broken — removed.
2. **Response-schema mismatch**: `enable`/`get-totp-uri`/
   `generate-backup-codes` forward better-auth's raw flat response body
   (`{totpURI, backupCodes}`) via `forwardAuthResponse`, but their Fastify
   routes declared a `response: {200: ...}` schema expecting this app's
   usual `{code, message, data}` envelope, which never matched — every
   call 500'd with `FST_ERR_RESPONSE_SERIALIZATION`. Fixed by removing the
   response schema declaration on those 3 routes, matching the existing
   `signUp`/`signIn`/`signOut` precedent (raw-forwarding routes don't
   declare one).
3. **Disable silently logged the user out**: `disableTwoFactor` rotates the
   session internally (issues a fresh token, deletes the old one) as part
   of turning 2FA off, and its own response already carries the correct new
   cookie. The handler ignored that and made a second `getSession()` call
   using the request's original headers — which by then referenced an
   already-deleted token, so better-auth correctly reported "no session"
   and sent a cookie-clearing header. Fixed by forwarding `disableTwoFactor`'s
   own response cookies directly instead of re-querying.

Live-verified end to end against the API-only container (existing seeded
`doctor@gmail.com` account, cleaned back to a 2FA-disabled baseline
afterward):

- **Enable → confirm**: `POST enable` returns a TOTP URI + 10 backup codes;
  confirming with a freshly-computed TOTP code flips `user.two_factor_enabled`
  to `1` in the DB and creates the `two_factor` row.
- **`GET /session` reflects it immediately** (`two_factor_enabled: true`),
  no stale-cookie-cache issue.
- **Sign-in second factor**: a correct password against the now-2FA'd
  account returns `{twoFactorRedirect: true, twoFactorMethods: ["totp",
  "otp"]}` instead of a session, and logs a `two_factor_pending` row.
  Completing with a fresh TOTP code returns a full session token and
  resolves that same `logins` row to `success`.
- **Wrong code**: `verify-totp` with an incorrect code returns `401
  INVALID_CODE` cleanly, no crash, no stuck state.
- **Backup code**: `verify-backup-code` with one of the issued codes
  completes sign-in identically to TOTP.
- **Email OTP**: `send-otp` actually delivers a real email through the
  Mailpit container (confirmed via Mailpit's own API — correct subject,
  correct 6-digit code in the body); `verify-otp` with that code completes
  sign-in.
- **Disable**: turns 2FA off, deletes the `two_factor` row, and (after the
  fix above) correctly preserves the caller's session rather than logging
  them out.
- **`get-totp-uri`** and **`generate-backup-codes`**: both return correctly
  shaped data with a valid password.

Not separately exercised: the stale-pending-login sweep (`resolveStalePendingLogins`)
actually firing after a real 10-minute wait (verified by reading the code
and confirming the query logic against the schema, not by waiting out the
window); rate limiting on the `/two-factor/*` paths (the plugin's own
`window: 10s, max: 3` — trusted as built-in, not independently hammered).

## Frontend verification status

Implemented 2026-09-19: a new `/settings` route (Account Settings shell,
reachable from the sidebar profile dropdown — no general profile/password
sections yet, see `docs/backlog.md`'s self-service password change entry
for that fast-follow) hosting a 2FA section (enable/QR/backup codes/
disable/regenerate), plus the sign-in page's second-factor step (method
picker, email-OTP send/verify, backup-code fallback, trust-device
checkbox). Client functions added to `web/src/api/auth.ts` (4,
unauthenticated/two-factor-cookie) and `web/src/api/account.ts` (4,
authenticated). New dependency: `qrcode.react` (QR rendering).

Also fixed in this pass: `shared/src/schema/account.ts`'s
`twoFactorEnable`/`GetTotpUri`/`GenerateBackupCodes` response schemas were
still typed as this app's `{code, message, data}` envelope, left over from
before the backend's "Response-schema mismatch" bug fix (see above) — the
actual routes forward better-auth's raw flat bodies. Corrected to match
reality; this was dead/misleading code, not a live bug (nothing consumed
those types yet), caught while building the frontend client against them.

Live-verified end to end against the full Docker Compose stack (API + web
+ Mailpit), using the seeded `doctor@gmail.com` account, cleaned back to a
2FA-disabled baseline afterward:

- **Enable → confirm**: password dialog → QR code renders (via
  `qrcode.react`) → backup codes display → confirming with a real
  authenticator-app-equivalent TOTP code (computed client-side via
  `crypto.subtle` HMAC-SHA1 from the QR's `otpauth://` URI, never exposing
  the raw secret) enables 2FA and refreshes the session.
- **Sign-in second factor — all three paths exercised**: TOTP (via the
  enrollment-confirm path, same `twoFactorVerifyTotp` function), backup
  code (consumed one of the issued codes, landed on the dashboard), and
  email OTP (code retrieved from Mailpit's own API, `send`/`verify` both
  round-tripped correctly).
- **Trust this device**: checked during an OTP sign-in; the next sign-in
  with the same browser skipped the second-factor prompt entirely,
  confirming the trusted-device cookie set by `forwardAuthResponse` is
  honored — not exercised in the backend-only pass, closes that gap.
- **Regenerate backup codes** and **Disable**: both password-confirm
  dialogs work; disable correctly preserves the session (no unexpected
  sign-out) and reverts the Settings UI to the disabled state.
- **Settings nav entry**: added to the sidebar's profile dropdown (above
  Sign out), renders and navigates correctly.

Not separately exercised live: the "View QR code" (`get-totp-uri`)
dialog's own button click — spot-checked via code review only (identical
`PasswordConfirmDialog`-adjacent structure to the already-verified
regenerate-codes dialog, different endpoint).

One dev-environment issue hit and fixed along the way, unrelated to the
app code: the Docker Compose `web` container's `node_modules` (a separate
named volume from the host) didn't pick up the new `qrcode.react`
dependency via a plain `pnpm install` inside the container — pnpm reported
"already up to date" without actually linking the package, even after
clearing `.modules.yaml` and the directory contents. Fixed with
`pnpm add qrcode.react@4.2.0` run inside the container's `web/` workspace,
which forced the actual link (no lockfile/package.json drift — the
version already matched what was on the host).
