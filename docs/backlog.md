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

**Correction, 2026-08-16: this was never actually built — the note below
was describing a design decision, not a shipped feature.**
`docs/roles-permissions.md`'s "Own profile — CONFIRMED (from round 6)"
language (and this entry's own prior "Superseded — resolved" framing)
only meant the *design question* was settled during that planning
session — it lives in the doc's still-`PLANNING` matrix-walkthrough
section, not its "Already shipped" section (the only part of that doc
confirmed live in the codebase). Verified directly: there is no
`PATCH /users/:id` route, no `userUpdate` handler in
`api/src/modules/users/service.ts`, and no route registered for it in
`api/src/modules/users/route.ts` at all — the only user-mutation paths
that exist are the role-scoped moderation endpoints (status changes) and
specialty assign/unassign. **A user cannot edit their own name, or
anything else about their own profile, through any path today** — this
is a real, currently-missing capability, not just a deferred email/
password scope decision. The original design intent (name-only
self-service; never `role`/`facility_id`/`status`) still stands as the
plan whenever this gets built. Specialty self-assignment stays tied to
the still-parked Facility specialties idea above, not yet scoped.
**Note:** the password-change item below reopens the "no password" half
of this — self-service password change needs _some_ profile/settings
page to live on, and building that page would naturally cover both gaps
(name editing and password) at once.

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
    admin-reset is also live and it's the _only_ password-change path.
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
- **Two adjacent gaps found via scenario testing 2026-08-16** (see
  `docs/scenarios/017-...`), worth folding into whatever eventually picks
  this up rather than tracking as separate items:
  - This entry covers a signed-in user changing their own password —
    there's a second, narrower "forgot password while locked out
    entirely" case that a settings-page change form alone wouldn't
    solve, since it requires being able to authenticate first. Today
    that case has exactly one path: ask an Administrator to reset it for
    you (`userResetPassword`,
    `api/src/modules/administrator/service.ts:707-753`) — there's no
    email-based recovery flow, and better-auth's own `forgetPassword`/
    `resetPassword` endpoints are configured but dark (no
    `sendResetPassword` callback supplied, `api/src/lib/auth.ts:41-48`).
  - **An Administrator's password reset doesn't invalidate the target's
    existing sessions.** `userResetPassword` only writes
    `account.password` and `must_change_password` — it never touches the
    `session` table. If a reset is happening *because* an account was
    compromised, whatever session the attacker already holds stays valid
    until its own natural expiry (`SESSION_EXPIRES_IN`, 7 days by
    default) or a manual sign-out; the reset doesn't evict anyone.
  - **The reset itself isn't written to the persisted audit trail.**
    `api/src/modules/administrator/service.ts` never calls
    `core.timeline.create` for this or any other administrator action —
    it only sets a Fastify event name that feeds the structured request
    logger (`api/src/middleware/logging.ts`), not the product's own
    Manager/Administrator audit UI (`api/src/management/audit.ts`).
    There's no queryable record inside the app itself of who reset whose
    password and when.

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
  _same_ call for every role with only server-side scoping differing
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
  that, not reimplement it — it's the request _shaping_
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
  _same_ thing a shared component like `referrals/$referralId.tsx` consults
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
    deciding whether the _evaluation_ logic (not just the rules/constants)
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
  discriminator — deliberately _not_ auto-dispatched by scanning which enum
  a value belongs to, because this app's enums genuinely collide on value
  (`PENDING` appears in `USER_STATUS`, `FACILITY_STATUS`, _and_
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
- **Revisited 2026-08-15 (later same day): generic `Table` built after
  all.** The reasoning above against wrapping the `ubuntu-stories` reference
  component still stands — that component owns sort/page state internally
  via `manualSorting`/`manualPagination: true`, a real mismatch with this
  app's URL-driven, loader-computed state. But the user pushed back on
  conflating "don't port that specific implementation" with "can't build a
  generic table at all," and reconsidered using vanilla
  `@tanstack/react-table` for a from-scratch wrapper matching this app's
  actual pattern. Checking the 4 pages confirmed columns were already
  properly defined via `createColumnHelper` and rendered through
  `flexRender` — the only remaining duplication was the row-body loop
  (empty-state row, `getRowModel().rows.map()` + cell `flexRender`, trailing
  action cell) sitting next to `SortableTableHeader`. Built
  `Table` (`web/src/components/custom/table.tsx`) wrapping both: takes
  `table`, `sortableColumns`/`activeSort`/`activeOrder`/`onSort` (passed
  through to `SortableTableHeader`), `emptyMessage`, and a `rowAction: (row)
=> ReactNode` render prop for the divergent trailing cell (Users needs a
  `RowActionsMenu` dropdown with role-conditional moderation items; the
  other 3 pages need a plain `View` link) plus `rowActionClassName` for
  Users' right-aligned variant. `columnCount` for the empty-state `colSpan`
  is derived from `table.getAllColumns().length`, not passed as a prop.
  Named `Table` (not `GenericTable`) — collides with `ui/table.tsx`'s
  `Table`, resolved the same way the codebase already resolves this exact
  collision in `custom/input.tsx`: alias the shadcn import
  (`Table as ShadCnTable`) inside the custom file, export the plain name.
  Also checked the official TanStack Table docs
  (tanstack.com/table/latest/docs/overview) for anything else worth
  adopting — column visibility/pinning/resizing, row selection, global
  filtering/faceting, virtualization. None apply: this app's tables only
  ever hold one already-server-filtered, already-paginated page of data (no
  full dataset ever reaches the client for client-side filtering/faceting to
  operate on), page sizes are small enough that virtualization has no
  target, and there's no current bulk-action requirement that would justify
  row selection. The codebase's existing `createColumnHelper` + `flexRender`
  usage was already the idiomatic pattern; no manual-mode flags needed since
  the loader, not react-table, computes the page.
  - **No generic `FilterBar` wrapper.** The actual filter _controls_ differ
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
    matrix just finished, they already _are_ role-exclusive in practice,
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
  component at its _current_ HEAD (not just the originally-pinned commit,
  which turned out to no longer reflect that project's own direction) —
  found it evolved into an auto-dispatch design that would have been an
  actual bug here, since this app's status enums collide on value
  (`PENDING`/`REJECTED` each appear in 3 different enums) in a way that
  project's enums don't.
- **2026-08-15 (later still)**: user asked to (1) fix the actual collision
  bug confirmed to exist in `ubuntu-stories`' `BadgeWithIcon` — `CHILDREN`
  is a value in both its `CATEGORIES` and `AGE_GROUPS` enums, and its
  auto-dispatch `GROUP_HANDLERS.find(g => g.check.includes(value))` would
  silently resolve an `AgeGroup` of `CHILDREN` to the `Category` handler
  (whichever enum is listed first in the array wins) — reachable in practice
  via `story-card.tsx`, which renders both `story.group` and `story.category`
  badges side by side. Fixed in that repo (outside this one, no CLAUDE.md
  delegation constraint applies there) the same way `VariantBadge` was
  fixed here: replaced the enum-scanning auto-dispatch with an explicit
  `type` discriminator prop and a direct `Record<type, handler>` lookup,
  updated all 9 call sites. Then (2) built the generic `Table` — see the
  updated entry above — after reconsidering that vanilla
  `@tanstack/react-table` (not the reference repo's specific
  implementation) was never actually ruled out, only that repo's
  manual-mode design was. TanStack Table docs review folded into that same
  entry.
- **2026-08-15 (later still)**: mid-verification of the `Table` component,
  user raised a general concern — feature-specific components that own their
  own state, especially data-fetching, shouldn't sit in
  `components/custom/` alongside genuinely generic/reusable pieces.
  Confirmed one clear-cut instance: `medical-history.tsx` had exactly one
  call site (`patients/$patientId.tsx`) and owned two layers of its own
  `useQuery` fetching (the referral list plus local page state, and a
  nested per-row `VisitTimeline` sub-component with its own fetch) — not a
  reusable primitive, just misplaced. Considered TanStack Router's `-`
  prefix route-adjacent-folder convention (`patients/-components/`, ignored
  by the route-tree generator) but user preferred grouping under the
  existing `components/` root instead of introducing a second `components`
  folder nested inside `routes/`. Moved to
  `web/src/components/patients/medical-history.tsx` (`git mv`, single
  import line updated in `$patientId.tsx`), establishing `<domain>/` as a
  new sibling convention to `ui/` and `custom/` for components tied to one
  feature area. Checked two secondary candidates: `breakdown-chart.tsx` is
  also single-use (dashboard only) but owns no state, so left as-is;
  `specialty-manager.tsx` and `stat-card.tsx` both have 2+ real call sites
  and no owned fetch, confirmed legitimately shared. **Corrected
  immediately after**: user pointed out `specialty-manager.tsx` belonged in
  the same bucket — re-read it and the "no owned fetch" test was too
  narrow. It's typed against `SpecialtyRef` (a specialty-domain type, not a
  generic shape) and owns its own assign/unassign UI state
  (`selected`/`assigning`/`removingId`), even though the actual mutation
  calls are injected via `onAssign`/`onUnassign` props — the real test is
  whether the component is _about_ a specific feature, not whether it calls
  fetch directly. It has 4 call sites across 3 domains (`users/$userId`,
  `facilities/$facilityId`, `referrals/new`, `referrals/$referralId`), so —
  unlike `medical-history` — no single domain folder was the obvious home;
  moved to `web/src/components/specialties/specialty-manager.tsx`, named
  for what the component manages rather than who calls it. Re-audited the
  rest of `custom/` against the corrected test: `timeline-list.tsx` and
  `breakdown-chart.tsx` both confirmed genuinely generic (stateless, take
  fully generic prop shapes) despite `breakdown-chart` currently having
  only one caller — different from `specialty-manager`, which is
  domain-typed even without an owned fetch.
- **2026-08-15 (later still)**: user asked for row-action consistency —
  every list table should put its row action(s) behind the same ellipsis
  (`RowActionsMenu`) pattern `users/index.tsx` already used, instead of a
  bare "View" link/button. Converted `referrals/index.tsx` and
  `patients/index.tsx` (both already on the new `Table` component) to wrap
  their `rowAction` in a `RowActionsMenu` with one `DropdownMenuItem asChild`
  (`Link as RouterLink` + `EyeIcon` + "View"), plus a right-aligned "Actions"
  `trailingHeader`. Caught a tracking error mid-task: `facilities/index.tsx`
  had never actually been migrated to the new `Table` component — despite
  being tracked as done alongside `referrals`/`patients` — it was still on
  raw `TableRow`/`TableBody`/`TableCell` with a plain `Link` "View" button.
  The delegated haiku agent correctly flagged the mismatch against its
  instructions instead of guessing, which surfaced the gap; did the `Table`
  migration and the `RowActionsMenu` conversion for that file together in
  one corrected pass. All three verified via `git diff` (exact match),
  a clean solo `pnpm typecheck`, and a live browser pass signed in as both
  Administrator (facilities) and Doctor (patients, referrals) — ellipsis
  opens, single "View" item renders correctly, navigation works, no header
  misalignment at any of the three pages' different column counts. No lint
  script exists in this repo (`turbo lint` has no registered task), so
  typecheck was the only automated check available.
- **2026-08-15 (later still)**: user asked for `SortableTableHeader` to be
  inlined into `custom/table.tsx` (no other call sites) and for
  `back-link.tsx` to move to `components/` root alongside
  `sign-out-button.tsx` (both one-off app-shell singletons, not
  domain-typed or generic/reusable). Both delegated with exact full-file
  content, verified via `git diff`/`grep`/typecheck. Then ran a full
  monorepo audit (background fork, briefed on the settled `ui/`/`custom/`/
  `<domain>/`/root component-organization convention so it wouldn't
  re-flag that) — 7 findings reported: 4 react-hook-form violations and a
  dead ESLint wiring were prioritized.
- **2026-08-15 (later still)**: fixed the 4 react-hook-form violations
  (`FlagPatientAction` and `RequestTransferAction` in
  `patients/$patientId.tsx`; `RedirectReferralAction` and the referral
  status-update notes field in `referrals/$referralId.tsx`) and wired up
  ESLint. Flag/unflag reused the existing `moderationReasonSchema`/
  `approveActionSchema` pair via a per-instance ternary schema (flagging
  requires a reason, unflagging's note is optional); transfer and redirect
  reused `transferRequestSchema`/`redirectReferralSchema` outright; the
  status-update notes field uses `useForm`/`useFormField` without a
  `zodResolver` since no single static schema fits its N different
  transition-button requiredness rules — reason enforcement stays
  per-button. ESLint: added `"lint": "eslint ."` to all three package.json
  files (turbo's `lint` task existed but no package defined the script, so
  `pnpm lint` silently no-opped) and fixed the 6 pre-existing
  `no-unused-vars` errors that surfaced (`useQuery` dead in
  `users/index.tsx` and `sign-up.tsx`; `CheckCheckIcon`/`PauseCircleIcon`
  dead in the dashboard route; `isTerminal`/`TERMINAL_REFERRAL_STATUSES`
  dead in the referral detail route). Live browser testing (Doctor/Nurse
  roles) caught a real regression before it shipped: `FlagPatientAction`
  and `RequestTransferAction` are rendered *inside* `PatientDetailPage`'s
  own patient-edit `<form>`; converting them to real `<form>`+`type=submit`
  elements meant their submit event bubbled through the React tree (Radix
  `Dialog` portals DOM location but not React-tree event bubbling) into the
  outer form's `onSubmit`, silently double-submitting the whole patient
  record on every flag/transfer action — surfaced as a stray "Forbidden"
  toast for a Doctor (who can't edit patient records) stacked on the
  intended action's own toast. Fixed with `event.stopPropagation()` in
  both inner forms' `onSubmit`; re-verified via network-request inspection
  (exactly one PATCH per action, no stray second request) and console
  checks. Separately surfaced, **not fixed** (pre-existing, out of scope
  for this task): neither patient nor referral detail page refreshes its
  `Route.useLoaderData()`-sourced fields in place after a mutation —
  `invalidatePatient`/`invalidateReferral`'s `queryClient.invalidateQueries`
  + `router.invalidate({ sync: true })` doesn't repaint the loader data
  without a full navigation/reload, even though the mutation and its
  server-side effect are correct (confirmed via React Query devtools: the
  `["patients","detail",id]` query has zero active observers, and a
  directly-subscribed `useQuery` on the same referral page, e.g. the
  status-history timeline, *does* refresh live). Affects every mutation on
  both detail pages (save, flag/unflag, transfer, redirect, status
  update), predates this session's changes, and needs a dedicated
  investigation — likely either subscribing loader data via `useQuery`
  instead of `Route.useLoaderData()`, or finding why `router.invalidate()`
  isn't re-running the loader's `ensureQueryData` as a real refetch.

## Administrator audit page shows logins only, not actual actions

**Status:** Open — found via scenario testing 2026-08-15 (see
`docs/scenarios/001-...`). Not a defect (the page does what it's coded to
do) — a scope gap worth deciding on.

The real-world story this surfaced from: an Administrator needs to
reconstruct who did what to a referral/patient/facility after something
goes wrong, and opens `/audit` expecting that trail. What they get is
`AdministratorLoginAudit` (`web/src/routes/_authenticated/audit/index.tsx`)
— purely session data from the `logins` table (login/logout time, IP,
device, success/failure) via `api/src/modules/audit/service.ts`'s
`logins` handler. There's no way to see that a referral was flagged,
redirected, transferred, or had its status changed — who did it, when, or
why.

That richer trail already exists in the codebase, just scoped to a
different role: `AuditManager.listForFacility`
(`api/src/management/audit.ts`) assembles exactly this — a merged,
paginated feed over the `timeline` table (referral status changes, doctor
assignment, redirects, transfers, flags, appeals, facility/user actions)
— and powers `ManagerFacilityAudit` on the very same `/audit` page, but
only for Managers, and only for their own facility (`listForFacility`
resolves the facility's own staff/patient/referral ids first, then
filters `timeline` to those).

So Administrators — the role most likely to need cross-facility
incident reconstruction — see less than Managers do on the same page.
Open questions to resolve before picking this up: should Administrators
get a global (non-facility-scoped) version of `AuditManager`'s feed,
merged with or alongside the login data they already see? Is there a
reason (perf, noise, intentional scoping) the two were kept separate that
isn't obvious from the code?

## Referral staleness has no UI signal

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/002-...`). Not a defect — a scope gap.

The real-world story: a referral sits `PENDING` for days because it fell
through the cracks between two facilities who each assume the other is
handling it. Today, nothing in the app would draw a Nurse, Doctor, or
Manager's attention to that referral over any other:

- `api/src/modules/dashboard/service.ts`'s Nurse/Doctor/Admin/Manager
  summaries all expose a raw `pending` count, but no age/staleness
  breakdown (e.g. "pending > 3 days") — every pending referral counts the
  same regardless of how long it's been sitting.
- The referral list (`web/src/routes/_authenticated/referrals/index.tsx`)
  has no visible "Created"/date column at all — `SORTABLE_COLUMNS`
  declares `created_at` as sortable, but no rendered column uses that id,
  so there's no header to click and no way to eyeball or sort the list
  oldest-first even manually. (A related bug — `sort=created`, the
  previous mismatched id, crashing every list endpoint with a 500 — was
  found and fixed 2026-08-16; this UI gap is separate and still open.)
- The referral detail page's "Timeline" section only shows *status
  changes* — a referral that has had zero status changes since creation
  (the exact stuck-in-limbo case) shows "No status changes yet." with no
  indication of how long that's been true.
- Referrals have no flag/escalation mechanism at all (unlike Patients,
  which Doctors can flag) — even a Nurse who manually notices a stale
  referral has no in-app way to escalate it beyond the free-text "Reason
  for this change" field on a status transition.

Open questions to resolve before picking this up: should this be a
dashboard-level "stale pending referrals" indicator, a sortable/visible
created-date column, a referral-level flag capability, an automated
age-based notification, or some combination? A real "Created" column
would be the cheapest partial fix, now that the underlying `created`/
`created_at` naming mismatch is fixed.

## No appeal mechanism for rejected referrals

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/003-...`). Not a defect on its own — a scope gap, though
it currently can't even be reached in practice (see BUG-006: a referral
can never actually be rejected through the live app (fixed), which was
the actual blocker on walking this end to end today).

The real-world story: a Nurse refers a patient, the referral gets
rejected, and she needs some way to either contest that decision or move
forward efficiently. Today, an appeal mechanism exists in this codebase —
`ACCOUNT_APPEAL`, `MANAGER_FACILITY_APPEAL`, and the
`ADMINISTRATOR_APPEAL_*`/`MANAGER_APPEAL_*` approve/deny endpoints — but
it's scoped entirely to **account and facility status** (a rejected
Manager/Doctor/Nurse application, a rejected facility signup). There is no
equivalent for a rejected *referral*: no `canAppeal`-style permission
function, no appeal endpoint, nothing in `permission.ts` or
`referrals/service.ts` that references appeals at all.

Confirmed live (via an existing seeded `REJECTED` referral, viewed as its
assigned Doctor): once a referral reaches `REJECTED`, the detail page
becomes fully read-only — no "Update status" section, no editable
destination/priority/doctor fields, no specialty add/remove controls.
The only way forward is `Create referral` from scratch, which has no
pre-fill from the rejected one (confirmed in
`web/src/routes/_authenticated/referrals/new.tsx` — a blank form, no
`useSearch()`-driven seeding) — every field, including patient, facility,
reason, and specialties, has to be re-entered by hand.

Open questions to resolve before picking this up: should rejection be
appealable at all (vs. cancel-and-resubmit being the intended path), and
if so, to whom (the destination facility's Manager? cross-facility to an
Administrator, mirroring how account appeals work)? Separately, even
without a formal appeal, a lower-effort win would be letting `Create
referral` optionally pre-fill from an existing referral (rejected or
otherwise) instead of starting blank every time.

## No facility load/capacity visibility, and Redirect is single-referral, Doctor-only

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/004-...`). Not a defect — a scope gap. (A real defect found
in the one redirect flow that does exist today, BUG-007 — the detail page
not repainting after a redirect — was found the same day and has since
been fixed; see git history.)

The real-world story: a facility gets overloaded with incoming referrals —
more `PENDING` intake than its Doctors can reasonably work through — and
needs to redirect that load elsewhere before patients start waiting
unreasonably long. Today, nothing in the app helps with either half of
this:

- **No concept of facility load or capacity anywhere.** The `facilities`
  table (`api/src/drizzle/schema/facility.ts`) has no capacity/bed/staffing
  column. `managerSummary`
  (`api/src/modules/dashboard/service.ts:175-247`) counts a Manager's own
  facility's referrals by status, but there's no cross-facility comparison,
  no age/volume threshold, and no alerting — a Manager can't tell "we're
  carrying more pending referrals than we should" from anything the app
  surfaces, only eyeball a raw count. The Manager dashboard
  (`web/src/routes/_authenticated/index.tsx`) doesn't even give pending
  referrals their own stat card the way it does for pending
  staff/transfer applications.
- **No "closed for intake" facility flag.** `FACILITY_STATUS`
  (`PENDING`/`APPROVED`/`REJECTED`/`FLAGGED`/`SUSPENDED`) is explicitly
  documented as Administrator moderation states, not a
  capacity/availability switch — there's no self-service way for a
  Manager to temporarily signal "don't route new referrals here."
- **Redirect itself (`PATCH /referrals/:id/redirect`,
  `api/src/modules/referrals/service.ts:484-611`) is Doctor-only, one
  referral at a time.** `canRedirectReferral`
  (`api/src/lib/permission.ts:124-133`) never grants Managers this action,
  even though a Manager is the role most likely to notice and want to act
  on facility-wide overload. There's no bulk "redirect all pending
  referrals needing specialty X" action — a Doctor has to open each
  referral individually. Redirect does correctly prevent ping-ponging a
  referral back to a facility it's already visited (origin, current
  destination, or any prior redirect hop), and requires a reason, which
  cross-checked cleanly against the live behavior.

Open questions to resolve before picking this up: should overload
detection be a simple threshold/count surfaced on the Manager dashboard,
or something richer (age-weighted, per-specialty)? Should a Manager be
able to trigger redirects directly, or only flag the facility so Doctors
know to redirect proactively? Is a facility-level "not accepting new
referrals" flag worth adding, and if so, should it silently exclude the
facility from new referral creation, or just warn?

## No specialty-match validation at referral creation, assignment, or redirect

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/005-...`). Not a defect — nothing crashes or behaves
incorrectly against its own logic; it's a missing safeguard at every point
where a specialty mismatch could be caught.

The real-world story: a Nurse refers a patient needing a specialty (e.g.
Orthopedics) to a facility that doesn't actually offer it, or a Doctor
without that specialty ends up assigned to the case — and nothing in the
app notices at any of the three points where it plausibly could:

- **Referral creation** (`web/src/routes/_authenticated/referrals/new.tsx`):
  the destination-facility picker and the "specialties needed" picker are
  fully independent — the facility field never filters by, or even
  displays, what the selected facility actually treats. Backend
  `referralCreate` (`api/src/modules/referrals/service.ts:100-141`)
  doesn't check the destination's status or specialties either — unlike
  `referralRedirect`, which does check `FACILITY_STATUS.APPROVED`
  (line 538), creation has no equivalent check at all.
- **Doctor assignment**, both self-assign (`referralAssign`,
  `api/src/modules/referrals/service.ts:386-473`) and Manager-assign
  (`referralUpdate`, lines 260-376): neither checks the assignee's
  `user_specialties` against the referral's `referral_specialties`
  anywhere in the stack — not in the backend handlers, not in the
  frontend permission predicates (`canSelfAssignReferral`/
  `canAssignDoctorToReferral`, `web/src/lib/permissions.ts:66-91`), not
  in the doctor-picker dropdown (which lists all Doctors platform-wide,
  not even filtered to the destination facility). Confirmed live: signed
  in as `doctor@gmail.com` (specialty: Psychiatry only), self-assigned a
  seeded referral needing Internal Medicine — succeeded silently, no
  warning anywhere.
- **Redirect** (`RedirectReferralAction`,
  `web/src/routes/_authenticated/referrals/$referralId.tsx:135-260`): the
  one recourse a Doctor has after noticing a mismatch. Its facility picker
  uses the same generic `useFacilitySearch` hook as everywhere else
  (`web/src/hooks/use-facility-search.ts:9-39`), which only ever sends
  `search`/`status`/`page`/`limit` — there's no `specialty` param, even
  though the same dialog lets the Doctor edit the referral's needed-
  specialty tags in place. A Doctor can fix the specialty tag and then
  immediately redirect to a facility with zero overlap, with nothing
  flagging the mismatch either way.

The one interesting wrinkle: the actual filtering capability already
exists end-to-end on the backend — `GET /facilities`'s `specialty` query
param (`api/src/modules/facilities/service.ts:126-137`,
`shared/src/schema/facility.ts:24-27`) is fully generic and already
powers the Administrator `/facilities` list's specialty filter. It's
simply never wired into `useFacilitySearch`, so referral creation and
redirect — the two pickers that would actually benefit — never get to use
it. This is a narrower fix than it might look: extend `useFacilitySearch`
to accept and forward an optional `specialty` filter, then decide whether
to hard-filter or just warn.

Seed data (`api/script/seed.ts`) avoids the facility half of this by
construction — `facilitySpecialtyMap` picks each referral's needed
specialty from its destination facility's actual specialty set
(lines 1097-1099) — but doesn't guard the doctor half: `assignedDoctor`
(lines 1092-1095) is picked from the destination facility's Doctors with
no specialty filter, so seed data already latently reproduces the
doctor-assignment gap even without any live testing.

Open questions to resolve before picking this up: should a specialty
mismatch hard-block (facility can't be selected/redirected to at all) or
just warn (the mismatch might be intentional — a generalist facility
taking an unusual case)? Same question for doctor assignment. At minimum,
wiring `specialty` through `useFacilitySearch` for the redirect and
creation pickers looks like a clean, low-risk first step regardless of
which direction the rest goes.

## No way to identify or hold accountable a staff member sitting on stale referrals

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/006-...`). Not a defect on its own — a scope gap. (A real
defect found in the same investigation, BUG-008 — reassigning a referral's
doctor past `PENDING` leaves no audit trail — is tracked separately in
`docs/bugs.md`.)

The real-world story: even once a stale referral is noticed (see the
existing "Referral staleness has no UI signal" entry above), a Manager or
Administrator still can't easily answer "whose fault is this, and who
should I follow up with?" Confirmed absent across every angle checked:

- **No per-doctor workload view.** `managerSummary`
  (`api/src/modules/dashboard/service.ts:176-257`) groups referral counts
  only by status, never by `doctor` — there's no "Dr. X has 8 pending,
  oldest from 12 days ago" anywhere. Workload is only visible at the
  facility-aggregate level, not broken down by who's actually holding
  each case.
- **The audit feed can't be filtered or aggregated by staff member.**
  `AuditManager.listForFacility` (`api/src/management/audit.ts:60-130`) is
  a flat, paginated, chronological log with no `groupBy` and no
  filter-by-changer parameter — confirmed in both the service and the
  Manager audit page's search schema
  (`web/src/routes/_authenticated/audit/index.tsx:56-59`, `page`/`limit`
  only). A Manager wanting to know which Doctor has the most untouched
  referrals has to read the whole log row by row and tally it themselves.
- **Disabling an unresponsive Doctor's account does nothing to their
  in-flight referrals.** `ModerationManager.applyUserStatusChange`
  (`api/src/management/moderation.ts:66-101`), which backs both Manager
  and Administrator staff-disable flows, only updates the user's own
  `status` and writes a `USER`-type timeline row — no query against
  `referral` at all, no reassignment, no flag on the affected referrals.
  A Doctor's non-terminal referrals stay silently assigned to a
  now-locked-out account with no visible signal anywhere (confirmed
  `REFERRAL_INCLUDE.assignedDoctor` only selects `{ id, name }`, not
  `status`, so even the referral response itself can't reveal this).
- **No deadline/SLA concept exists anywhere** to even formally define
  "stale" in the first place — a repo-wide grep for
  sla/deadline/due-date/escalation/overdue-style terms across the schema
  and shared constants returned nothing.
- **The same gap blocks ordinary staff turnover, not just discipline** —
  confirmed via scenario testing 2026-08-16 (see
  `docs/scenarios/011-...`). A Doctor or Nurse who quits, transfers
  elsewhere, or is terminated hits the identical "referrals stay silently
  assigned to a now-locked-out account" outcome described above, since
  `DISABLED` is the only real status-change mechanism that exists today.
  The codebase already anticipates a distinct, softer path for this:
  `USER_STATUS.DEPARTED` / `TIMELINE_ACTION.DEPARTED`
  (`shared/src/constant.ts:293,365`), explicitly commented as "reserved
  for self-requested account closure — not set by anything in this pass,
  added now so the enum doesn't need another migration later"
  (`shared/src/constant.ts:280-285`). It's fully wired into display code
  (audit log labels/badges) and even has realistic seed/demo data
  (`api/script/seed.ts:562-567,825-840`), but no route, handler, or UI
  affordance anywhere ever produces one for a real user — there's no
  "Depart" action next to Approve/Reject/Flag/Disable on the staff page
  (`web/src/routes/_authenticated/users/index.tsx:137-272`), and no
  `departStaff` API client function exists
  (`web/src/api/users.ts:98-190`). So even once built, `DEPARTED` would
  need to solve caseload handoff itself — going through the same generic
  `applyUserStatusChange` as `DISABLED` today would inherit this exact
  gap rather than fix it.

Open questions to resolve before picking this up: is per-doctor workload
best surfaced on the Manager dashboard, the audit page, or both? Should
disabling a Doctor trigger an automatic reassignment prompt, or just
surface a "N referrals need reassignment" banner for the Manager to act
on manually? Is a formal SLA/deadline concept worth building at all, or is
a simpler relative-age signal (per the existing staleness backlog item)
enough to make accountability questions answerable without a full
deadline system? Should a real `DEPARTED` flow require caseload
reassignment to be resolved before the status change is allowed to
complete, rather than leaving it as a follow-up step like `DISABLED`
does today?

## Facility moderation (FLAGGED/SUSPENDED) doesn't actually restrict referrals

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/007-...`). Not a defect — the app's own code comment on
`FACILITY_STATUS` (`shared/src/constant.ts`, above the enum) already says
this out loud: "Enforcement of what either actually restricts on
Patients/Referrals is out of scope this pass — only the status
transitions + recorded reason exist for now." This entry is the concrete
inventory of exactly what that leaves unenforced.

The real-world story: an Administrator suspends a facility mid-investigation
— fraud, a compliance violation, whatever the reason — expecting that to
actually freeze new activity involving that facility. Confirmed, precisely:

- **`SUSPENDED` is enforced, but only as a blanket account lockout tied to
  the caller's own employer facility**, via `UNUSABLE_FACILITY_STATUSES`
  (`api/src/lib/permission.ts:36-41`) and the `authorize` middleware
  (`api/src/middleware/authorize.ts:49-61`), which 403s *every* role-gated
  request from a user whose own `facility_id` is suspended. This has
  nothing to do with which facility a given referral touches — it's "is
  your own employer suspended," not "is either side of this referral
  suspended." A Doctor at Facility A can freely create/redirect referrals
  into Facility B even if B was suspended five minutes ago.
- **`FLAGGED` is not in `UNUSABLE_FACILITY_STATUSES` at all** — despite
  being documented as "the lighter, exit-only carve-out" — so it produces
  literally zero enforcement anywhere, not even the blanket account
  lockout SUSPENDED gets.
- **`referralCreate` never checks facility status at all**
  (`api/src/modules/referrals/service.ts:100-141`) — not APPROVED
  (already known), not FLAGGED, not SUSPENDED. The only thing stopping a
  Nurse from creating a referral into a suspended facility through the web
  UI is that the destination-facility *picker* defaults to APPROVED-only
  results (`api/src/modules/facilities/service.ts:87-88`) — a client-side
  convenience filter, not a server-side guarantee. A direct API call with
  a suspended facility's id as `destination_facility_id` succeeds
  unconditionally.
- **No sweep or cascade runs when a facility's status changes.**
  `ModerationManager.applyFacilityStatusChange`
  (`api/src/management/moderation.ts:104-139`) only updates the facility
  row and writes one timeline entry — it never touches the `referral`
  table. Every `PENDING`/`ACCEPTED`/`IN_PROGRESS` referral already
  connected to a facility that gets flagged or suspended continues
  completely unchanged, with no flag, no visible marker, nothing.
- **No origin-vs-destination distinction exists anywhere** — the one
  status check that does exist (`referralRedirect`'s
  `destination.status !== FACILITY_STATUS.APPROVED`,
  `api/src/modules/referrals/service.ts:538`) only ever looks at the *new*
  destination on that one action; nothing else in the referral module
  reads facility status in either direction.
- **The referral screen itself can't show this even if someone wanted
  it to.** `REFERRAL_INCLUDE` (`api/src/modules/referrals/service.ts:73-79`)
  selects only `{ id, name }` for both `origin_facility` and
  `destination_facility` — the facility `status` field never makes it
  into the referral API response, so a Nurse/Doctor/Manager looking at a
  referral has no way to discover that one side of it is under a
  moderation hold without separately navigating to that facility's own
  detail page.

Open questions to resolve before picking this up: should `SUSPENDED`
block new referrals *into* that facility specifically (destination-aware,
independent of the account-lockout mechanism), block new referrals *out
of* it, or both? Does `FLAGGED`'s "exit-only" intent mean existing
referrals should still be workable to completion but new ones blocked —
and if so, should `referralCreate` finally get a real status check to
match what `referralRedirect` already does? Is surfacing facility
moderation status on the referral screen itself (even just a badge) worth
doing regardless of which enforcement direction gets picked?

## Patient transfer doesn't account for in-flight referrals, and referral access doesn't follow the patient

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/008-...`). Not a defect — nothing crashes and each piece
individually looks like a reasonable, deliberate design choice; the gap
is in how two independently-reasonable designs interact.

The real-world story: a patient with an active, in-progress referral gets
transferred to a different facility entirely (their whole care moves, not
just one referral) — and continuity of care depends on the new facility
actually being able to see and act on what was already in motion.

- **Transfer requests never check for in-flight referrals at all.**
  `transferRequest` (`api/src/modules/transfers/service.ts:93-152`) only
  checks: patient exists, requester is Nurse/Doctor at the patient's
  current facility, destination differs from current facility, no other
  transfer is already open for this patient, destination is `APPROVED`.
  Nothing queries the `referral` table. A patient can be transferred away
  mid-referral with zero acknowledgment that one exists.
- **A referral's facility linkage is permanently frozen at creation time
  and never follows the patient.** `origin_facility_id`/
  `destination_facility_id` are captured once when a referral is created
  (or redirected) and never updated afterward — confirmed by the code's
  own docstring in `api/src/modules/referrals/service.ts` stating
  `origin_facility_id` is "resolved server-side from the patient, never
  the request" at creation time, with no equivalent sync on later patient
  moves. Referral view/act permissions (`canViewReferral`,
  `api/src/lib/permission.ts:92-116`) key entirely off the referral's own
  frozen facility fields, not the patient's current `facility_id`.
- **The practical consequence**: after a transfer completes, the **old**
  facility's staff retain full visibility into any referral created while
  the patient was there, even though the patient has physically moved on
  — and the **new** facility's staff get no automatic visibility into
  that same referral unless it happens to already name their facility.
  A patient's referral history doesn't travel with them; it stays
  attached to whichever facilities were actually party to each referral.
  Combined with the first point, a receiving facility could have zero
  way to know an active referral for their new patient even exists.
- Two independent, narrower design choices are already deliberately
  documented elsewhere and aren't in question here: referral creation
  intentionally allows a patient to have multiple simultaneous active
  referrals (not a bug), and the two-sided transfer approval flow itself
  is solid — a second transfer can't be opened while one is pending
  (`TransferManager.isOpen`, `api/src/management/transfer.ts:108-111`),
  closing off any live experiment with a stacked/racing transfer.

Open questions to resolve before picking this up: should requesting (or
approving) a transfer surface the patient's currently-open referrals so
the deciding Managers can make an informed call, and/or require an
explicit decision about what happens to them? Should a completed
transfer automatically extend view access on open referrals to the new
facility (a targeted permission exception), or is the cleaner fix to
require in-flight referrals to be resolved/redirected before a transfer
can complete at all?

## Referral priority is purely cosmetic, and there is no notification system at all

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/009-...`). Not a defect — priority does exactly what its
own code implies it does (a stored, filterable, color-coded label); the
gap is the real-world expectation a "Priority: Urgent" field naturally
sets that isn't backed by anything.

The real-world story: a Nurse marks a referral Urgent because the patient
needs care fast, expecting that to actually change something — get seen
sooner, stand out, alert someone. Confirmed, precisely:

- **Priority affects zero server-side business logic.** Assignment,
  auto-accept, redirect, and every status-transition rule
  (`api/src/modules/referrals/service.ts`) key exclusively off `status`,
  `role`, and facility/ownership — `priority` is read only for list
  filtering (`referrals()`, line 189-190) and a pure count aggregation on
  the reports page (`api/src/modules/reports/service.ts:56-81`). There is
  no escalation timer, no priority-based queue ordering, no priority-gated
  permission anywhere.
- **Referral lists never default-sort by priority** — `parseSortList`
  falls back to `created_at` (`api/src/modules/referrals/service.ts:199`)
  when no sort is specified. An Urgent referral only rises to the top of
  anyone's view if a user manually clicks the Priority column header.
- **No dashboard gives Urgent referrals any distinct treatment.** Every
  role's dashboard (`web/src/routes/_authenticated/index.tsx`) shows the
  same generic priority breakdown chart as every other status — no
  dedicated "Urgent referrals" stat card, no warning banner, no
  re-sorting. The one warning-colored callout that does exist on any
  dashboard (the Manager's, for pending staff/transfer applications) is
  unrelated to referral priority entirely.
- **There is no notification system anywhere in this app** — no email, no
  in-app alert, no push, confirmed by a zero-match grep for "notif" across
  the entire codebase. Even if priority *did* drive some internal
  escalation rule, there'd be no mechanism to actually tell anyone about
  it.
- **Only the original referring Nurse can re-triage priority later**
  (`canEditReferralFull`, tied to "Nurse who created it, non-terminal
  status only") — not the Doctor who might urgently need to flag it up,
  and not the Manager routing referrals at the receiving facility.
- Seed data reinforces this is cosmetic even in the generated history:
  `simulateReferralJourney` (`api/script/seed.ts:1013-1018`) computes each
  referral's simulated status-transition timeline from `createdAt` alone;
  `priority` is drawn as a fully independent weighted random value
  afterward (`seed.ts:1113-1118`) with zero correlation to how fast that
  referral's simulated journey actually moved.
- The same "nothing alerts anyone" gap shows up outside referrals too:
  confirmed via scenario testing 2026-08-16 (see
  `docs/scenarios/015-...`) that a facility dropping to zero active
  Managers (its last one disabled, rejected, or — hypothetically —
  departed, see [011](../scenarios/011-staff-departure-caseload-handoff/scenario.md))
  is only discovered *reactively*, the next time an Administrator happens
  to try acting on that facility's staff and either hits the
  `hasActiveManager` fallback check or doesn't
  (`api/src/modules/administrator/service.ts:300-313` and equivalent
  checks in `staffReject`/`staffFlag`). Nothing proactively surfaces
  "Facility X has no active Manager" anywhere — same root cause as the
  rest of this entry, just a different symptom.

Open questions to resolve before picking this up: this is really two
separable items bundled by how they were discovered — (1) should priority
carry actual weight (default sort-by-urgency-then-date, a dashboard
callout, maybe a Doctor-visible re-triage path), and (2) should a
notification system exist at all, independent of priority (it would also
directly help the existing "Referral staleness has no UI signal" and
"accountability" backlog items above). Worth deciding whether either is
worth the build before doing both, since a notification system is a much
larger undertaking than making priority functionally meaningful.

## Appeal reviewers can't see the original rejection/flag/suspension reason

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/010-...`). Not a defect — a usability gap. (A real defect
found in the same investigation, BUG-009 — a second appeal filed before
the first is decided becomes permanently undecidable — is tracked
separately in `docs/bugs.md`.)

The real-world story: a Manager or Administrator opens the `/appeals`
queue to decide whether to reinstate someone, but the only context they
get is the appellant's own appeal reason — not *why* the account or
facility was rejected/flagged/suspended in the first place. Confirmed:
neither the `/appeals` table row nor the `AppealDetailsDialog`
(`web/src/routes/_authenticated/appeals/index.tsx`) surfaces the original
punitive action's own `reason` — that's a separate, earlier timeline row
the reviewer would have to go find in the audit log themselves, on a
different page, to get the full picture before deciding.

Open questions to resolve before picking this up: should the appeal
detail view just join in and display the most recent punitive-action
reason for the same entity (the same row `AppealManager.resolveAuthority`,
`api/src/management/appeal.ts:279-306`, already looks up to determine who
may decide) — this looks like a small, low-risk addition since the lookup
already exists for a different purpose on the same code path.

## No duplicate-patient detection, same-facility or cross-facility

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/013-...`). Not a defect — nothing in the codebase ever
attempted patient identity matching, so there's no existing behavior this
contradicts; it's a gap in what the system covers, not a broken feature.

The real-world story: a Nurse registers a "new" patient who, in reality,
already has a record — either at their own facility (they didn't think to
search first, or searched a nickname/maiden name/typo and came up empty)
or at a different facility entirely (the person was previously treated
elsewhere). Either way, the same real person now has two disconnected
patient IDs, each independently accruing its own referrals and timeline,
with nothing to ever reconcile them.

- **`patientCreate` performs zero duplicate lookup before inserting.**
  `api/src/modules/patients/service.ts:145-167` unconditionally generates
  a new UUID and inserts — no query by name, DOB, or phone against
  existing rows, at the creating Nurse's own facility or anywhere else.
- **No unique constraint exists at the schema level either.** The
  `patients` table (`api/src/drizzle/schema/patient.ts:17-47`) has only
  a primary key on `id` plus plain (non-unique) indexes on
  `creator_id`, `facility_id`, and `(last_name, first_name)` — present
  for query performance, not identity integrity. Repo-wide, the only
  `.unique()` columns anywhere are `specialty.name`, `user.email`, and
  `session.token` — none on `patients`.
- **There's no stable identifier to key a match on even if a dedup check
  were added.** The full identifying field set is `first_name`,
  `last_name`, `date_of_birth`, plus optional `gender`/`phone`/`address`
  (`shared/src/schema/patient.ts:24-29`) — no government/national ID, no
  medical record number, no email. Any real dedup logic could only work
  off free-text name/DOB/phone, all unnormalized beyond collapsing empty
  strings to `null`.
- **Cross-facility matching is structurally impossible today, not just
  unbuilt.** Patient visibility is scoped to the caller's own facility or
  an active non-terminal referral connecting the two facilities
  (`canAccessPatientRecord`, `api/src/modules/patients/service.ts:116-134`
  — see also [012](../scenarios/012-redirect-chain-visibility/scenario.md)).
  A Nurse at Facility B has no way to see, search, or match against a
  patient already registered at Facility A unless a referral has already
  linked the two facilities for that specific person — which can't have
  happened yet, since the whole scenario is that B doesn't know A's
  record exists.
- **No merge or link tooling exists for Administrators or Managers.**
  Neither `api/src/modules/administrator/service.ts` nor
  `api/src/modules/manager/service.ts` (nor the management helpers they
  call) has any concept of merging or linking two patient records after
  the fact.

Open questions to resolve before picking this up: is same-facility
duplicate *detection* (a non-blocking "did you mean this existing
patient?" prompt on create, keyed off name+DOB) enough on its own, or
does the cross-facility case also need solving — and if so, would that
require introducing a stable external identifier (a government/national
ID field) that doesn't exist on the schema today? Is an Administrator- or
Manager-facing merge tool worth building for when a duplicate is found
after the fact, given each side may already have its own independent
referral/timeline history that would need reconciling, not just deleting?

## No concurrency control on any status-transition write — systemic race condition

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/014-...`). Not a narrow, patchable defect — a systemic
architectural gap spanning every status-changing write in the codebase,
which is why it's tracked here rather than as a single `docs/bugs.md`
entry with a small suggested fix.

The real-world story: two people act on the same record at nearly the
same moment, each believing they're the one handling it — two Doctors
both tap "Claim" on the same unassigned referral, or two Managers both
decide the same pending appeal or staff application within moments of
each other. Whoever's request lands last should either be told the case
is already taken, or the system should otherwise stay consistent — not
silently let both "succeed."

Confirmed as a real, exploitable race, not just theoretically racy:

- **Every status-transition write in the codebase follows the same
  shape: fetch the record, check its current value in application code,
  then write unconditionally by primary key.** Grepping every `.update(`
  call site across `api/src/modules/*` and `api/src/management/*` (17
  call sites) found `where: { id: <primary key> }` in all 17, with zero
  exceptions — none conditions the `WHERE` on the current value of the
  column being changed (e.g. `doctor: { isNull: true }`,
  `status: currentStatus`). The generic `updateRecords()`/`buildWhere()`
  helpers (`api/src/core/helpers.ts:233+,975-1016`) do support arbitrary
  non-PK `WHERE` conditions including `isNull`/`isNotNull` — the
  capability exists, it's just never invoked with anything but the PK.
  No table has a version/optimistic-lock column, and no code path uses
  `SELECT ... FOR UPDATE`.
- **Referral self-assign** (`referralAssign`,
  `api/src/modules/referrals/service.ts:390-448`): reads
  `existing.doctor`/`existing.status` outside any lock, checks
  `if (existing.doctor)` in app code, then writes
  `{ doctor: request.user!.id, ... }` with `where: { id }` only. Two
  Doctors claiming the same unassigned referral within the same read
  window both pass the null check and both write — final `doctor` value
  is whichever transaction commits last (pure last-write-wins, unrelated
  to who actually clicked first), and **both** transactions insert their
  own `DOCTOR_ASSIGNED` timeline row, so the audit trail shows two
  assignments with no clear marker of which one is "current." The
  displaced Doctor gets no error and no signal they were silently
  overwritten.
- **Appeal decisions** (`AppealManager.decide`,
  `api/src/management/appeal.ts:164-215`, called from
  `decideAppealAsManager` and `appealDecide`): `isOpen()`
  (`api/src/management/appeal.ts:120-136`) and the decision write are two
  separate, unguarded round trips. Two Managers (or a Manager and an
  Administrator) deciding the same appeal within that window both pass
  `isOpen()` and both write. If they disagree (one approves, one denies —
  the realistic "reviewers disagree" case), the entity's final `status`
  is whichever write commits last, while the `timeline` table
  permanently records **both** an `APPEAL_APPROVED` and an
  `APPEAL_DENIED` row for the same appeal, with nothing in the data model
  to say which one is authoritative.
- **Staff approve/reject** (`ModerationManager.applyUserStatusChange`,
  `api/src/management/moderation.ts:63-96`, called from
  `staffApprove`/`staffReject` in both `manager/service.ts` and
  `administrator/service.ts`): identical shape — re-reads status, then
  writes `where: { id: options.userId }` only. `staffApprove`/
  `staffReject` don't even run in a transaction, so there isn't a lock
  narrowing the window at all. Same outcome as appeals: last-write-wins
  on `users.status`, with contradictory `APPROVED`/`REJECTED` timeline
  rows both permanently attached to the same user.
- **Nothing catches any of this after the fact** — no unique constraint,
  no version column, no row lock, no idempotency check inside the
  transaction that performs the write. The status-guard checks that do
  exist are real and correctly written, but they run strictly *before*
  the write in a separate round trip, so they only work when the two
  requests are far enough apart in time — they provide zero protection
  for genuinely concurrent (sub-millisecond-apart) requests, which is
  exactly the case that matters here.

Open questions to resolve before picking this up: is the fix a targeted
conditional `WHERE` clause on the handful of highest-value paths
(referral self-assign, appeal decide, staff approve/reject) — e.g.
`WHERE id = ? AND doctor IS NULL` — or does the pattern warrant a
generic optimistic-concurrency primitive (a version column, or a helper
that wraps update-with-current-value-guard) applied consistently across
`api/src/core/`? Should a losing concurrent write surface a real 409
("this was just claimed/decided by someone else") instead of silently
succeeding, so the displaced user gets a signal rather than a
misleading-looking success? Given this spans referrals, appeals, and
user status changes alike, is this worth fixing as one cross-cutting
pass rather than three separate patches?

## Specialty lifecycle has two small latent gaps: an orphan-link crash trap and case-insensitive duplicate names

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/016-...`). Not a live defect today — both gaps require a
condition the live app currently prevents from ever occurring — but both
are real inconsistencies worth closing before anything changes that
protection.

The real-world story: an Administrator manages the specialty reference
list (Cardiology, Pediatrics, etc.) that facilities, doctors, and
referrals all tag themselves with. The delete/rename lifecycle around
that shared list needs to stay internally consistent even under edge
cases nobody's hit yet.

- **An orphaned `specialty_id` would crash the API with a 500, not
  degrade gracefully.** There is no live way to delete a specialty that's
  still referenced — deletion isn't even exposed as a route
  (`api/src/modules/specialties/route.ts:24-30`, with an explicit comment
  that a hard delete "would orphan existing facility/user links"), and
  the DB foreign keys on `facility_specialties`/`user_specialties`/
  `referral_specialties` are all `ON DELETE NO ACTION` (confirmed in
  `api/src/drizzle/migrations/0000_easy_joseph.sql:157,170,172`), so
  MySQL itself would reject a delete attempt with a friendly 409 even if
  a route existed. But a dead, unreferenced `core.specialty.delete`
  method still exists (`api/src/core/specialty.ts:187-191`, generated
  boilerplate, never called) with no reference check of its own — and
  the join-resolution helper (`buildRelations`,
  `api/src/core/helpers.ts:521-741`) explicitly handles "no matching
  related row" by setting the relation to `null` (line 710). The Zod
  response schemas for all three link types
  (`shared/src/schema/specialty.ts:69-74,97-102,125-130`) declare
  `specialty` as non-nullable, so if a specialty row were ever removed
  out from under a live link — direct DB cleanup, a future migration, a
  bug in some as-yet-unwritten admin tool — the very next fetch of that
  referral/facility/user's specialty list would fail Zod response
  validation and surface as a generic, unhandled 500 ("An internal
  server error occurred") rather than the friendly 409 the rest of the
  app consistently produces for reference-integrity violations
  (`api/src/middleware/error.ts:60-80`). One half of the code (the join
  helper) anticipates a missing row; the other half (the response
  contract) forbids it ever happening.
- **Duplicate specialty names aren't caught case-insensitively.**
  `specialtyCreate`/`specialtyUpdate`
  (`api/src/modules/specialties/service.ts:92-106,133-145`) check for an
  existing name via an exact-match `where: { name: ... }` lookup — "
  Cardiology" and "cardiology" are different strings to that check, so
  both could be created as separate rows. The `name` field is only
  `.trim()`-ed (`shared/src/schema/field.ts:45`), never case-normalized.
  Whether MySQL's own `UNIQUE(name)` constraint
  (`api/src/drizzle/migrations/0000_easy_joseph.sql:134`) would also let
  both through depends on the deployed column collation, which is never
  explicitly set anywhere in this codebase — so this gap may or may not
  already be silently papered over by whatever the environment's default
  collation happens to be, which isn't something to rely on.

Separately confirmed working well in the same investigation and not
tracked here: specialty rename propagates correctly everywhere it's
referenced (every consumer resolves the current name live via
`specialty_id`, nothing denormalizes/copies a name anywhere), and the
create/rename duplicate-name check does correctly block exact-match
duplicates.

Open questions to resolve before picking this up: is the orphan-crash
trap worth hardening now (e.g. making the link schemas tolerate a null
specialty and surface a placeholder, the same non-enumerating-friendly
pattern used elsewhere) even though nothing live can trigger it today, or
is "the route doesn't exist and the FK blocks it" sufficient protection
to leave as-is? Should specialty name uniqueness be case/whitespace
normalized at creation (e.g. a case-insensitive check, or lowercasing a
comparison column) rather than relying on exact string match plus
whatever the DB collation happens to be?

## Dashboard/report numbers can silently go stale after a mutation, and aren't simply additive across facilities

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/018-...`). Root-caused from code, not live-reproduced in
a browser this pass (unlike most entries here) — the underlying facts
(which query keys get invalidated, what the global cache config is) are
unambiguous from a direct code read, but the day-to-day "did the number
on screen actually go stale" experience is worth confirming live before
treating this as fully closed out.

The real-world story: a Manager or Doctor makes a decision (staffing,
triage) based on the dashboard's numbers, right after taking an action
that should have changed them.

- **No mutation invalidates the dashboard/report query keys.** Referral
  accept/complete/redirect/status-change mutations
  (`web/src/routes/_authenticated/referrals/$referralId.tsx:429-454`)
  only invalidate `QUERY_KEYS.REFERRALS` and related keys — a repo-wide
  grep for `invalidateQueries` alongside `QUERY_KEYS.DASHBOARD_*`/
  `QUERY_KEYS.REPORTS_*` found no hits anywhere. Combined with the global
  TanStack Query `staleTime: 1000 * 60 * 5` (5 minutes, no per-query
  override — `web/src/integrations/query-provider.tsx:4-11`), a Manager
  or Doctor who mutates a referral and then navigates back to the
  dashboard within that window can see pre-mutation counts with no
  visible signal they're stale. The backend itself is always live (every
  number is a fresh `COUNT(*)`/`GROUP BY` at request time, no
  materialized view or cache found anywhere in `api/src`) — this is a
  frontend cache-invalidation gap specifically, not a backend one.
- **A cross-facility referral is legitimately counted in more than one
  Manager's dashboard, and the numbers aren't simply additive.** A
  Manager's `total_referrals` counts anything where their facility is
  either the origin or destination — correct and intentional for what
  that Manager needs to see — but it means the same referral is counted
  once on the origin facility's Manager dashboard and once on the
  destination facility's, while the Administrator's system-wide total
  counts it exactly once. `sum(all Managers' totals) > adminSummary's
  total` whenever any referral has crossed facilities, which could read
  as "the numbers don't add up" to someone comparing them side by side,
  even though each individual number is correct for what it's scoped to
  show.
- **A date-range report reflects each referral's status right now, not
  its status as of that date range.** `from`/`to` filters apply to
  `created_at` only (`api/src/modules/dashboard/service.ts:34-44`,
  `api/src/modules/reports/service.ts:44-54`), never to a transition
  timestamp — so running the same "referrals created last week" report
  today versus tomorrow shows different `by_status` numbers for the
  identical set of referrals as they keep progressing. This is
  consistent, correct "live current-state" behavior, not a bug, but it's
  a real trap for anyone treating a past date-range report as a frozen
  historical snapshot.

Open questions to resolve before picking this up: should dashboard/report
query keys be added to the existing mutation-invalidation calls (the
straightforward fix for the staleness gap), or should dashboard data get
its own shorter `staleTime`/polling interval independent of mutation
invalidation? Is there any value in a per-status-history-aware report
mode (using `timeline` rather than current status) for the date-range
case, or is documenting the "live current state" behavior clearly enough
in the UI sufficient?

## No per-account brute-force protection on sign-in, and cookie security flags depend on `NODE_ENV` being set correctly

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/019-...`). Not a narrow, patchable defect — an absence of
a control that would need to be designed and added, not a fix to
something already half-built.

The real-world story: someone tries to guess a specific person's
password — a disgruntled ex-colleague who knows their username, or an
automated credential-stuffing attempt using a leaked password list
against this app's user base. What actually stops them from trying
indefinitely?

- **The only sign-in throttling is a global, IP-keyed rate limit shared
  across every route in the app.** `@fastify/rate-limit` is registered
  with `global: true` and no `keyGenerator` override
  (`api/src/middleware/index.ts:45-51`), so it falls back to the
  library's default key (`req.ip`) — max 5 requests per 60 seconds,
  *total, of any kind*, per source IP. It has no email/account dimension
  at all: trying 5 different email addresses from one IP consumes the
  identical budget as trying the same email 5 times. better-auth's own
  `rateLimit` config (`api/src/lib/auth.ts:153-157`) mirrors the same
  max/window with no per-route override either, so it's a redundant
  second copy of the same IP-only limit, not a stronger backstop.
- **There is no per-account lockout, failure counter, or CAPTCHA
  anywhere.** `signIn` (`api/src/modules/authentication/service.ts:128-170`)
  calls `auth.api.signInEmail` statelessly on every attempt — no code
  path counts consecutive failures for a given email, escalates a
  temporary lock, or reacts to a failure pattern in any way. Neither
  `UserModel` nor `AccountModel`
  (`api/src/drizzle/schema/user.ts:16-60`,
  `api/src/drizzle/schema/account.ts:6-28`) has a failed-attempt counter
  or a `locked_until`-style column. The `logins` table records every
  attempt against a known email (success/failure, IP, user-agent) but
  nothing ever reads it back to affect a future sign-in decision — it's
  a pure audit record, Administrator-only to view, not a live control.
- **Net effect: a distributed attacker faces no effective limit against
  one targeted account.** Since the rate limit is purely per-IP, spreading
  guesses across enough source IPs (a botnet, rotating proxies) bypasses
  it entirely — each IP gets its own fresh budget. Even a single static
  IP staying under the limit can make roughly 7,000+ attempts/day
  indefinitely with zero escalation. The only friction is Argon2id's
  inherent per-guess cost, which slows but doesn't stop this.
- **Separately, cookie security flags are conditional on `NODE_ENV`, with
  no enforced default.** Both the Fastify cookie plugin config and
  better-auth's own cookie config
  (`api/src/middleware/index.ts:55-63`, `api/src/lib/auth.ts:159-170`)
  set `secure`/`sameSite: "strict"` only when `NODE_ENV === "production"`
  — `httpOnly` is unconditionally on, which is good, but `secure` and
  strict `sameSite` silently downgrade to `false`/`"lax"` in any
  environment where `NODE_ENV` isn't exactly `"production"`.
  `env.NODE_ENV` (`api/src/lib/env.ts:11`) is validated as one of
  `development`/`production`/`test` with no default and nothing that
  cross-checks it against the actual deployment context — a
  misconfigured internet-reachable staging/prod environment left on
  `development` would silently lose both protections with no warning
  anywhere.
- **`CORS_ORIGIN` has the same shape of gap, found 2026-08-16.** It's a
  `.env`-driven, comma-separated origin list
  (`api/src/lib/env.ts:14-22`) validated only as a bare `z.string()` —
  no URL-format check, no guard against a stray `"*"` or an
  unintentionally broad value. It's registered with `@fastify/cors`
  alongside `credentials: true`
  (`api/src/middleware/index.ts:36-42`) and also feeds better-auth's
  `trustedOrigins` (`api/src/lib/auth.ts:27`) — so a misconfigured value
  here would extend trust to CSRF-sensitive auth endpoints too, on top
  of general API access. Same root shape as the `NODE_ENV` finding
  above: the code has no guardrail against a deployer mistake, it just
  trusts the environment to be configured correctly.

Open questions to resolve before picking this up: is per-account lockout
worth the UX tradeoff (a legitimate user's own mistyped-password attempts
could lock them out, compounding the existing "no self-service recovery"
gap above), or is a smarter rate-limit key (IP *and* email combined, so
one dimension alone can't be exhausted for free) enough? Should the
`logins` table actually be read back to detect a failure-burst pattern
and take some action (temporary lock, alert), given the data is already
being collected? Is a deploy-time check worth adding to fail loudly if
`NODE_ENV` isn't `production` in whatever the real production environment
turns out to be, rather than relying on operators setting it correctly
by convention?

## Specialty assignment/unassignment is completely untracked in the audit trail

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/020-...`), while checking whether the audit-trail gap
behind BUG-008 (a referral reassignment silently skipping its timeline
write) showed up elsewhere. This one is structural rather than
conditional — a real defect (BUG-011, Administrator-created accounts
leaving no audit trail) was found in the same pass and is tracked
separately in `docs/bugs.md`; this entry is the broader, no-mechanism-
exists-yet gap.

The real-world story: an Administrator changes which specialties a
facility offers, which specialty a Doctor is credentialed in, or which
specialty a referral is tagged as needing — later, reconstructing "when
did this facility start/stop offering Cardiology, and who changed it"
has nothing to look at.

- **Six handlers across three modules never write a `timeline` row**:
  `facilitySpecialtyAssign`/`Unassign`
  (`api/src/modules/facilities/service.ts:353-425,427-464`),
  `userSpecialtyAssign`/`Unassign`
  (`api/src/modules/users/service.ts:276-350,352-401`), and
  `referralSpecialtyAssign`/`Unassign`
  (`api/src/modules/referrals/service.ts:673-763` and the neighboring
  unassign handler). Each goes straight from validation to
  `core.specialty.linkCreate`/`linkDelete` and replies — no audit write
  anywhere.
- **There's no `TIMELINE_ACTION` value these handlers could even use if
  someone wired one in.** The enum (`shared/src/constant.ts:351-368`)
  only has `STATUS_CHANGE`, `DOCTOR_ASSIGNED`, `REDIRECTED`, transfer/
  approval/flag/appeal actions — nothing specialty-related. This is
  unlike BUG-008 or BUG-011, where the mechanism already exists and a
  specific call path just doesn't use it; here the mechanism itself was
  never built for this entity relationship.
- Confirmed everything else audit-adjacent checked in the same pass
  *does* work correctly and consistently: patient flag/unflag, all four
  facility moderation actions (approve/reject/flag/suspend), and all
  four transfer-decision paths (both sides, both outcomes) each
  unconditionally write a correctly-populated timeline row with no
  gaps found.

Open questions to resolve before picking this up: does this need a full
`previous`/`next` shape (which specialty id was added/removed) or would
a simpler `notes`-only record ("Cardiology added by Frank Manager") be
enough given specialty links aren't a single-value status field the way
everything else in `timeline` is? Is this worth its own new
`TIMELINE_TYPE`/`TIMELINE_ACTION` pair, or should it piggyback on the
existing `FACILITY`/`USER`/`REFERRAL` timeline types with a new action
value each? Given specialty changes are relatively infrequent
compared to referral/appeal activity, is this low-value enough to stay
parked indefinitely, or does it matter more than its frequency suggests
because of what it'd be needed for (a compliance audit asking "was this
facility credentialed for Cardiology on the date this referral was
made")?

## The strict CSP only covers the API origin, not the web frontend where it would actually matter, and free-text fields have no length/content limits

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/021-...`). Not a live defect — every free-text field
checked renders as plain, auto-escaped JSX text today, so there's no
active stored-XSS vector. This is a defense-in-depth gap: the backstop
that should catch a *future* mistake (a new markdown renderer, a
component that slips in `dangerouslySetInnerHTML`, a field that stops
being escaped) isn't actually positioned where it would help.

The real-world story: a Nurse at one facility writes a referral reason or
status note that a Doctor or Manager at a completely different facility
will later read. These free-text fields cross a real trust boundary
between organizations that don't otherwise share staff or systems — the
system's only real protection against one of them planting something
malicious in a field the other will render is currently "the frontend
happens to escape everything correctly," with no second layer behind it.

- **Confirmed clean today**: every free-text field checked
  (`visit_reason`, `referral_reason`, status/redirect `notes`,
  moderation/appeal `reason`, patient `address`) renders via plain JSX
  text interpolation everywhere it's displayed — referral detail,
  patient medical history, appeals, transfers, the audit page. The only
  `dangerouslySetInnerHTML` in the entire frontend
  (`web/src/routes/__root.tsx:36`) is a hardcoded, developer-authored
  theme-init script, not user data. No markdown/HTML-rendering library
  touches user content anywhere. SQL injection surface is also clean —
  every free-text search/filter path (`buildWhere`'s `contains` operator,
  `api/src/core/helpers.ts:321-328`) goes through Drizzle's parameterized
  `sql` template, never raw string concatenation.
- **The strict CSP (`scriptSrc: ["'self'"]`, no `unsafe-inline`) is
  registered only on the API service**
  (`api/src/middleware/index.ts:24-34`), a separate origin/process from
  the web frontend that actually serves and executes the React app's
  HTML/JS (API defaults to port 8080, web to port 3000, split
  deliberately via `CORS_ORIGIN` — `api/src/lib/env.ts:8-16`). A
  repo-wide search found no CSP registration, meta tag, or equivalent
  anywhere under `web/`, and no reverse-proxy/edge config in this repo
  that might apply one in front of both services. So if a future change
  ever did introduce a real XSS vector on the web frontend, there is
  currently no CSP backstop positioned where it would actually block it
  — the one that exists protects API JSON responses, which isn't the
  execution context that matters for this threat.
- **Free-text fields have no server-side length cap or content
  restriction.** The base `stringSchema`
  (`shared/src/schema/field.ts:45`) only trims whitespace; none of
  `visit_reason`, `referral_reason`, status/redirect `notes`,
  moderation/appeal `reason`, or patient `address` impose a max length
  or strip markup (contrast with `nameSchema`, which does apply both a
  length cap and a character whitelist for user names specifically). Not
  exploitable today given the rendering is clean, but it means nothing
  stops an arbitrarily large payload from being stored, and removes one
  layer of defense-in-depth if the rendering guarantee is ever
  accidentally broken later.

Open questions to resolve before picking this up: should the web
frontend get its own CSP (a `meta http-equiv` tag, or a header if/when
it's served behind something that can set one), matching or exceeding
the API's, so the actual execution context is covered? Is there a
deployment-layer reverse proxy planned that would apply a shared CSP in
front of both services, making a web-specific one redundant — worth
confirming before doing both? Would adding reasonable max lengths to the
free-text fields above be worth doing purely as defense-in-depth, even
though nothing exploits their current unboundedness today?

## No bulk actions anywhere, and pagination `limit` has no upper cap

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/022-...`). Two distinct findings from the same
"what happens at volume/scale" investigation, bundled together since
both stem from the app being built strictly around one-record-at-a-time
operations.

The real-world story: a facility onboards ten new hires in one week and
a Manager now has ten pending applications to work through; a Doctor
comes back from a weekend to twenty unassigned referrals. Handling each
one individually is fine at low volume and becomes real, tedious friction
at the volumes this app is explicitly meant to help track.

- **Every moderation, referral, appeal, and transfer action is strictly
  single-item, both in the API and the UI.** Staff approve/reject/flag/
  disable (`api/src/modules/manager/route.ts:61-107`,
  `api/src/modules/administrator/route.ts:120-166`), referral self-assign
  and redirect (`api/src/modules/referrals/route.ts:147-189`), and every
  appeal/transfer decision route all take a single record id in `params`
  — no array, no batch endpoint, anywhere. The frontend mirrors this
  exactly: the staff list, referrals list, appeals queue, and transfers
  queue (`web/src/routes/_authenticated/{users,referrals,appeals,transfers}/index.tsx`)
  all render per-row action menus with no checkbox column, no
  "select all," and no bulk-action affordance of any kind. A referral
  self-assign isn't even available from the referrals list itself — a
  Doctor has to open each unassigned referral's own detail page one at a
  time.
- **List `limit` has no server-side ceiling anywhere.**
  `paginationSortAndSearchQuerySchema`'s `page`/`limit` fields
  (`shared/src/schema/global.ts:22-29`) are plain strings with no
  `.max()` or numeric bound; every list handler converts the raw value
  with a bare `Number(...)` and passes it straight into `manyRecords`
  (`api/src/core/helpers.ts:769-784`), which applies it directly as the
  SQL `LIMIT` with no cap at any layer. `?limit=100000` (or larger) is
  accepted everywhere. Separately, the appeals, transfers, and audit-list
  routes (`api/src/modules/manager/route.ts:149-237` and the
  `administrator/route.ts` equivalents) don't attach a `querystring`
  schema at all — unlike every other list endpoint (patients, referrals,
  users, specialties, facilities) — so `page`/`limit` on those three
  aren't validated or coerced by Fastify before use at all. The three
  per-entity history endpoints (`REFERRAL_HISTORY`/`USER_HISTORY`/
  `FACILITY_HISTORY`) have the identical gap, found 2026-08-16 — none of
  their routes (`api/src/modules/referrals/route.ts:194-209`,
  `users/route.ts:76-93`, `facilities/route.ts:75-92`) attach a
  `querystring` schema either, so `?limit=999999` on any entity's
  history returns its entire timeline in one response, same as the
  appeals/transfers/audit case above. This is a legitimate "let me see
  everything" escape hatch for a power user today,
  but unmitigated it's also a resource-exhaustion vector with no guard
  anywhere.

Open questions to resolve before picking this up: which bulk actions
would actually save the most real friction — staff approval (likely
highest-value, since a hiring wave produces a genuine backlog) versus
referral self-assign/redirect versus appeal/transfer decisions — worth
prioritizing rather than building all four at once? Should a
`.max()` be added directly to the shared pagination schema (fixing every
endpoint that already uses it in one place) and the three missing
`querystring` schemas be added to appeals/transfers/audit to close the
validation gap, as a cheap, low-risk first step independent of the bulk-
actions question?

## No patient data retention, archival, or deletion-request handling of any kind

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/023-...`). Not a defect — a genuinely unconsidered gap.
A related, narrower defect found in the same investigation, BUG-012 —
editing a patient's demographic fields leaves no audit trail — is
tracked separately in `docs/bugs.md`.

The real-world story: a patient (or their legal representative) asks a
facility to remove their data, or a facility simply wants to purge a
record created by mistake — the wrong person entirely, not a duplicate
of an existing patient (that's [013](../scenarios/013-duplicate-patient-records/scenario.md)'s
story), just bad data that shouldn't exist. Separately: once a patient's
care is fully wrapped up and every referral involving them has reached a
terminal status, does their record just sit forever in every facility
that ever touched it?

- **No archive, discharge, close, or deactivate concept exists for a
  patient record at any layer.** Unlike User/Facility/Referral, which
  all have real status enums, the `patients` table
  (`api/src/drizzle/schema/patient.ts:17-47`) has no status column of any
  kind — only an advisory `flagged` boolean derived from `timeline` that
  the schema's own doc comment says "never gates any read/write
  elsewhere" (`shared/src/schema/patient.ts:56-60`). `docs/database.md`
  previously implied Patient followed the same "status-lifecycle-only"
  pattern as the other three entities — corrected in place during this
  investigation, since Patient is actually a strictly weaker case (no
  status enum at all, not just "no delete route").
- **A patient record remains in its owning facility's list permanently,
  with no time- or activity-based filter.** `patients()`'s list query
  (`api/src/modules/patients/service.ts:190-219`) has no "active" or
  status-derived filter of any kind — only facility, date-created range,
  name/phone search, gender, and DOB range. Once every referral for a
  patient reaches a terminal status, a *non-owning* facility's live
  access correctly lapses (per `canAccessPatientRecord`'s
  non-terminal-referral check), but the **owning** facility keeps
  unconditional, permanent visibility regardless of how long ago the
  patient was last actually seen.
- **No erasure/GDPR/retention/export/anonymization concept exists
  anywhere** — a repo-wide search across `api/src`, `web/src`, and every
  `docs/*.md` file for GDPR, erasure, "right to be forgotten," retention
  (as a privacy concept), purge, anonymize, or data export returned zero
  hits, not even as an aspirational backlog note. The system's only
  stance on deletion is the opposite of what this scenario needs: hard
  delete was deliberately removed for Patients specifically
  (`docs/roles-permissions.md:715-717`, "referrals reference
  `patient_id`, so a hard delete risks orphaning referral history"), with
  no compensating design for how a legitimate erasure request or a
  wrong-record purge would actually be handled instead.
- A dead, unused `Patient.delete()` method still exists
  (`api/src/core/patient.ts:200-204`, generated boilerplate, never
  called) — same pattern as the dead `core.specialty.delete` documented
  in the specialty-lifecycle entry above. Even if wired up, the FK on
  `referrals.patient_id` is `ON DELETE NO ACTION`, so it would fail for
  any patient with referral history, same protective shape as
  specialties.
- Separately confirmed working correctly in the same pass: a Nurse *can*
  correct a single patient's own wrong data (e.g. a mistyped date of
  birth) via a normal `PATCH` — that part isn't blocked. It just leaves
  no audit trail of the correction (BUG-012).

Open questions to resolve before picking this up: is a genuine
"erasure/anonymize" flow needed (scrub identifying fields but keep the
referral/timeline shell intact for downstream integrity, rather than a
real delete), or is a soft "archived" status — hiding a patient from
default list views without touching referral history — enough for the
"purge a mistaken record" half of this story? Does the business actually
face a real-world regulatory retention/erasure obligation that makes
this more urgent than its current total absence suggests, or is this
genuinely out of scope for what this system is meant to handle?

## No email verification at signup — an account activates on an unverified email address

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/025-...`). Structurally the same shape as the earlier
"no self-service password reset" finding — a better-auth capability that
exists but was never wired up.

The real-world story: someone signs up claiming an email address they
don't actually control — a typo of their own address, someone else's
address entirely, or a made-up one — and a Manager/Administrator later
approves the account based on the name/role/facility they see, having no
way to know the email was never confirmed.

- **Email verification isn't enabled or configured at all.**
  `api/src/lib/auth.ts:41-48`'s `emailAndPassword` block has no
  `requireEmailVerification` flag and no `emailVerification` config
  block — better-auth's default with this block absent is
  verification-not-required. There is no `sendVerificationEmail`
  callback anywhere in the codebase (same absence pattern already
  confirmed for `sendResetPassword` in [password
  recovery](../scenarios/017-password-recovery/scenario.md)).
- **The `verification` table is unused scaffolding, exactly as
  documented.** It's wired into the Drizzle adapter
  (`api/src/lib/auth.ts:30-39,141-151`) with an explicit comment
  confirming this: "Adopted as-is per build-spec.md section 2.1, even
  though nothing currently issues verification tokens." `user.fields.
  emailVerified` (`auth.ts:59`) maps to a real column that simply never
  gets set to `true` by anything.
- **Signup takes the email at face value, and approval never
  cross-checks it.** `signUp`
  (`api/src/modules/authentication/service.ts:63-119`) passes
  `request.body.email` straight into `auth.api.signUpEmail` with no
  confirmation step. `managerApprove`/`staffApprove`
  (`api/src/modules/administrator/service.ts:65-127,275-329`) only check
  status/role/facility conflicts before activating the account — neither
  reads nor validates the email's authenticity in any way. The approving
  human is vetting the human-readable claim (name, role, facility), not
  whether the email is real or belongs to the person signing up.
- **Net effect**: once approved, a fully active account exists tied to
  an email address nobody has confirmed the account holder can actually
  receive mail at — relevant to anything email-driven added later
  (notifications, the still-missing password-reset flow if it's ever
  built) and to basic identity assurance during the approval step
  itself.

Open questions to resolve before picking this up: should verification
block activation entirely (no approval possible until the email is
confirmed), or just be a non-blocking signal surfaced to the approving
Manager/Administrator ("email not yet verified") the way a lot of the
rest of this app favors non-blocking warnings over hard gates? Does this
depend on the same email-sending infrastructure decision needed for
self-service password reset — worth scoping both together rather than
separately, since they'd likely share a mailer setup?

## A real person can't hold staff accounts at two facilities under one identity

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/026-...`). Not a defect — the data model was simply
never designed with this case in mind; it doesn't appear to have come up
in any prior planning session.

The real-world story: a Doctor consults at two hospitals — two days a
week at one, three at another, a common real-world arrangement in
healthcare. This system has no way to represent that as one identity.

- **`facility_id` is a single, nullable column directly on `user`**
  (`api/src/drizzle/schema/user.ts:44-46`), not a many-to-many
  relationship — there's no join table anywhere in the schema for a user
  belonging to more than one facility.
- **Email uniqueness is enforced on `user`, not on the credential
  table**, and role/facility/status all live on that same single `user`
  row (`user.email` has both a `.unique()` constraint and an explicit
  `uniqueIndex`, `api/src/drizzle/schema/user.ts:22,56`). So the same
  real person practicing at two facilities has no way to do it under one
  email — they'd need two entirely separate email addresses, each
  backing its own account, appearing to the system as two unrelated
  people rather than one person with two affiliations.
- **This isn't a documented scope decision anywhere** — a search across
  `docs/roles-permissions.md` and `docs/backlog.md` found no discussion
  of dual-facility staff at all; `facility_id` is treated everywhere as
  a fixed, singular attribute of a user without ever being called out as
  a deliberate one-facility-only design choice.

Open questions to resolve before picking this up: is this common enough
in the real world this system targets to be worth a genuine
many-to-many staff/facility relationship (bigger change — touches every
place `request.user!.facility_id` is read throughout the codebase), or
is "two separate accounts, two separate email addresses" an acceptable
workaround given how rarely a single person needs simultaneous
affiliations with two *different* organizations (as opposed to just
being reassigned from one to another)?

## Unlimited appeal re-filing after a fair denial, with no signal to the next reviewer

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/026-...`). Distinct from BUG-009 (a second appeal filed
*while the first is still pending* becomes undecidable) — this is about
re-filing *after* a decision was already fairly made, which isn't a
defect in existing logic so much as a case nobody designed a response
for.

The real-world story: someone's appeal is reviewed and denied — a
legitimate, considered decision. Nothing stops them from immediately
filing another appeal for the exact same flag/suspension, and the next
reviewer to see it has no way to know it's a repeat.

- **`APPEAL_DENIED` doesn't change the underlying status, so the
  appealable-status check passes again immediately.**
  `AppealManager.decide` (`api/src/management/appeal.ts:163-221`) skips
  the `user`/`facility` update entirely on a denial (`if (options.approve)`
  is false) — the row stays in whatever status made it appealable in the
  first place. `canFileAppeal`/`canFileFacilityAppeal`
  (`api/src/lib/permission.ts:215-225`) are pure status checks with no
  memory of appeal history, so they evaluate `true` again the instant
  after a denial.
- **The reviewer queue actively hides prior decided appeals rather than
  surfacing them as context.** `AppealManager.list`
  (`api/src/management/appeal.ts:87-116`) filters to only
  not-yet-superseded `APPEAL_SUBMITTED` rows — a re-filed appeal shows up
  as a brand-new, contextless entry, with nothing linking it to the
  denied one before it. `resolveAuthority` only looks at the most recent
  *punitive* action to determine who may decide, never at prior
  `APPEAL_DENIED` rows, so it can't be repurposed to warn a reviewer
  either. The appeals UI
  (`web/src/routes/_authenticated/appeals/index.tsx:107-145`) shows only
  the current appeal's own reason — no denied-count, no "already
  reviewed and denied on [date]" indicator.
- **No cooldown or appeal-specific rate limit exists anywhere** — the
  only rate limiting in the app is the generic, global, IP-keyed HTTP
  layer already documented in
  [019](../scenarios/019-brute-force-protection/scenario.md), which has
  nothing to do with appeal semantics or per-entity history.

Open questions to resolve before picking this up: should a reviewer
simply be shown prior denied-appeal history for the same entity/flag
(a UI/query addition, relatively small), or should repeat filing itself
be gated somehow (a cooldown, a cap, or requiring new information before
a second appeal on the same underlying action is even accepted)? Is
this meaningfully different from a normal appeals process elsewhere
(most systems do allow re-appealing with new information) such that the
real gap is purely "no visibility into prior attempts" rather than
"re-filing itself is a problem"?

## Two minor code-quality gaps in sort-parameter handling (both currently unreachable)

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/028-...`), while checking whether the sort side of list
queries had the same kind of gap as BUG-014 (search wildcard escaping).
It doesn't — sort-field names are properly allowlisted against real
Drizzle columns before ever reaching the query builder, and direction
values are enum-validated at the HTTP schema layer, so there's no
injection or correctness defect here. These two items are minor,
currently-unreachable rough edges worth a note, not bugs.

- **`buildOrder`'s own inline validation doesn't set an HTTP status
  code.** `api/src/core/helpers.ts:389-417` throws a plain `Error` if a
  field name doesn't resolve to a real column — but unlike
  `parseSortList` (`api/src/lib/validator.ts:15-35`), which sets
  `error.statusCode = 400`, this throw has no status code, so it would
  fall through to a bare `500` rather than a clean `400` if ever
  reached. Today it's unreachable in practice: every real call path
  validates the field name through `parseSortList`'s allowlist first, so
  `buildOrder` never actually sees an unvalidated key. It's a
  safety-net-that-depends-on-convention rather than one enforced by the
  function itself.
- **Multi-field sort works; independent per-field sort *direction*
  doesn't, despite code written as if it should.** `parseEnumList`
  (`api/src/lib/validator.ts:4-13`) and the per-field fallback logic in
  `api/src/modules/referrals/service.ts:201-206`
  (`orders[index] || orders[0] || "desc"`) are written to support
  something like `?sort=name,created_at&order=asc,desc` — but the
  route-level `order` field is typed as a scalar enum
  (`shared/src/schema/global.ts:20`), not an array, and no module
  overrides it. So a comma-separated `order` value is rejected by Zod
  validation (`422`) before the handler ever runs, and every field in a
  multi-field sort always ends up sharing one shared direction. Not a
  bug (nothing crashes, nothing behaves incorrectly for the requests
  that *are* accepted) — just dead code relative to what it looks
  designed to do.

Open questions to resolve before picking this up: is per-field sort
direction (`name asc, created_at desc` in one request) actually a real
user need worth widening the `order` schema to an array for, or is
sharing one direction across all sorted fields good enough in practice —
if so, the `parseEnumList`/per-field fallback code in
`referrals/service.ts` could be simplified to match reality instead.
Should `buildOrder`'s inline throw get a `.statusCode = 400` purely as
cheap, low-risk hardening, even though nothing exercises that path
today?

## An entity's history beyond the first page is invisible in the UI, and staff history has no viewer at all

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/029-...`). Not a backend defect — the API genuinely
paginates history correctly (real `LIMIT`/`OFFSET`, not a fetch-all).
The gap is entirely on the frontend: the capability exists and isn't
exposed.

The real-world story: a referral gets redirected several times, or a
long-tenured staff member accumulates years of status-change history —
an Administrator or Manager trying to reconstruct what happened only
ever sees the 10 most recent events, with no way to know there's more,
and for staff specifically, no way to see any history at all.

- **Referral and facility history pages only ever request page 1, with
  no pagination controls.** `referralHistoryRequest`/
  `facilityHistoryRequest`
  (`web/src/api/referrals.ts:56-65`, `web/src/api/facilities.ts:57-`)
  are called with only `{ id }` — no `page`/`limit` — from
  `$referralId.tsx:280-282` and `$facilityId.tsx:252-254`. The results
  render in `TimelineList`
  (`web/src/components/custom/timeline-list.tsx`), a scrollable card
  with no "load more," no page controls, and no total-count indicator —
  unlike every other paginated list in the app, which does use a shared
  `PaginationFooter` component. Anything past the 10 most recent events
  for a given entity is retrievable from the API (`?page=2` works) but
  unreachable through the UI.
- **`USER_HISTORY` has a fully working backend endpoint and zero
  frontend consumer.** `userHistoryRequest`
  (`web/src/api/users.ts:57`) is defined but never called anywhere else
  in `web/src` — the user detail page
  (`web/src/routes/_authenticated/users/$userId.tsx`) has no
  history/timeline section at all. A staff member's status-change
  history (approvals, flags, disables) isn't just paginated to 10 — it
  isn't shown anywhere, which directly compounds the accountability gap
  already tracked in [No way to identify or hold accountable a staff
  member sitting on stale
  referrals](#no-way-to-identify-or-hold-accountable-a-staff-member-sitting-on-stale-referrals).

Open questions to resolve before picking this up: is a simple
`PaginationFooter` addition to `TimelineList` (matching the pattern
already used elsewhere) enough for referrals/facilities, or does history
volume justify a dedicated full-page history view instead of a
sidebar-style scrollable card? Should the user detail page's history
section be built as its own piece of work, or bundled with whatever
picks up the broader staff-accountability backlog item above, since
they're closely related?

## No export, download, print, or CSV capability exists anywhere in the app

**Status:** Open — found via scenario testing 2026-08-16 (see
`docs/scenarios/029-...`). A genuine zero-hit search, broader than the
already-documented "no patient data export" finding — this is systemic
across every entity and screen, not specific to patients.

The real-world story: a Manager needs to hand a compliance reviewer a
copy of the audit log, or bring referral volume numbers to a board
meeting. Today, the only way to get data out of this system is to read
it off the screen — there's no export, download, print, or CSV
capability anywhere, frontend or backend.

- A repo-wide search across `web/src` for export/download/CSV/print UI
  affordances, and across `api/src` for CSV serialization or a
  file-download route, returned nothing — the only matches were
  unrelated (the `export` JS keyword, a component literally named
  `PaginationFooter`, module re-exports).
- The audit log page (`web/src/routes/_authenticated/audit/index.tsx`),
  the dashboard, and the reports endpoint
  (`api/src/modules/reports/service.ts`, `web/src/api/reports.ts`) all
  return/render JSON-backed on-screen views only — no "Export CSV,"
  "Download," or "Print" action exists on any of them.
- No `window.print`, `Blob`/`createObjectURL`/download-link pattern
  exists anywhere in `web/src`.

Open questions to resolve before picking this up: is CSV export of list
data (referrals, audit log, users) enough, or does a real compliance
workflow need something closer to a formatted PDF/print view? Is this
worth building generically (one reusable export mechanism across every
list endpoint) given how many different lists exist, or should it start
narrowly with just the audit log, which is the most obviously
compliance-motivated use case?

## Runbook doc + updated README

**Status:** Parked 2026-08-17. User wants (1) a new doc explaining how to
run this project (setup, envs, docker, dev commands) and (2) an updated
`README.md` describing the project itself — problem domain and the stack
being used. Not started yet; user explicitly said to park it while they
switch focus to pointing the database at AWS.
