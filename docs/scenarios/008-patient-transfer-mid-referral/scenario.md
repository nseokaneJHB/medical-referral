# 008 — Patient transfer with an in-flight referral

**Role(s):** Nurse, Doctor, Manager
**Area:** Patients, Transfers, Referrals
**Last reviewed:** 2026-08-16

## Use case

A patient's whole care moves from one facility to another — not a single
referral, but their entire ongoing relationship. Meanwhile, they already
have an active referral in progress at (or through) their current
facility. Once the transfer completes, whoever is now treating this
patient at the new facility needs to be able to see and act on what was
already underway, not discover it's missing.

## Problem

A transfer and a referral both exist to keep a patient's care moving
correctly between facilities — but if they don't know about each other,
completing one can quietly break the other. A receiving facility that
has no visibility into a patient's in-progress referral has no way to
know care was already in motion, and the facility that does still have
that visibility no longer has the patient.

## Solution

The transfer feature itself is solid: a two-sided approval flow (origin
Manager, then destination Manager, either side can reject), a hard block
against a second transfer opening while one is already pending
(`TransferManager.isOpen`, `api/src/management/transfer.ts`), and
`patient.facility_id` changes exactly once, atomically with the final
approval. Walking the scenario further reveals what's missing between
this feature and referrals specifically:

- **Requesting or approving a transfer never looks at the patient's
  referrals.** `transferRequest`
  (`api/src/modules/transfers/service.ts:93-152`) checks the transfer's
  own preconditions (patient exists, requester's facility matches,
  destination is valid and available, no other transfer already open) —
  nothing queries the `referral` table, so a transfer can complete with
  an active, in-progress referral still attached to the patient and
  neither approving Manager is ever shown that.
- **A referral's facility fields are frozen at creation and never follow
  the patient afterward.** `origin_facility_id`/`destination_facility_id`
  are set once (at creation, or updated by a redirect) and never
  re-synced to wherever the patient's own `facility_id` moves later.
  Referral visibility (`canViewReferral`) is keyed entirely off those
  frozen fields.
- **Net effect**: after a transfer, the old facility's staff can still
  see a referral created while the patient was there; the new facility's
  staff generally can't, unless that referral happens to already name
  their facility for an unrelated reason. The referral doesn't travel
  with the patient, and nothing about the transfer process flags that
  this is about to happen.

See [notes.md](notes.md) for the full backlog write-up and open questions
on how this should actually be resolved.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Transfer request/approval checks for the patient's in-flight referrals | Read `transferRequest` and `decideTransferSide` (`api/src/modules/transfers/service.ts`) | ❌ Confirmed absent, 2026-08-16 — no query against `referral` anywhere in the transfer flow |
| 2 | A referral's facility fields update when the patient later transfers | Read referral creation (`api/src/modules/referrals/service.ts`) and `canViewReferral` (`api/src/lib/permission.ts`) | ❌ Confirmed absent, 2026-08-16 — frozen at creation/redirect time, never re-synced |
| 3 | A second transfer can be opened while one is already pending | Read `TransferManager.isOpen` and `transferRequest`'s existing-transfer check | ✅ Confirmed working correctly, 2026-08-16 — blocked with a 409 |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
