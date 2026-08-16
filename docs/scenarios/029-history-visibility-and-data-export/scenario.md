# 029 — History visibility at scale, and getting data out of the app

**Role(s):** Manager, Administrator, Nurse, Doctor

**Area:** Audit, Referrals, Facilities, Users

**Last reviewed:** 2026-08-16

## Use case

An Administrator reconstructing what happened on a referral that's been
redirected several times, or on a long-tenured staff member's account,
wants to see the full history — not just the most recent slice of it.
Separately, a Manager needs to get data out of the system entirely: a
copy of the audit log for a compliance reviewer, or referral numbers for
a board meeting.

## Problem

A history feature that silently truncates without telling anyone is
worse than one that's openly limited — the person reading it has no
reason to suspect they're missing anything. And a system that can only
ever be read one screen at a time, with no way to export or print, makes
even simple, routine "hand this to someone outside the app" requests
impossible.

## Solution

The backend timeline/history endpoints are genuinely well-built —
`REFERRAL_HISTORY`, `USER_HISTORY`, and `FACILITY_HISTORY` all use real
`LIMIT`/`OFFSET` pagination at the database level, not an app-level
fetch-everything. The gap is entirely on the frontend, in two different
ways:

- **Referral and facility history views never request more than page
  one, and have no pagination controls at all.** The 10 most recent
  timeline events are all that's ever visible — everything older is
  reachable via the API directly but invisible in the UI, with no
  indicator that more history exists. Every other paginated list in the
  app uses a shared `PaginationFooter` component; the timeline display
  doesn't.
- **Staff history has no viewer in the UI at all.** `USER_HISTORY` is a
  fully working backend endpoint with zero frontend caller — the user
  detail page has no history/timeline section whatsoever. This directly
  compounds the staff-accountability gap already tracked in
  [006 — Accountability for dropped
  referrals](../006-accountability-for-dropped-referrals/scenario.md).

Separately, and more broadly: **there is no export, download, print, or
CSV capability anywhere in the app**, for any entity or screen — not
just patients (already covered in
[023](../023-patient-data-retention/scenario.md)). The audit log,
referral lists, and dashboard/reports are all screen-only. The only way
to get data out of the system today is to read it directly off the
screen, or query the API with a valid session. Full detail on both
findings in
[backlog.md](../../backlog.md#an-entitys-history-beyond-the-first-page-is-invisible-in-the-ui-and-staff-history-has-no-viewer-at-all)
and
[backlog.md](../../backlog.md#no-export-download-print-or-csv-capability-exists-anywhere-in-the-app).

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | The backend history endpoints use real database-level pagination | Traced `referralHistory`/`userHistory`/`facilityHistory` through `Timeline.many` and `manyRecords` | ✅ Confirmed, 2026-08-16 |
| 2 | A referral/facility's history beyond the 10 most recent events is visible in the UI | Read the frontend request calls and `TimelineList`'s rendering | ❌ Confirmed absent, 2026-08-16 — no pagination controls, no page-2 request |
| 3 | A staff member's status-change history is viewable anywhere in the UI | Searched for any caller of `userHistoryRequest` and any history section on the user detail page | ❌ Confirmed absent, 2026-08-16 — working endpoint, zero consumer |
| 4 | Any list, report, or the audit log can be exported, downloaded, printed, or saved as CSV | Repo-wide search across frontend and backend for export/download/CSV/print affordances | ❌ Confirmed absent, 2026-08-16 — genuine zero-hit, systemic |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
