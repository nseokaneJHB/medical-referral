# 001 — Referral verification and audit-trail reconstruction

**Role(s):** Nurse, Administrator
**Area:** Referrals, Audit
**Last reviewed:** 2026-08-16

## Use case

Two connected real-world moments in a referral's lifecycle, run back to
back:

1. A Nurse opens a referral to double-check where a patient is actually
   being sent, ahead of a call to the receiving facility.
2. An Administrator is asked to reconstruct what happened on a referral or
   facility record — the kind of request that shows up after a complaint,
   a missed handoff, or a compliance check — and opens the audit log to do
   it.

## Problem

- **Case 1:** A Nurse acting on stale or wrong destination-facility
  information can send a patient's paperwork, calls, or follow-up to the
  wrong place. She has to be able to trust that whatever the "Destination
  facility" field shows her is the referral's actual, current value.
- **Case 2:** When something needs reconstructing after the fact, the
  people asking (compliance, a manager, the patient's care team) need an
  actual account of who did what — not just who logged in and out.
  Accountability depends on the trail existing, not just on the underlying
  action having happened correctly.

## Solution

- **Case 1:** The referral edit form (`web/src/routes/_authenticated/referrals/$referralId.tsx`)
  seeds the referral's currently-set `destination_facility` into the
  options passed to `SelectInput`, so the field always has a label to
  render for the value already on the record — independent of whether
  `useFacilitySearch`'s hybrid search (`web/src/hooks/use-facility-search.ts`)
  has been triggered by typing. Walking the scenario: opening the Wallace
  Cole referral shows "Destination facility: East Irving Regional
  Hospital," matching the "Leroyberg Regional Hospital → East Irving
  Regional Hospital" header directly above it.
- **Case 2:** `/audit` (`web/src/routes/_authenticated/audit/index.tsx`)
  dispatches by role. A Manager gets `ManagerFacilityAudit`, backed by
  `AuditManager.listForFacility` (`api/src/management/audit.ts`) — a
  merged feed over the `timeline` table covering referral status changes,
  redirects, transfers, flags, and appeals for their own facility. An
  Administrator gets `AdministratorLoginAudit`, backed by
  `api/src/modules/audit/service.ts`'s `logins` handler — session
  login/logout history only. Walking the scenario as Administrator: the
  audit log shows exactly that — user, email, status, login/logout time,
  IP, device — and nothing about what any referral, patient, or facility
  record actually had done to it.

Case 2's current solution only covers session history for this role; see
[notes.md](notes.md#related) for where that's tracked.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Nurse opens the Wallace Cole referral | "Destination facility" matches the header | ✅ Confirmed live in browser, 2026-08-16 |
| 2 | Administrator opens the audit log | Shows login/logout only, no referral/facility activity | ✅ Confirmed live in browser, 2026-08-16 — matches Solution's description above |

See [notes.md](notes.md).
