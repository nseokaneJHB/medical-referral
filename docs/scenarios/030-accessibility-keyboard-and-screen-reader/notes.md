# 030 — Notes

Supporting material for [scenario.md](scenario.md). Keep this separate —
`scenario.md` stays a clean use case/problem/solution/tracking-table
description.

## Recording

No recording made. The most convincing way to demonstrate this is with an
actual screen reader (VoiceOver, NVDA) narrating a blank field — not
available as a tool in this environment — so the finding is evidenced
directly via Chrome's own accessibility tree and computed accessible-name
inspection instead, which is the same source of truth a screen reader
reads from.

## Related

- Bug: [BUG-015 — Shared form inputs have no programmatic label
  association](../../bugs.md#bug-015-shared-form-inputs-have-no-programmatic-label-association) —
  full root cause and fix direction.

## Enrichment ideas

- Extend this scenario to Manager/Administrator-only screens (user
  approval queues, facility moderation, appeal decisions) once BUG-015 is
  fixed, to confirm the same shared components are fixed everywhere they're
  used, not just the two forms walked here.
- Worth a real screen-reader pass (VoiceOver or NVDA) once the label fix
  lands, to confirm actual assistive-tech behavior matches what the
  accessibility tree predicts — the tree is a strong proxy but isn't a
  substitute for hearing it.
- The focus indicator on `Input`/`TextArea` when tabbed to is a real but
  subtle 1px border-color change, not a strong ring/glow — noticed in
  passing, not the focus of this pass. Worth a dedicated contrast check
  (WCAG 2.4.7) if accessibility work continues.
- Icon-only controls (row "Actions" kebab menus, the sidebar collapse
  toggle) weren't audited for `aria-label` completeness here — worth a
  follow-up pass.
- The `SelectInput`-based Gender combobox on patient registration also
  showed no accessible name in the tree during this pass — not
  investigated further since it's a different component (`SelectInput`,
  not `Input`/`TextArea`) with its own separate root cause; worth its own
  look if this area gets more attention.
