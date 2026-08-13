# Product Backlog / Parked Ideas

Status: **parking lot.** Ideas raised in passing during other discussions that
aren't being worked yet. When one gets picked up for real, promote it to its
own planning doc (like `docs/roles-permissions.md`) and link back here.

## Employee ID

Referenced from a prior (lost) session — details not recaptured yet. Need to
ask the user what this idea actually entailed before it can be scoped.

## Facilities picker — searchable select (hybrid)

- **Decision (2026-08-08):** hybrid approach confirmed. No default/eager load
  of the facilities list. The API call fires only once the user has typed a
  search term, and that term is sent as the `search` query param — already
  supported server-side by `facilitiesQuerySchema` (matches facility
  name/address, see `api/src/modules/facilities/service.ts`).
- Replaces the current pattern, duplicated identically across 6 screens —
  `facilitiesRequest({ data: { page: "1", limit: "100" } })` in
  `patients/new.tsx`, `patients/$patientId.tsx`, `referrals/new.tsx`,
  `referrals/$referralId.tsx`, `referrals/index.tsx`, `sign-up.tsx` — which
  silently can't find/search facilities past the first 100 (the existing
  `searchable` prop on `SelectInput` only filters client-side over whatever
  was already fetched — see `web/src/components/custom/select-input.tsx`).
- Still needs when picked up: a debounce (no debounce utility currently
  exists anywhere in `web/src`), and should land as one shared piece (async
  mode on `SelectInput`, or a dedicated hook/component) rather than a 7th
  copy-paste.
- Not started — parked.

## Facility specialties

- Idea: add "specialty" as its own reference/metadata table (e.g. id + name),
  many-to-many referenceable across facilities — a facility can have multiple
  specialties, a specialty can be shared by multiple facilities.
- Also assign specialties to doctors **and now nurses too** (extended
  2026-08-08, mid permission-matrix walkthrough — not forgotten) — a
  doctor/nurse <-> specialty relationship, separate from (or related to) the
  facility <-> specialty one. Same shared reference table for all three
  (facility, doctor, nurse), reusing the metadata rather than three separate
  vocabularies.
- Open questions for when this is picked up:
  - Is a doctor/nurse's specialty constrained to a subset of their
    facility's specialties, or fully independent?
  - Where does it surface — facility profile, referral creation (e.g. route a
    referral by specialty match), search/filter facilities by specialty?
  - Admin-managed controlled vocabulary vs. free text?
  - Possible overlap with the [[roles-permissions]] rework — if referrals get
    routed/filtered by specialty, that likely touches the same
    `referrals/service.ts` scoping logic already being redesigned there.
- Status: early thought, not scoped.

## User profile pages

**Superseded — resolved in [docs/roles-permissions.md](./roles-permissions.md).**
Confirmed as name-only self-service for now (no email/password, and never
`role`/`facility_id`/`status` — the privilege-escalation risk originally
flagged here). Specialty self-assignment stays tied to the still-parked
Facility specialties idea above, not yet scoped. **Note:** the
password-change item below reopens the "no password" half of this —
self-service password change needs *some* profile/settings page to live
on, and this is the only prior decision about one existing.

## Self-service password change (+ profile/settings page)

- **Raised 2026-08-12**, right after shipping Administrator password reset
  (`docs/roles-permissions.md`'s 2026-08-12 session log entry) and the
  Argon2 hashing cutover. User pointed out the resulting gap: once an
  Administrator resets (or creates) a user's password, that user has no
  way to ever change it themselves — confirmed by research, there is
  currently **no self-service password-change capability anywhere in the
  system**:
  - Backend: better-auth's built-in `changePassword` endpoint isn't even
    routed — `api/src/modules/authentication/route.ts` only registers
    sign-up/sign-in/sign-out/session, no catch-all `auth.handler` mounted.
  - Frontend: no profile/settings/account page exists at all (`account-
    status.tsx` is facility-approval/appeal, not account settings), no API
    call for it, no nav link.
  - `must_change_password` (set on every admin-created/admin-reset
    account) is defined and flows into the session/account response
    (`shared/src/schema/account.ts`) but is completely inert on the
    frontend — nothing reads it, no forced-change screen, no redirect.
    Previously flagged as "not yet built" in `docs/roles-permissions.md`
    when the create-user flow shipped; now more consequential since
    admin-reset is also live and it's the *only* password-change path.
- **User's explicit requirement:** this must be coupled with a real
  profile/settings page, not bolted on as a standalone password-change
  form somewhere ad hoc. Ties directly to the "User profile pages" item
  above, which only resolved the name-only piece and explicitly deferred
  email/password.
- Not scoped yet — needs its own planning pass covering at minimum: where
  the page lives in nav, whether `changePassword` gets exposed via
  better-auth's handler or a custom endpoint (consistent with the
  Argon2/`api/src/lib/password.ts` hashing setup, not better-auth's
  scrypt default), and whether/how `must_change_password` finally gets
  read client-side (forced-change redirect on sign-in vs. a passive
  banner on the new settings page).
- Status: **parked, not started.**

## Frontend module organization — API calls sharded by role

- **Raised 2026-08-09**, alongside the roles/permissions matrix work, not a
  permissions decision itself — frontend code organization.
- Problem, concretely: `web/src/api/dashboard.ts` already crams
  `nurseSummaryRequest`/`doctorSummaryRequest`/`adminSummaryRequest` into one
  file, with `_authenticated/index.tsx` branching on `user.role` to pick the
  right one — and a `managerSummaryRequest` is about to make it worse. This
  pattern doesn't scale as role-specific behavior keeps growing (see
  `docs/roles-permissions.md` for how much it's grown).
- **Direction agreed:** shard the API layer into per-role folders (e.g.
  `web/src/api/admin/`, `manager/`, `nurse/`, `doctor/`) for genuinely
  role-exclusive calls (dashboard summaries, moderation actions like
  accept/reject/disable/flag/appeal).
- **Caveat raised, not yet confirmed:** don't shard entities that are the
  *same* call for every role with only server-side scoping differing
  (Patients/Referrals/Facilities reads) — those stay in a shared module.
  Duplicating them per role folder would just be copy-paste, the same
  mistake already found and fixed once this session (the facilities picker
  duplicated across 6 screens, see above).
- **User overruled the caveat above (2026-08-09): full role-based
  duplication, on purpose, even for shared entities.** Reasoning: it lets
  each role's slice evolve independently later (e.g. omitting a field from
  one role's view of Patients) without extracting logic out of a shared
  module and risking every other role in the process. Assistant reconsidered
  and agrees this is sound, not just deferring — these are thin typed HTTP
  wrapper functions, not real business logic, so the duplication cost is
  low, and the domain already has heavy per-role divergence (this entire
  session's permission matrix is proof of that). One thing that should
  **still** stay centralized regardless: the actual HTTP plumbing — the
  shared axios instance, error handling, and cookie-forwarding already
  living in `web/src/api/index.ts`. Role modules should keep calling into
  that, not reimplement it — it's the request *shaping*
  (which fields, which role-specific endpoint) that gets duplicated, not
  the transport mechanics.
- **The actual complaint, clarified: both** code sprawl and real
  overfetching — "many API calls to show information that's related to
  each other on one component" is the specific pattern to avoid. The
  Manager dashboard endpoint just designed in `docs/roles-permissions.md`
  (`GET /dashboard/manager/summary`) is already the right shape for this:
  one consolidated, purpose-built endpoint returning everything that one
  view needs, instead of a component stitching together several separate
  calls. Apply that same "one view, one call" principle wherever a
  component would otherwise fire multiple related requests.
- **Component layer: yes, role-based too — confirmed.** But **not** the
  URL. Role should never appear in the path (e.g. no `/manager/dashboard`)
  — matches how the app already works today (`/patients`, `/referrals/:id`
  aren't role-prefixed now either). Proposed pattern: the route file stays
  a single thin dispatcher per logical page (e.g.
  `_authenticated/index.tsx` for the dashboard) that reads `user.role` from
  route context (already available — see the `beforeLoad` pattern in
  `facilities/index.tsx`) and renders the matching role-specific component
  tree; each of those trees is fully self-contained and pulls only from its
  own role's api module. This also fixes the sprawl directly — role
  branching happens once, at the top, instead of scattered `if (role ===
  X)` checks throughout one shared component (which is roughly what
  `_authenticated/index.tsx` already does today for the dashboard).
- **Pushback on how far to take component duplication: confirmed, kept
  shared.** For pages that are one underlying view with a role-gated action
  set (referral detail, patient detail) — one shared component, not forked
  per role.
- **How the shared component decides what to render — this is the actual
  point of the RBAC/ABAC/ReBAC article, applied to the frontend, not just
  the API.** The centralized permission function already agreed to in
  `docs/roles-permissions.md` (one dedicated module, single source of truth
  for authorization) shouldn't be an API-only concern — it should be the
  *same* thing a shared component like `referrals/$referralId.tsx` consults
  to decide which actions/buttons to show, rather than the component
  re-deriving its own `if (role === X)` logic independently. Two things
  worth being deliberate about when this gets built:
  - The policy this system actually needs is a hybrid, same conclusion as
    the RBAC/ABAC/ReBAC notes in `docs/roles-permissions.md` already
    reached for the backend: RBAC (role → base capability) layered with
    ReBAC-style relationship checks (`facility_id` match, `created_by`
    match, doctor-assignment match) and ABAC-style attribute checks
    (referral must be `PENDING`, facility must not be `FLAGGED`/`SUSPENDED`).
    A function shaped like `can(user, action, resource) -> boolean` that
    evaluates all three is the actual shared primitive both sides need —
    not a separate, simpler "frontend version" that could drift from what
    the API actually enforces.
  - Given this is a pnpm monorepo with a `shared` workspace already used by
    both `api` and `web` for schemas/constants (`@referral-tracking/shared`
    — see `shared/src/`), that's the natural home for the policy
    definitions themselves, not just the enums they operate on. Worth
    deciding whether the *evaluation* logic (not just the rules/constants)
    can genuinely live there once — some rules need a DB lookup (e.g. "is
    the destination facility currently flagged"), which the frontend can't
    do directly, so the shared function likely needs to accept
    pre-resolved data (already-fetched referral/facility/user objects) as
    arguments rather than fetching itself — same shape either side calls
    it from, different data-loading around it.
- Status: direction agreed and mostly decided; one new item (shared-package
  placement for the policy evaluation logic, above) to settle once this is
  actually built.

## Shared list-page components (filter bar, status badges, action buttons)

- **Raised 2026-08-13**, mid a cross-page consistency pass (sidebar badges,
  filter row layout, status colors, button variants) across
  Users/Facilities/Patients/Referrals. Root cause of most of the drift found
  in that pass: each list page's filter row, status-badge color mapping, and
  page-header "create" button were copy-pasted independently rather than
  shared, so they drifted (e.g. Users' status badge collapsed to a binary
  success/error while Referrals/Facilities used a full per-status color map;
  Referrals/Patients' create button defaulted to `Link`'s ghost variant while
  Users' used `Button`'s default filled variant).
- Direction, not yet scoped: extract a shared `FilterBar`-style component for
  the search+filters Card row (search pinned right via `ml-auto`, filters
  left), a generic status-badge-variant mapper keyed by enum, and a
  consistent page-header "create/add" action button.
- **Tables too — user pointed to a concrete prior implementation** (raised
  same session, right after the component list above): a generic
  `Table<TData, TValue>` component from an earlier project
  (`ubuntu-stories-monorepo`, commit `b566fb73e767fc2774d3614b9c3808f9b0e2a13e`,
  present locally at `~/Desktop/ubuntu-stories` — GitHub is inaccessible from
  here, no `gh` auth). Worth reading directly from that local clone when this
  gets picked up rather than re-deriving:
  - `web/src/components/custom/table.tsx` — owns the filter/search Card row,
    a column-visibility dropdown, the actual `<Table>` render, and a
    pagination footer, all driven by reading/writing TanStack Router search
    params itself (`page`/`limit`/`sort`/`order`). Props: `id`, `data`,
    `columns`, `filters?`, `pagination?`, `visibility?`.
  - `web/src/components/custom/table-column.tsx` — `createDefaultColumn`/
    `createAvatarColumn`-style factory helpers that produce `ColumnDef`s with
    a built-in sortable header (dropdown: Ascending/Descending/Hide).
  - Don't copy verbatim — that version couples to that app's own
    `SelectFilter`/`DateFilter`/`SearchFilter` components and a
    `manualPagination`/`manualSorting` react-table setup that would need
    adapting to this repo's existing search-schema/loader pattern, but the
    props shape and column-factory idea are the right reference.
- Deliberately not done as part of the 2026-08-13 pass — that pass fixed the
  symptoms per-page with exact, scoped diffs; this is the follow-up
  structural fix so they can't drift again.
- Status: **parked, not started.**

## Backend API URL structure — role-first paths

- **Raised 2026-08-09.** User wants backend endpoints to lead with the role,
  e.g. `/manager/dashboard/summary`, `/administrator/dashboard/summary`,
  mirroring a role-first reorganization of `api/src/modules/` (today it's
  resource-first: `modules/dashboard/route.ts` handles
  `/nurse/summary`/`/doctor/summary`/`/admin/summary` under one dashboard
  namespace). Asked directly whether this is REST-compliant.
- **REST answer:** there's no actual rule against role/actor segments in a
  URL — REST is about resource orientation and a uniform interface, not a
  specific path grammar, and plenty of real APIs segment by actor
  (`/me/...`, `/admin/...`). So this isn't "non-RESTful." Two things worth
  being precise about instead:
  - **A role-prefixed URL is never a substitute for server-side
    authorization**, and shouldn't create the impression it is — hitting
    `/administrator/dashboard/summary` as a Nurse must still be rejected by
    the exact same `app.authorize([...])` check as today, regardless of
    which path segment was used to get there. URLs are never an access
    control mechanism by themselves.
  - **Recommend a hybrid, not uniform role-first everywhere:** role-first
    fits cleanly where the resource genuinely differs by role already —
    dashboard summaries are already 4 distinct response schemas today
    (`adminSummaryResponseSchema`, `nurseSummaryResponseSchema`, etc.), and
    moderation/appeal actions are inherently role-specific operations. But
    Patients/Referrals/Facilities reads are the exact same endpoint serving
    multiple roles today, scoped server-side from `request.user.role` — the
    textbook RESTful shape (one resource, auth determines scope, not the
    URL). Fully role-prefixing those too would turn 1 registered route into
    up to 4 per resource, even with the logic itself staying centralized
    via the shared-parameterized-function pattern above — more endpoint
    surface to register and document, working against the "reduce sprawl"
    goal this whole conversation started from. Not yet confirmed which way
    to go on the shared-CRUD resources specifically — flagging the tradeoff
    rather than deciding it.
- **Confirmed 2026-08-09 — split by read vs. write, not by resource:**
  - **Reads stay resource-first, unprefixed:** `GET /patients`,
    `GET /patients/:id`, `GET /referrals`, `GET /referrals/:id`,
    `GET /facilities`, `GET /facilities/:id`. These are the one part of
    this redesign where multiple roles genuinely hit identical semantics —
    same query, same response schema (`PatientSchema`, etc.), same
    endpoint, only the row-level scoping differs, computed server-side from
    `request.user`. There's no real difference to expose in the URL here;
    splitting these into `/manager/patients`, `/nurse/patients`, etc. would
    be pure duplicate routing for zero behavioral gain.
  - **Writes and actions go role-first**, because under the permission
    matrix just finished, they already *are* role-exclusive in practice,
    not just organizationally — Doctor's patient update (`history` only)
    and Nurse's patient update (everything but `facility_id`) aren't really
    the same operation with different degrees of access, they're two
    different operations that happen to touch the same row. Examples:
    `POST /nurse/patients` (create), `PATCH /doctor/patients/:id`,
    `PATCH /nurse/patients/:id`, `PATCH /manager/referrals/:id` (assign
    doctor), `PATCH /doctor/referrals/:id/redirect`,
    `PATCH /administrator/facilities/:id/flag`,
    `PATCH /administrator/facilities/:id/suspend`. All the brand-new
    action endpoints from this redesign (patient transfer request/approve,
    appeal, redirect) are role-exclusive from the start anyway, so this
    isn't retrofitting — it's just making explicit in the URL a split that
    the permission model already made real. Bonus: today's
    `PATCH /referrals/:id` is honestly a little opaque — you have to read
    the handler to discover Nurse and Manager can do very different things
    through what looks like "the same" endpoint. Role-first writes make
    that visible in the route table instead of buried in an `if`.
  - Backend module folders mirror this: `modules/patients/`,
    `modules/referrals/`, `modules/facilities/` keep the shared read
    handlers; `modules/nurse/`, `modules/doctor/`, `modules/manager/`,
    `modules/administrator/` hold the write/action handlers specific to
    each.
  - Doesn't conflict with the frontend going fully role-based (including
    reads, duplicated on purpose) — that's file organization for developer
    ergonomics on one side of the wire, independent of what URL it actually
    calls. `web/src/api/manager/patients.ts` can still call the shared,
    unprefixed `GET /patients`.
- Status: **confirmed.**

## Session log

- **2026-08-08**: During the roles/permissions discussion, user parked three
  items for later: the facilities searchable-select hybrid fix (decision
  captured above), facility specialties + doctor specialty assignment, and
  user self-service profile pages. Also referenced an earlier "employee_id"
  idea from the lost session that needs to be re-asked.
- **2026-08-09**: user profile pages resolved in the main doc, entry here
  superseded. New topic: frontend module organization by role. User pushed
  back on assistant's shared-module caveat and won the argument (thin
  wrappers, low duplication cost, domain already role-divergent) — full
  per-role duplication in the API layer, confirmed. Component layer also
  goes role-based, but URLs stay role-agnostic — thin route-file dispatcher
  pattern proposed. Assistant pushed back on taking component duplication
  too far for pages that are one shared layout with role-gated actions
  (referral/patient detail) rather than genuinely different views
  (dashboard) — not yet resolved.
- **2026-08-12**: new item parked, self-service password change coupled
  with a profile/settings page — raised right after Administrator password
  reset shipped, exposing that no self-service password-change path exists
  anywhere. User explicit: not to be implemented now, just logged.
