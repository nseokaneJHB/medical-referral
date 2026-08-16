# 005 — Wrong-specialty referral

**Role(s):** Nurse, Doctor
**Area:** Referrals, Facilities, Specialties
**Last reviewed:** 2026-08-16

## Use case

A Nurse refers a patient who needs a specific specialty — say, Internal
Medicine — to another facility. The facility that receives it either
doesn't actually treat that specialty, or the Doctor who ends up assigned
doesn't personally have it. Either way, the patient has been routed
somewhere that can't really help them, and the sooner that's caught, the
less time gets wasted.

## Problem

Specialty matching is exactly the kind of thing a referral-tracking
system should be positioned to catch automatically, since the data to
check it already exists on both sides (a facility's own specialty list,
a Doctor's own specialty list, and the referral's tagged needed
specialties). If nothing cross-checks these, a mismatch is only ever
caught by a human noticing — and by then the referral has already sat at
the wrong place for however long that took.

## Solution

Walking this scenario end to end, nothing in the app cross-checks
specialties at any of the three points where a mismatch could plausibly
be caught:

- **At creation** (`web/src/routes/_authenticated/referrals/new.tsx`), the
  destination-facility field and the "specialties needed" field are two
  fully independent pickers — selecting a facility doesn't filter, or
  even display, what that facility actually treats, and tagging a
  specialty doesn't narrow the facility choices either. The backend
  create handler (`api/src/modules/referrals/service.ts`'s
  `referralCreate`) doesn't check the destination's status or specialties
  at all — unlike the Redirect handler on the same file, which does
  verify the destination is `APPROVED` before allowing the move.
- **At assignment**, neither self-assign nor a Manager assigning a Doctor
  checks the assignee's own specialties against the referral's needed
  ones — not in the backend handlers, not in the frontend permission
  checks, not in the doctor-picker dropdown (which lists every Doctor
  platform-wide, not even narrowed to the destination facility).
- **At redirect** — the one action a Doctor has once they've noticed a
  mismatch — the facility picker is the exact same generic search used
  everywhere else in the app, with no specialty awareness, even though
  the same dialog lets the Doctor edit the referral's needed-specialty
  tags in place. Fixing the tag and picking a new facility are two
  unrelated actions in the same form; nothing connects them.

The one encouraging detail: the actual filtering capability isn't
missing from the codebase, just unused in the right places.
`GET /facilities` already supports a fully generic `specialty` query
parameter, resolved server-side against the `facility_specialties` table
— it already powers the Administrator `/facilities` list's specialty
filter today. The gap is that `useFacilitySearch`, the shared hook behind
both the referral-creation and redirect facility pickers, never accepts
or forwards that parameter — so a real fix here is narrower than it might
first appear. See [notes.md](notes.md) for where this is tracked.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Creating a referral to a facility with no overlapping specialty | Read `referrals/new.tsx` and `referralCreate` (`api/src/modules/referrals/service.ts`) | ❌ Confirmed absent, 2026-08-16 — no client or server check exists |
| 2 | Self-assigning to a referral needing a specialty the Doctor doesn't have | Signed in as `doctor@gmail.com` (specialty: Psychiatry only), self-assigned a seeded referral tagged "Internal Medicine" | ❌ Confirmed live in browser, 2026-08-16 — succeeded silently, no warning; restored to original state afterward |
| 3 | Redirecting to a facility, filtered by the referral's needed specialty | Read `RedirectReferralAction` and `useFacilitySearch` (`web/src/hooks/use-facility-search.ts`) | ❌ Confirmed absent, 2026-08-16 — same unfiltered generic facility search as everywhere else |
| 4 | Whether the underlying specialty-filter capability exists at all, anywhere | Read `GET /facilities`'s `specialty` query handling (`api/src/modules/facilities/service.ts`) and the Administrator `/facilities` list | ✅ Confirmed present and working, 2026-08-16 — fully generic, just not wired into the pickers that would need it |

See [notes.md](notes.md) for the recording breakdown, related links, and
enrichment ideas.
