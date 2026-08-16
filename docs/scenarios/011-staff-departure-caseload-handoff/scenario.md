# 011 — Staff departure and caseload handoff

**Role(s):** Manager, Administrator, Doctor, Nurse
**Area:** Users, Referrals
**Last reviewed:** 2026-08-16

## Use case

A Doctor or Nurse leaves a facility — resigns, takes a job elsewhere, or is
terminated — while they still have referrals assigned to them that haven't
reached a terminal status. A Manager needs to take them out of the system
(so they can't sign in or be assigned new work) and get their open caseload
into someone else's hands, so patients don't quietly stop being someone's
responsibility the moment the account goes inactive.

## Problem

Employee turnover is routine and expected, unlike misconduct or an
account-suspension edge case — a referral-tracking system has to treat
"this person doesn't work here anymore" as a first-class event, or every
departure becomes a silent handoff failure. The real-world risk isn't the
account going away; it's the referrals that were pointing at that account
not going anywhere at all.

## Solution

Today, the only real mechanism a Manager or Administrator has for taking a
Doctor or Nurse out of action — for any reason, departure included — is
disabling their account via `ModerationManager.applyUserStatusChange`
(`api/src/management/moderation.ts:66-101`). This method only updates the
user's own `status` and writes one `USER`-type timeline row; it never looks
at that user's referrals, so anything still assigned to them stays exactly
as it was, silently pointing at a now-locked-out account. This is the same
underlying gap documented in [No way to identify or hold accountable a
staff member sitting on stale
referrals](../../backlog.md#no-way-to-identify-or-hold-accountable-a-staff-member-sitting-on-stale-referrals),
approached here from the ordinary-turnover angle rather than the
discipline/stale-referral angle.

The codebase shows this was anticipated: `USER_STATUS.DEPARTED` and
`TIMELINE_ACTION.DEPARTED` already exist as defined constants, scoped
specifically to voluntary, self-requested account closure (as opposed to
`DISABLED`, which is imposed by a Manager/Administrator). But it's dead
code from a real-user perspective — no route, handler, or UI action in the
whole codebase ever produces one. It only shows up as hand-built seed/demo
data and in display code that renders history if it exists. There's no
"Depart" option next to Approve/Reject/Flag/Disable on the staff page, and
no client function to call even if there were. See the backlog entry above
for full file:line detail on both halves of this.

Net effect: today, a Manager handling a real departure has exactly one
tool (Disable), it does nothing about the departing person's open
referrals, and the one status specifically reserved for this exact story
doesn't do anything either, because it isn't wired to anything.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | A `DEPARTED` action is reachable through any Manager/Administrator staff flow | Grepped every `applyUserStatusChange` call site in `manager/service.ts` and `administrator/service.ts` | ❌ Confirmed absent, 2026-08-16 — only `ACTIVE`, `REJECTED`, `DISABLED`, `FLAGGED` are ever passed |
| 2 | A "Depart" (or similar) action exists in the staff page UI | Read `web/src/routes/_authenticated/users/index.tsx` row-action menu and `web/src/api/users.ts` | ❌ Confirmed absent, 2026-08-16 — only Approve/Reject/Flag/Disable render, no matching API client function |
| 3 | Disabling a Doctor/Nurse account affects their in-flight referrals | Read `ModerationManager.applyUserStatusChange` | ❌ Confirmed absent, 2026-08-16 — no referral query, reassignment, or flag of any kind |
| 4 | `DEPARTED` timeline rows exist anywhere in the running app | Grepped for every reference to `DEPARTED` across `api/` and `web/` | ❌ Confirmed seed-only, 2026-08-16 — only `api/script/seed.ts`'s synthetic demo data ever constructs one |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
