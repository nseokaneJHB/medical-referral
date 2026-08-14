# Product Backlog / Parked Ideas

Status: **parking lot.** Ideas raised in passing during other discussions that
aren't being worked yet. When one gets picked up for real, promote it to its
own planning doc (like `docs/roles-permissions.md`) and link back here.

## Employee ID

Referenced from a prior (lost) session — details not recaptured yet. Need to
ask the user what this idea actually entailed before it can be scoped.

## Facilities picker — searchable select (hybrid)

**Resolved — shipped 2026-08-14.** Hybrid async search, confirmed working
end to end (live-verified in browser, not just typechecked) at all 5 real
call sites — the original backlog note claiming "6 screens" was stale:
`patients/new.tsx` and `referrals/index.tsx` never had a facility picker at
all, and `users/index.tsx`'s create-user dialog was missing from the list.

- `web/src/hooks/use-debounced-value.ts` — generic `useDebouncedValue<T>`,
  no debounce dependency existed before this.
- `web/src/hooks/use-facility-search.ts` — wraps search-term state, the
  debounce, and a `useQuery` gated on a non-empty debounced term (true
  hybrid: no eager `page:1/limit:100` load). Takes `enabled`, `excludeId`
  (drop one facility from results — the current one, for transfer/redirect
  pickers) and `status` (e.g. Administrator's create-user dialog still only
  offers `APPROVED` facilities).
- `SelectInput` (`web/src/components/custom/select-input.tsx`) gained three
  purely-additive, opt-in props: `onSearchChange`, `filterMode` (`"client"`
  default vs `"server"`, which flips `shouldFilter` off on the underlying
  `Command`), and `loading` (shows "Searching..." in place of the empty
  state). Every other existing call site is untouched — defaults preserve
  old behavior exactly.
- Applied at all 5 sites: `patients/$patientId.tsx` (transfer dialog,
  excludes current facility), `referrals/new.tsx`, `referrals/$referralId.tsx`
  (the trickiest one — previously one eager query fed both the edit-form
  field and the Redirect dialog via a prop; now each owns its own
  independent `useFacilitySearch` call, since Redirect needs a different
  exclusion than the edit field), `sign-up.tsx`, `users/index.tsx` (create-user
  dialog, `status: APPROVED`).
- Verified live in the browser signed in as Nurse/Doctor/Administrator:
  confirmed no eager list before typing, a single debounced network request
  per pause in typing (not one per keystroke), correct facility exclusion
  in both the transfer and redirect dialogs, and correct `APPROVED`-only
  scoping in the create-user dialog.

## Facility specialties

**Resolved — shipped 2026-08-13.** Administrator-managed `specialties`
reference vocabulary (create/rename, no delete — same no-hard-delete stance
as the rest of the app), assignable many-to-many to both facilities and
Doctor/Nurse staff. Answers to the open questions below as actually built:

- **Doctor/Nurse specialty is fully independent** of their facility's list —
  a personal credential, not derived/constrained by what the facility has.
- **Surfaced in three places**: a dedicated `/specialties` admin page
  (Administrator-only, list/create/rename), a Specialties card on the
  facility detail page (Administrator or that facility's own Manager), and a
  Specialties card on the Doctor/Nurse user detail page (Administrator, or
  the Manager of that Doctor/Nurse's own facility) — badges with inline
  remove plus a searchable add-picker (`SpecialtyManager`, shared between
  both detail pages).
- **Admin-managed controlled vocabulary**, not free text — confirmed, matches
  what the schema already committed to.
- **Referral-routing-by-specialty — picked up and shipped 2026-08-14**, see
  `docs/roles-permissions.md`. A Nurse can tag a referral with needed
  specialties at creation; a Doctor can add/remove tags independently of
  redirecting, from the detail page or from inside the Redirect dialog.
  New `referral_specialties` join table, `canManageReferralSpecialties`
  permission.
- **Facilities filter-by-specialty — picked up and shipped 2026-08-14.** A
  multi-select `Specialty` filter on the Administrator `/facilities` list,
  next to the existing `Status` filter — narrows to facilities offering any
  of the picked specialties. Backend: comma-separated `specialty` query
  param on `GET /facilities`, resolved via `facility_specialties` (batch
  id lookup, same pattern as `getPatientFlagStatuses`) then ANDed into the
  existing visibility/status where-clause. Distinct from the still-parked
  "Facilities picker — searchable select (hybrid)" item above — that one is
  about the plain facility-picker dropdowns silently capping at 100
  results, not about filtering by specialty.
- Backend: `GET/POST /specialties`, `PATCH /specialties/:id` (Administrator
  create/rename); `GET/POST /facilities/:id/specialties`,
  `DELETE /facilities/:id/specialties/:specialtyId`; same three shapes under
  `/users/:id/specialties` and `/referrals/:id/specialties`. Seed data
  (`api/script/seed.ts`) already covered this before the UI did — 2-4
  specialties per operational facility, 1-2 per active Doctor/Nurse,
  including the standard test accounts.

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

**Resolved — shipped 2026-08-15.** Picked up after the facilities-picker
hybrid search (above). A fresh survey at pickup time found the original
2026-08-13 framing was partly stale — Users' status badge was never a binary
success/error (it's a full 6-way map, same shape as Referrals/Facilities),
and Referrals/Patients' create button was never `Link`'s ghost variant (both
already used the filled `default` variant) — so the actual build targeted
the duplication that was real and verified, not the original symptom list:

- **`VariantBadge`** (`web/src/components/custom/variant-badge.tsx`) —
  replaces 5 identical `<Badge variant={MAP[value]}>{stringToTitleCase(value)}</Badge>`
  cell renderers (Users' role/status, Facilities' status, Referrals'
  priority/status) with `<VariantBadge value={x} type="userStatus" />` etc.
  Centralizes all 5 variant maps into one file, keyed by an explicit `type`
  discriminator — deliberately *not* auto-dispatched by scanning which enum
  a value belongs to, because this app's enums genuinely collide on value
  (`PENDING` appears in `USER_STATUS`, `FACILITY_STATUS`, *and*
  `REFERRAL_STATUS`; `REJECTED` the same three; `FLAGGED` in both
  `USER_STATUS` and `FACILITY_STATUS`) — an auto-dispatch design would
  silently pick the wrong variant for at least two of the three colliding
  domains. `type` makes the lookup an exact `VARIANT_MAPS[type][value]`
  double hash-lookup instead of a guess. No icons — considered (a similar
  component, `BadgeWithIcon`, exists in the `ubuntu-stories` reference
  project) and explicitly deferred; would need ~26 icons picked from
  scratch since none of that project's enum values overlap with this app's.
- **`SortableTableHeader`** (`web/src/components/custom/sortable-table-header.tsx`) —
  the sort-icon-toggling header row, byte-identical across all 4 pages
  (confirmed by diff, the single largest duplicated block found). Takes
  `table`, `sortableColumns`, `activeSort`/`activeOrder`, `onSort`, and an
  optional `trailingHeader` (defaults to a blank `<TableHead />`; Users
  passes a custom right-aligned "Actions" cell instead of forcing
  uniformity where the pages genuinely differ).
- **`PaginationFooter`** (`web/src/components/custom/pagination-footer.tsx`) —
  the "Page X of Y · N total" + Prev/Next block, confirmed byte-identical
  across all 4 pages before extracting.
- **`SearchField`** (`web/src/components/custom/search-field.tsx`) — the
  search-input-plus-button pinned right (`ml-auto`). Normalized one small
  accidental divergence: Users/Facilities had drifted to `items-center`,
  Referrals/Patients to `items-end` — not a deliberate choice either place,
  now uniformly `items-center`.
- **Explicitly not built**, against the original framing:
  - **No generic `Table<TData, TValue>` wrapper** from the `ubuntu-stories`
    reference. That component owns sort/page state internally via
    `manualSorting`/`manualPagination: true` react-table config; this app
    owns that state externally, in the URL via each route's Zod search
    schema, with the loader doing the actual server-side sort/page and
    react-table just rendering whatever `data` it's handed. Wrapping the
    reference component here would mean either fighting its internal
    state-ownership assumptions inert, or ripping out the loader/search-
    schema pattern to feed its `pagination` prop (whose shape doesn't match
    this app's API responses anyway) — real risk on no upside, especially
    on `users/index.tsx` (831 lines, real moderation logic). Column defs
    stay inline `columnHelper.accessor(...)` per page, not a factory.
  - **No generic `FilterBar` wrapper.** The actual filter *controls* differ
    genuinely per page (gender/DOB range vs status/specialty vs
    priority/status/date-range vs role/status) — only the search-box piece
    was truly shared, which `SearchField` covers.
  - Facilities' missing create button (no `POST /facilities` route exists —
    facilities are created via sign-up) and Patients' missing status column
    (Patient has no status field) both stayed as-is — not drift to fix, the
    shared pieces are opt-in per page, not forced onto every page.
- Verified: `git diff` exact-match on every generated edit (no delegate
  self-report trusted), a full `pnpm typecheck` pass, and live browser
  testing (signed in as Administrator/Manager) across all 4 pages —
  confirmed badge colors match pre-refactor exactly, sort-toggle updates
  the URL and re-fetches, pagination advances pages, and Enter-to-search
  round-trips through the URL to a filtered result.

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
- **2026-08-14**: referral-routing-by-specialty, previously logged here as
  deliberately out of scope, picked up and shipped — see the Facility
  specialties entry above and `docs/roles-permissions.md`.
- **2026-08-14 (later same day)**: facilities filter-by-specialty picked up
  and shipped too — see the Facility specialties entry above. Also fixed,
  unrelated to any backlog item: `SelectInput` single-select had no way to
  clear a made selection, discovered while testing the specialty picker;
  added a `clearable` prop (shows an "x" next to the chevron, grouped in
  its own flex container so the trigger's `justify-between` doesn't spread
  it away from the chevron) and wired it into `SpecialtyManager`.
- **2026-08-14 (later still)**: user asked for two more parked items, in
  order — facilities picker hybrid search first, then shared list-page
  components. Facilities picker hybrid search shipped, see the entry above
  (corrected the stale "6 screens" claim to the real 5, and decoupled
  `referrals/$referralId.tsx`'s dual-consumer picker into two independent
  searches in the process). Shared list-page components picked up next.
- **2026-08-15**: shared list-page components shipped, see the entry above.
  Scoped down from the original ask after a fresh survey found some of the
  2026-08-13 framing (binary Users badge, ghost-variant create buttons) was
  stale — built `VariantBadge`/`SortableTableHeader`/`PaginationFooter`/
  `SearchField` against the duplication that was actually still there,
  explicitly skipped a generic `Table` wrapper and `FilterBar` (real
  architectural mismatch + genuinely-different-per-page filter controls,
  not worth forcing). Also referenced the `ubuntu-stories` project's badge
  component at its *current* HEAD (not just the originally-pinned commit,
  which turned out to no longer reflect that project's own direction) —
  found it evolved into an auto-dispatch design that would have been an
  actual bug here, since this app's status enums collide on value
  (`PENDING`/`REJECTED` each appear in 3 different enums) in a way that
  project's enums don't.
