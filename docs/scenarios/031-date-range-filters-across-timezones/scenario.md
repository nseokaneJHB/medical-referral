# 031 — Date-range filters across timezones

**Role(s):** Nurse, Doctor, Manager, Administrator
**Area:** Patients, Referrals, Dashboard
**Last reviewed:** 2026-08-16

## Use case

A Doctor on the west coast of the US (or any facility outside UTC) filters
their referral queue by "From: today" to see what's come in since they
started their shift, or an Administrator picks a date range on the
dashboard to pull a same-day report. They expect "today" to mean their
own local calendar day — the day on the clock in front of them — not the
server's.

## Problem

A referral-tracking system used across facilities can't assume every
viewer sits in the same timezone as the database server. If a date-range
filter silently anchors to a different timezone than the person typing
the date, records near midnight can land in the wrong bucket — a referral
created at 11:30pm local time might not show up under "today" until the
next calendar day locally, or a referral from the tail end of yesterday
might wrongly appear under "today." For an audit/compliance reconstruction
or an on-call handoff, that's not a cosmetic inconvenience — it's staff
looking at an incomplete or shifted picture of what happened, without any
indication that's what's happening.

## Solution

Every `from`/`to` date-range filter across the app — referrals
(`api/src/modules/referrals/service.ts`), patients
(`api/src/modules/patients/service.ts`), the dashboard
(`api/src/modules/dashboard/service.ts`), and the referrals report
(`api/src/modules/reports/service.ts`) — is built the same way: the query
param is a plain `YYYY-MM-DD` string with no timezone information (the
frontend's date-range inputs are native `<input type="date">` fields,
which never carry timezone context), and the backend anchors it to UTC
midnight: `new Date(\`${query.from}T00:00:00.000Z\`)`. Confirmed live by
setting a referral list's "From" filter to a date and reading the exact
request the browser sent — the URL param and outgoing request both carry
the bare date string, nothing else.

For a viewer in UTC this is exactly correct. For any viewer *not* in UTC,
the day boundary the backend applies doesn't line up with their own local
calendar day boundary — the size of the misalignment equals their UTC
offset. `registeredThisPeriod`'s "this month" boundary
(`patients/service.ts`) has the identical UTC-anchored construction, so
the same class of misalignment applies to month boundaries too, not just
day-range filters.

This was a systemic design choice across every date-range filter in the
app, not an isolated one-off. **Fixed 2026-08-16** — every UTC-anchored
call site (`referrals/service.ts`, `patients/service.ts` including
`registeredThisPeriod`, all four `dashboard/service.ts` handlers,
`reports/service.ts`) now accepts an optional `tz_offset` query param
(the client's `Date.prototype.getTimezoneOffset()` value, wired in
automatically by the referrals-list and dashboard frontend pages) and
anchors day/month boundaries to the viewer's local calendar day when it's
present, falling back to UTC when it's absent — two new shared helpers,
`localDateStartToUtc`/`localMonthStartToUtc` (`api/src/lib/util.ts`), do
the boundary math. Confirmed live with controlled backdated test records
in both UTC+2 and UTC-5 directions, plus a month-boundary case for
`registeredThisPeriod` — see the tracking table below.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Referral list's "From" date filter sends a bare, timezone-agnostic date string | Set the filter live and read the resulting URL/request | ✅ Fixed and confirmed live, 2026-08-16 — requests now also carry `tz_offset` (the client's UTC offset in minutes) alongside `from`/`to` |
| 2 | Backend anchors that date to UTC midnight, not the request's origin timezone | Read `referrals/service.ts`, `patients/service.ts`, `dashboard/service.ts`, `reports/service.ts` | ✅ Fixed and confirmed live, 2026-08-16 — `localDateStartToUtc()` shifts the boundary by `tz_offset` when present; verified with a backdated test referral in both UTC+2 and UTC-5 directions, correctly included/excluded depending on whether `tz_offset` was sent |
| 3 | The same UTC-anchoring applies to "registered this month"/period boundaries, not just explicit date filters | Read `patients/service.ts`'s `registeredThisPeriod` | ✅ Fixed and confirmed live, 2026-08-16 — `localMonthStartToUtc()` shifts the month-start boundary the same way; verified with a backdated test patient straddling the July/August UTC boundary, whose `registered_this_period` count changed from 7 to 8 once `tz_offset=-120` was applied |

See [notes.md](notes.md) for related links and enrichment ideas.
