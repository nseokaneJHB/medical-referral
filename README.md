# Referral Tracking System

A healthcare patient-referral tracking system: nurses create referrals for
patients, doctors action them, facility managers and administrators oversee
approvals, transfers, and appeals across facilities.

## Problem

Referring a patient between healthcare facilities (e.g. a clinic to a
specialist hospital) is typically tracked informally — phone calls, paper
forms, spreadsheets. That makes it hard to see a referral's current status,
who's responsible for the next step, or how long a patient has been waiting,
and leaves no audit trail for compliance or accountability.

## Solution

A role-based web app that gives every referral a single source of truth:

- **Patients & referrals** — nurses register patients and create referrals
  (origin/destination facility, reason, priority); doctors accept, progress,
  or reject them; every status change is recorded on a timeline.
- **Facilities & specialties** — the destination side of a referral, with
  their own specialties and managers.
- **Transfers & appeals** — cross-facility transfer requests requiring
  origin/destination approval, and an appeal path for rejected actions.
- **Roles & permissions** — `NURSE`, `DOCTOR`, `MANAGER`, `ADMINISTRATOR`,
  each scoped to a permissions file governing what they can see/do; admins
  approve/reject/flag/disable staff, managers, and facilities.
- **Audit trail** — login history and action history are logged for
  compliance review.
- **Dashboards & reports** — role-specific summaries (nurse/doctor/manager)
  and reporting views.

## Tech stack

| Layer         | Choice                                          |
| ------------- | ------------------------------------------------ |
| API           | Fastify + TypeScript                             |
| ORM / DB      | Drizzle ORM + MySQL 8.4                           |
| Auth          | Better Auth (cookie sessions, email/password)     |
| Password hash | Argon2id (`@node-rs/argon2`, via `api/src/lib/password.ts`) |
| Validation    | Zod, shared between API and frontend via `/shared` |
| Frontend      | Vite + React 19 + TypeScript                      |
| Data fetching | TanStack Query                                    |
| Routing       | TanStack Router (role-guarded routes)             |
| Forms         | react-hook-form + zodResolver                     |
| UI            | Tailwind CSS + shadcn/ui + Radix                  |
| Monorepo      | pnpm workspaces + Turborepo                       |

Repo layout:

```
/api      → Fastify server (src/modules/* per domain, src/core, src/drizzle)
/web      → React frontend (TanStack Router, routes under src/routes)
/shared   → Zod schemas + inferred types + constants, imported by both
/docs     → design docs, scenario test suite, backlog
```

## Prerequisites

- Node.js (see `.nvmrc`)
- pnpm 11.5.0 (managed via Corepack)
- Docker + Docker Compose

## How to run

The project runs via Docker Compose (MySQL + API + Web, each with hot
reload). All commands below are `pnpm` scripts in the repo root
`package.json`.

1. Install workspace dependencies:

   ```bash
   pnpm install
   ```

2. Environment files already exist under `env/development/` (`.env.api`,
   `.env.database`, `.env.web`) and are loaded automatically by
   `compose.yml` for `ENV=development` (the default). A `staging/` set is
   also present for the AWS RDS environment.

3. Bring up the full stack:

   ```bash
   pnpm infra:up
   ```

   Or bring up services individually: `pnpm db:up`, `pnpm api:up`,
   `pnpm web:up`.

4. Run database migrations and seed data:

   ```bash
   pnpm db:generate     # generate Drizzle migrations from schema
   pnpm db:migrate      # apply migrations
   pnpm db:seed         # faker-generated seed data
   pnpm db:bootstrap-admin   # create the first administrator account
   ```

5. Open the app:

   - Web: http://localhost:3000
   - API: http://localhost:8080

   Seed logins follow `{role}@gmail.com` / `Password@123` (e.g.
   `nurse@gmail.com`, `doctor@gmail.com`, `manager@gmail.com`,
   `administrator@gmail.com`).

### Useful scripts

| Command             | Purpose                                       |
| -------------------- | ---------------------------------------------- |
| `pnpm dev`            | Run API + web locally without Docker (Turborepo) |
| `pnpm lint` / `pnpm typecheck` | Lint / typecheck all workspaces      |
| `pnpm db:reset`       | Drop, regenerate, and re-migrate the schema     |
| `pnpm db:purge`       | Wipe data + delete generated migrations         |
| `pnpm api:logs` / `pnpm web:logs` / `pnpm db:logs` | Tail service logs |
| `pnpm infra:down`     | Stop all services                               |
| `pnpm infra:reset`    | Full clean rebuild of everything                |

Since this project is pre-release, migrations are collapsed rather than
accumulated — `db:reset`/`db:purge` regenerate a single fresh migration from
the current schema instead of layering new ones.

## Docs

- `docs/database.md` — schema reference
- `docs/roles-permissions.md` — permissions model per role
- `docs/scenarios/` — manual regression test scenarios
- `docs/backlog.md` — parked ideas / future work
- `docs/bugs.md` — currently tracked bugs
