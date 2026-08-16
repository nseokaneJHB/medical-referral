# 030 — Screen-reader and keyboard-only access to core workflows

**Role(s):** Nurse, Doctor
**Area:** Patients, Referrals, Auth
**Last reviewed:** 2026-08-16

## Use case

A staff member who relies on a screen reader, or who can't use a mouse at
all (a motor impairment, a broken trackpad, whatever the reason), needs to
do the same job as anyone else hired into the role — sign in, register a
new patient, work their referral queue — using only the keyboard, and
hearing each field announced accurately enough to know what to type into
it.

## Problem

A form that only makes sense to someone who can see the label sitting
next to a box isn't actually usable by everyone the hospital employs to
fill it out. For a screen-reader user, a control is only as good as what
the accessibility tree exposes for it — a text field with no computed
name is announced as a bare "edit text," indistinguishable from every
other blank field on the page, forcing a guess or an abandoned task. This
isn't a hypothetical: it's a real hiring/compliance exposure for a
healthcare-adjacent system, not a cosmetic nice-to-have.

## Solution

Keyboard *reachability* and *operability* are, on their own, solid: sign-in,
the sidebar navigation, referral links, and the referral status-transition
control are all built on real semantic elements — plain `<a>`/`<button>`,
and a properly constructed ARIA radiogroup (Radix-based, correct
`role="radiogroup"` with `aria-labelledby` wired per option) for status
transitions. Tabbing through sign-in end-to-end (email → password → submit
via Enter) and reaching every nav link and referral row this way worked
with no keyboard traps encountered.

The gap is entirely in **accessible naming**, and it's systemic rather than
a one-off: the two shared form primitives nearly every free-text field in
the app is built from — `Input` (`web/src/components/custom/input.tsx`)
and `TextArea` (`web/src/components/custom/text-area.tsx`) — render a
visible `<label>` via `FieldLabel` right next to the control, but never
actually link the two together (no `id`/`htmlFor` pairing, no
`aria-labelledby`). A sighted mouse user never notices, because the label
and the box just sit next to each other on screen. A screen reader falls
back to the field's `placeholder` where one happens to exist (sign-in's
email/password fields at least announce "email@example.com" /
"********," not great but not silent either) — and to **nothing at all**
where it doesn't, confirmed directly in Chrome's own accessibility tree
for patient registration's first name, last name, date of birth, phone,
and address fields, all five of which compute to a completely blank
accessible name. Since both `Input` and `TextArea` are the shared
primitives, the same gap reaches sign-in, sign-up, patient create/edit,
facility edit, the referral status-update "reason" field, and the search
boxes on every list page — effectively most free-text input in the app.
**Fixed 2026-08-16** — both components now generate a stable id via React's
`useId()` and wire it as `id`/`htmlFor` between the control and its
`FieldLabel`, confirmed live via Chrome's accessibility tree across
sign-in, the referral status-update reason field, and patient registration.

## Tracking table

| # | Case | Checked | Result |
|---|------|---------|--------|
| 1 | Sign-in is completable keyboard-only, start to finish | Tabbed from a blank focus state through email → password → submit via Enter, no mouse used | ✅ Confirmed live, 2026-08-16 |
| 2 | Sign-in's email/password fields expose a meaningful name to assistive tech | Read the live accessible-name computation for both fields | ✅ Fixed and confirmed live, 2026-08-16 — both fields now correctly announce "Email"/"Password" via `id`/`htmlFor` |
| 3 | The referral status-transition control is correctly named for assistive tech | Read Chrome's accessibility tree for the "Update status" section | ✅ Confirmed — proper `role="radiogroup"` with `aria-labelledby` per option |
| 4 | Referral status-update's "Reason for this change" field exposes a meaningful name | Read the live DOM for the notes textarea | ✅ Fixed and confirmed live, 2026-08-16 — the notes field now correctly announces "Reason for this change" |
| 5 | Patient registration's core fields (first/last name, DOB, phone, address) expose a meaningful name | Read Chrome's accessibility tree for `/patients/new` | ✅ Fixed and confirmed live, 2026-08-16 — all five fields now correctly announce their label ("First name," "Last name," etc.) |

See [notes.md](notes.md) for related links and enrichment ideas.
