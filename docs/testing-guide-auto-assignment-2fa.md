# Testing guide: `feat/auto-assignment-and-2fa-backend`

This branch adds automatic doctor assignment for referrals and two-factor authentication. It also refactors `api/src/core` and `api/src/management` into `api/src/repository`, so the existing app needs a regression pass. Design docs are `docs/auto-assignment.md` and `docs/2fa.md`.

Steps marked **Observe** mean: record what happens. The expected result was not verified from the code.

## Part 0. Setup

1. Sign out of the app in your browser and close the tab, then run `docker compose down`.
2. Run `git fetch && git checkout feat/auto-assignment-and-2fa-backend && git pull`.
3. Run `pnpm infra:build`. New dependencies are `nodemailer` (api) and `qrcode.react` (web), so rebuild the images.
4. Run `docker compose up -d`, then `docker compose ps`. Four services should be up, including the new `referral-tracking-mailpit`. Mailpit publishes host ports 1025 and 8025, so both must be free.
5. Run `pnpm db:reset` and then `pnpm db:seed`. The schema changed (new `two_factor` table, `user.two_factor_enabled` column, new `logins.status` value `two_factor_pending`), and migrations are not tracked in git. The reset regenerates them.
6. Confirm the schema in the database. Connection details are user `root`, password `secret`, database `referral-tracking`, host port 3306. Using the container:
   ```
   docker compose exec referral-tracking-database mysql -uroot -psecret referral-tracking
   ```
   Then run:
   ```
   SHOW TABLES;
   SHOW COLUMNS FROM user LIKE 'two_factor_enabled';
   SHOW COLUMNS FROM logins LIKE 'status';
   ```
   You should see a `two_factor` table, the `two_factor_enabled` column, and `two_factor_pending` in the `logins.status` enum.
7. Check the API started cleanly with `docker compose logs referral-tracking-api`.

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:8080 |
| Mailpit inbox | http://localhost:8025 |
| Mailpit SMTP from host | localhost:1025 |

Seed logins: `administrator@gmail.com`, `manager@gmail.com`, `nurse@gmail.com` and `doctor@gmail.com`, all with `Password@123`. If a login sends you to change-password or `/accept-nda`, complete that first.

Tables you'll query: `referrals` (columns `id`, `status`, `doctor`, `destination_facility_id`), `timeline`, `logins`, `user` (columns `role`, `status`, `facility_id`, `two_factor_enabled`), `two_factor`, `referral_specialties`, `user_specialties`, `specialties`. Status and role values are uppercase (`PENDING`, `ACCEPTED`, `DOCTOR`).

## Part 1. 2FA enrollment (`doctor@gmail.com`)

1. Sign in. Open the profile dropdown in the sidebar. A **Settings** entry sits above Sign out. Click it, which opens `/settings`.
2. Click **Enable two-factor authentication**. A dialog opens with a password field.
3. Enter a wrong password and click **Continue**. **Observe** the error.
4. Enter `Password@123` and click **Continue**. You should get a QR code and backup codes. Copy the backup codes. **Observe** how many there are (the docs say 10).
5. Before confirming, check the database. Confirm `two_factor` has a row for this user, and `user.two_factor_enabled` is still 0:
   ```
   SELECT * FROM two_factor;
   SELECT email, two_factor_enabled FROM user WHERE email='doctor@gmail.com';
   ```
6. Scan the QR with an authenticator app. Enter a wrong code in **Code from your authenticator app** and click **Confirm and enable**. It should be rejected.
7. Enter the correct code and click **Confirm and enable**. Without reloading, confirm the page shows 2FA enabled. Then hard-reload and confirm you're still signed in and it still shows enabled. `two_factor_enabled` should now be 1.
8. Click **View QR code**, enter your password, and click **Show QR code**. The QR should appear. The docs say this button was never exercised live.
9. Click **Regenerate backup codes**, enter your password, and click **Regenerate**. New codes appear. Click **Done**.

## Part 2. 2FA sign-in

Sign out first. Before each attempt, check `SELECT status, created_at FROM logins ORDER BY created_at DESC LIMIT 5;`.

1. **Password only:** sign in with the password. You should land on the "Two-factor authentication" step, not the dashboard. The newest `logins` row should be `two_factor_pending`. Try opening http://localhost:3000/ directly and **observe** whether you're redirected.
2. **TOTP:** enter a wrong code and click **Verify**, which should fail. Then enter the correct code, which should reach the dashboard. The same `logins` row should become `success`.
3. **Backup code:**
   - Sign out and sign in with the password.
   - Click **Use a backup code instead**.
   - Try a code from before the regeneration in Part 1 step 9. It should be rejected.
   - Try a current code. It should be accepted.
   - Sign out, sign in again, and reuse that code. **Observe** whether it's rejected.
4. **Email OTP:**
   - Sign in with the password and select **Email code**. This tab appears only when both methods are enrolled.
   - Click **Email me a code**.
   - Open Mailpit at http://localhost:8025. The subject should be `<app name> verification code`. The sender should be `noreply@referral-tracking.local`.
   - Enter a wrong code, then the correct one.
   - Also click **Resend code** and **observe** which code works afterwards.
5. **Trust this device:**
   - Sign in, tick **Trust this device for 30 days**, and complete verification.
   - Sign out and sign in with the password only. **Observe** whether the second-factor step is skipped.
   - Repeat in a private window. **Observe** whether the step is required.
6. **Rate limit:** submit several wrong codes within a few seconds. **Observe** and record what happens and at which attempt. The docs claim 3 requests per 10 seconds. That figure was not confirmed.
7. **Expiry:** the second-factor window is 600 seconds.
   - Sign in with the password, wait over 10 minutes, then submit a correct code. **Observe** the result.
   - Then complete a full sign-in. **Observe** whether the abandoned `two_factor_pending` row becomes `failed`. The docs say this sweep was never exercised live.
8. **Disable:**
   - On Settings, click **Disable**. A confirm dialog titled "Disable two-factor authentication" opens.
   - Try a wrong password first. **Observe** the error.
   - Then confirm with the correct password.
   - You should stay signed in, the UI should show disabled, `two_factor_enabled` should be 0, and the `two_factor` row should be gone.
   - Then sign out and sign in with the password only, which should go straight to the dashboard.
9. **Opt-in:** sign in as `manager@gmail.com`. No 2FA prompt or gate should appear.
10. **Mail failure:** run `docker compose stop referral-tracking-mailpit`, then request an email code. **Observe** the UI and `docker compose logs referral-tracking-api`. The code logs "Failed to send email" and doesn't throw. Restart with `docker compose start referral-tracking-mailpit`.
11. Finish with 2FA disabled for `doctor@gmail.com`.

## Part 3. Auto-assignment

**Rules from `api/src/repository/cross-schema/auto-assignment.ts`:**
- Candidates must have role `DOCTOR`, status `ACTIVE`, and `facility_id` equal to the referral's `destination_facility_id`.
- If the referral has specialty tags, a candidate needs at least one of them.
- Among candidates, the one with the fewest referrals not in `COMPLETED`, `REJECTED` or `CANCELED` wins. Ties go to the lowest `user.id`, compared as strings.
- A match on a `PENDING` referral sets it to `ACCEPTED` and writes a `DOCTOR_ASSIGNED` timeline row with the note "Auto-assigned to <name> based on availability."
- No match leaves the referral unassigned.

**3.0 Prepare.** Pick a destination facility and record its active doctors, their specialties and their open-referral counts:
```
SELECT id, name, status, facility_id FROM user WHERE role='DOCTOR' ORDER BY facility_id, id;
SELECT us.user_id, s.name FROM user_specialties us JOIN specialties s ON s.id = us.specialty_id;
SELECT doctor, COUNT(*) FROM referrals WHERE doctor IS NOT NULL AND status NOT IN ('COMPLETED','REJECTED','CANCELED') GROUP BY doctor;
```
Predict the winner before each test.

**3.1 Create with a specialty.** Only Nurse and Doctor can create referrals.
1. As `nurse@gmail.com`, go to the new-referral form (title "Create referral").
2. Set **Receiving facility** to your chosen facility.
3. Stage a specialty in the **Specialties needed** card, then click **Create referral**.
4. Expected: the referral is `ACCEPTED`. `referrals.doctor` is a doctor with that specialty and the lowest workload among those who hold it. A timeline row exists. A `referral_specialties` row exists.

**3.2 Create without specialties.** Expect the least-loaded active doctor at the facility. If two doctors tie, the lower id should win.

**3.3 One request.** With the browser Network tab open, create a referral with two staged specialties. Expect a single `POST` whose body includes `specialty_ids`, and no separate per-specialty calls afterwards.

**3.4 No match.** Stage a specialty no active doctor at that facility holds. Expect the referral to be created as `PENDING` with `doctor` NULL and no error shown.

**3.5 Retry when a doctor gains a specialty.** Only a Manager can do this.
1. Using the 3.4 referral, sign in as `manager@gmail.com` and grant a doctor at that facility the missing specialty. **Observe** where in the UI this lives, as it was not confirmed.
2. Expect the referral to be assigned and `ACCEPTED`.
3. Repeat with a doctor at a different facility. Expect no assignment.

**3.6 Retry when a referral goes terminal.**
1. With a stuck unassigned referral at facility F, move an assigned referral at F to a terminal status. Status changes must follow the allowed transitions. For example, `ACCEPTED` can go to `IN_PROGRESS`, `ON_HOLD` or `REJECTED`, and `IN_PROGRESS` can go to `COMPLETED`.
2. **Observe** whether the stuck referral is assigned. The docs say this hook was never exercised live.

**3.7 Revalidation on tag change.** Nurse and Doctor can tag and untag.
1. On an auto-assigned `PENDING` or `ACCEPTED` referral, tag a specialty the assigned doctor lacks.
2. Expect the doctor to be removed and status to return to `PENDING`. The timeline should read "Unassigned automatically — the assigned doctor no longer matches this referral's required specialty." Then a re-attempt runs, which either reassigns or leaves it unassigned.
3. Untag until no tags remain. Expect no change.
4. On an `IN_PROGRESS` or `ON_HOLD` referral, add a mismatching tag. Expect no unassignment, since revalidation only acts on `PENDING` and `ACCEPTED`.

**3.8 Appeal reinstatement.** Approve an appeal for a doctor at a facility with a stuck referral. **Observe** whether the referral gets assigned. The docs say this hook was never exercised live.

**3.9 Direct re-activation.** The recheck is called from only three places (referral goes terminal, doctor gains a specialty, appeal reinstatement). If your seed data has a non-active doctor, change their status to active through whichever manager or administrator action exists. **Observe** whether a stuck referral gets assigned. If it doesn't, report it.

**3.10 Manual paths.** As `manager@gmail.com`, edit a referral. As a Doctor, self-claim an unassigned referral. Both should still work, and neither should be overridden by auto-assign.

**3.11 Logs.** Run `docker compose logs referral-tracking-api | grep -i "auto-assign"`. There should be no recheck failures during normal runs.

## Part 4. Authorization checks

- The 4 account routes (`/two-factor/enable`, `disable`, `get-totp-uri`, `generate-backup-codes`) without a session: **observe** the status code.
- The 4 sign-in routes (`verify-totp`, `verify-backup-code`, `send-otp`, `verify-otp`) with no pending second-factor cookie: **observe** the response.
- A wrong password on the four password-confirm actions should show a clean error, not a 500.
- After Parts 1 and 2, `docker compose logs referral-tracking-api | grep FST_ERR_RESPONSE_SERIALIZATION` should find nothing. That was a real earlier bug.

## Part 5. Regression pass (refactor)

Click through every area as the role that uses it, with the browser console open.
- **Auth:** sign-up, sign-in, sign-out, forced change-password, `/accept-nda`, account-status page.
- **Data pages:** dashboard, patients, referrals (including redirect and status changes), facilities, specialties, users, appeals, transfers, audit, reports.
- **Pagination:** change page size and page on every list. This is a specific refactor target.
- **Logs:** at the end, run `docker compose logs referral-tracking-api | grep -i error`.

Also run `pnpm typecheck` and `pnpm lint`. The docs say `main` has 4 pre-existing `by_type` errors in `administrator/service.ts` and `manager/service.ts`. Compare against `main` before reporting any failure.

## Reporting

When you report a failure, include the step number, what you expected, what happened, a screenshot or console output, and the relevant API log lines.
