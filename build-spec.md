# Healthcare Referral System — Build Spec

Reference doc for API (Fastify) + Frontend (React). Covers DB schema, shared Zod
contracts, and the phased route list matching the recommended build order.
Auth is provided by **Better Auth** (username/password only, cookie sessions).
Chatbot and AWS infra are out of scope — owned by teammate.

---

## 1. Tech Stack

| Layer         | Choice                                              |
| ------------- | --------------------------------------------------- |
| API           | Fastify + TypeScript                                |
| ORM           | Drizzle                                             |
| DB            | MySQL (AWS RDS, provisioned by teammate)            |
| Auth          | Better Auth (cookie sessions, email/password)       |
| Validation    | Zod (shared between API and frontend via `/shared`) |
| Frontend      | Vite + React + TypeScript                           |
| Data fetching | TanStack Query                                      |
| UI            | Tailwind + shadcn/ui                                |
| Routing       | TanStack Router + role-guarded routes               |

Repo layout:

```
/api      → Fastify server
/web      → React frontend
/shared   → Zod schemas + inferred types, imported by both
```

---

## 2. Database Schema

Column/table names follow a "one word unless it has to be more than one"
convention — the exception is FK columns (`created_by`, `patient_id`,
`user_id`, ...), which keep their referential names for clarity, and
inherently compound domain concepts (`first_name`, `date_of_birth`, ...).
Every table uses a UUID `id` primary key (matching Better Auth's own
`user`/`session`/`account`/`verification` tables) rather than
table-prefixed auto-increment ids.

### 2.1 Better Auth tables (adopted as-is, default adapter)

Better Auth manages these automatically via its Drizzle adapter. Listed here
for reference — you don't hand-write these tables, you configure Better Auth
to generate them (with `role`/`status` added as custom fields on `user`).

```
user
  id                 varchar PK (uuid)
  name               varchar
  email              varchar (unique)
  verified           boolean        -- was emailVerified
  role               varchar        -- custom field: ADMINISTRATOR | DOCTOR | NURSE
  status             varchar        -- custom field: ACTIVE | DISABLED
  created            datetime
  updated            datetime

session
  id                 varchar PK (uuid)
  user_id            varchar FK -> user.id
  expires            datetime
  token              varchar
  ip                 varchar
  agent              varchar        -- was userAgent

account
  id                 varchar PK (uuid)
  user_id            varchar FK -> user.id
  account_id         varchar
  provider           varchar     -- "credential" for username/password
  password           varchar     -- hashed

verification
  id                 varchar PK (uuid)
  identifier         varchar
  value              varchar
  expires            datetime
```

### 2.2 Domain tables (you own these)

```sql
-- patients
CREATE TABLE patients (
  id               VARCHAR(36) PRIMARY KEY,
  first_name       VARCHAR(100) NOT NULL,
  last_name        VARCHAR(100) NOT NULL,
  date_of_birth    DATE NOT NULL,
  gender           VARCHAR(20),
  phone            VARCHAR(20),   -- was contact_number
  address          TEXT,
  history          TEXT,          -- was medical_history
  created_by       VARCHAR(36) NOT NULL,   -- FK -> user.id
  created           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- referrals
CREATE TABLE referrals (
  id                 VARCHAR(36) PRIMARY KEY,
  patient_id         VARCHAR(36) NOT NULL,   -- FK -> patients.id
  origin             VARCHAR(255) NOT NULL,  -- was referring_facility
  destination        VARCHAR(255) NOT NULL,  -- was receiving_facility
  reason             TEXT NOT NULL,          -- was referral_reason
  priority           ENUM('low','medium','high','urgent') DEFAULT 'medium',
  status             ENUM(
                        'pending','accepted','in_progress',
                        'on_hold','completed','rejected','canceled'
                      ) DEFAULT 'pending',
  created_by         VARCHAR(36) NOT NULL,   -- FK -> user.id (Nurse)
  doctor             VARCHAR(36),            -- FK -> user.id (Doctor), was assigned_doctor
  created            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- timeline (was referral_status_history)
CREATE TABLE timeline (
  id           VARCHAR(36) PRIMARY KEY,
  referral_id  VARCHAR(36) NOT NULL,  -- FK -> referrals.id
  previous     VARCHAR(50),           -- was old_status
  next         VARCHAR(50) NOT NULL,  -- was new_status
  changed_by   VARCHAR(36) NOT NULL,  -- FK -> user.id
  notes        TEXT,
  changed      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- logins (was login_audit)
CREATE TABLE logins (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,  -- FK -> user.id
  login         DATETIME,              -- was login_time
  logout        DATETIME,              -- was logout_time
  ip            VARCHAR(100),          -- was ip_address
  device        TEXT,                  -- was device_info
  status        ENUM('success','failed','locked_out') NOT NULL  -- was login_status
);
```

`chatbot_conversations` intentionally omitted — teammate's scope. Your API
should expose a thin passthrough or stub endpoint only if/when they hand you
a contract.

### 2.3 Referral status transitions (enforce server-side)

```
pending      → accepted | rejected | canceled | on_hold
accepted     → in_progress | on_hold | rejected
in_progress  → completed | on_hold
on_hold      → pending | accepted | in_progress | canceled
completed    → (terminal)
rejected     → (terminal)
canceled     → (terminal)
```

Any `PATCH /referrals/:id/status` call must validate the requested transition
against this table before writing, and must always insert a row into
`timeline`. Additionally, `PATCH /referrals/:id/status` restricts which
_target_ statuses each role may set (layered on top of the table above):
Nurses to `canceled`/`on_hold`/`pending`, Doctors to
`accepted`/`rejected`/`in_progress`/`completed`/`on_hold`, Admins
unrestricted.

---

## 3. Shared Zod Schemas (`/shared/schemas.ts`)

```typescript
import { z } from "zod";

// ---- Enums ----
export const RoleEnum = z.enum(["Administrator", "Doctor", "Nurse"]);

export const ReferralStatusEnum = z.enum([
	"pending",
	"accepted",
	"in_progress",
	"on_hold",
	"completed",
	"rejected",
	"canceled",
]);

export const PriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const LoginStatusEnum = z.enum(["success", "failed", "locked_out"]);

// ---- Status transition map (import into API for validation) ----
export const STATUS_TRANSITIONS: Record<
	z.infer<typeof ReferralStatusEnum>,
	z.infer<typeof ReferralStatusEnum>[]
> = {
	pending: ["accepted", "rejected", "canceled", "on_hold"],
	accepted: ["in_progress", "on_hold", "rejected"],
	in_progress: ["completed", "on_hold"],
	on_hold: ["pending", "accepted", "in_progress", "canceled"],
	completed: [],
	rejected: [],
	canceled: [],
};

// ---- Patients ----
export const CreatePatientSchema = z.object({
	first_name: z.string().min(1).max(100),
	last_name: z.string().min(1).max(100),
	date_of_birth: z.string().date(), // ISO date string
	gender: z.string().max(20).optional(),
	phone: z.string().max(20).optional(), // was contact_number
	address: z.string().optional(),
	history: z.string().optional(), // was medical_history
});

export const UpdatePatientSchema = CreatePatientSchema.partial();

// ---- Referrals ----
export const CreateReferralSchema = z.object({
	patient_id: z.string().uuid(),
	origin: z.string().min(1).max(255), // was referring_facility
	destination: z.string().min(1).max(255), // was receiving_facility
	reason: z.string().min(1), // was referral_reason
	priority: PriorityEnum.default("medium"),
	doctor: z.string().uuid().optional(), // was assigned_doctor
});

export const UpdateReferralSchema = CreateReferralSchema.partial();

export const UpdateReferralStatusSchema = z.object({
	next: ReferralStatusEnum, // was new_status
	notes: z.string().optional(),
});

// ---- Auth (Better Auth handles the actual endpoints; this is for the
//      role field you add on top of its sign-up call) ----
export const SignUpSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	password: z.string().min(8),
	role: RoleEnum,
});
```

---

## 4. API Routes — Phased Build Order

### Phase 1 — Schema + migrations

No routes. Get Drizzle migrations for domain tables running against MySQL,
and confirm Better Auth's generated tables migrate cleanly alongside them.

### Phase 2 — Auth only

| Method | Route                | Notes                                         |
| ------ | -------------------- | --------------------------------------------- |
| POST   | `/api/auth/sign-up`  | Better Auth route, extended with `role` field |
| POST   | `/api/auth/sign-in`  | Better Auth route                             |
| POST   | `/api/auth/sign-out` | Better Auth route                             |
| GET    | `/api/auth/session`  | Returns current session + role                |

Build blank per-role landing pages on the frontend here. Nothing else.

### Phase 3 — Patients + Referrals CRUD (build against Nurse permissions first)

| Method | Route                | Role(s)                                    |
| ------ | -------------------- | ------------------------------------------ |
| POST   | `/api/patients`      | Nurse, Admin                               |
| GET    | `/api/patients`      | Nurse, Doctor, Admin                       |
| GET    | `/api/patients/:id`  | Nurse, Doctor, Admin                       |
| PATCH  | `/api/patients/:id`  | Nurse, Doctor (clinical notes only), Admin |
| DELETE | `/api/patients/:id`  | Admin only                                 |
| POST   | `/api/referrals`     | Nurse                                      |
| GET    | `/api/referrals`     | All (filtered by role — see below)         |
| GET    | `/api/referrals/:id` | All                                        |
| PATCH  | `/api/referrals/:id` | Nurse (own), Admin                         |
| DELETE | `/api/referrals/:id` | Admin only                                 |

Role-based filtering on `GET /api/referrals`:

- Admin → all referrals
- Doctor → `doctor = current user` (was `assigned_doctor`)
- Nurse → `created_by = current user`

### Phase 4 — Status transitions

| Method | Route                        | Role(s)                                    |
| ------ | ---------------------------- | ------------------------------------------ |
| PATCH  | `/api/referrals/:id/status`  | Nurse (limited transitions), Doctor, Admin |
| GET    | `/api/referrals/:id/history` | All (own referrals) or Admin (all)         |

Validate against `STATUS_TRANSITIONS` before writing; always insert into
`referral_status_history`.

### Phase 5 — Doctor dashboard support

| Method | Route                                                                            | Role(s)                     |
| ------ | -------------------------------------------------------------------------------- | --------------------------- |
| GET    | `/api/referrals?status=pending` (auto-scoped to the caller's assigned referrals) | Doctor                      |
| GET    | `/api/dashboard/doctor/summary`                                                  | Doctor — counts for widgets |

### Phase 6 — Admin dashboard support

| Method | Route                          | Role(s)                                          |
| ------ | ------------------------------ | ------------------------------------------------ |
| GET    | `/api/dashboard/admin/summary` | Admin — total users/patients/referrals by status |
| GET    | `/api/users`                   | Admin                                            |
| PATCH  | `/api/users/:id/disable`       | Admin                                            |

### Phase 7 — Login audit + reports

| Method | Route                    | Role(s)                                                       |
| ------ | ------------------------ | ------------------------------------------------------------- |
| GET    | `/api/audit/logins`      | Admin only                                                    |
| GET    | `/api/reports/referrals` | Admin (full), Doctor (clinical stats), Nurse (referral stats) |

---

## 5. Open items to confirm with teammate

- Chatbot request/response contract (`POST /api/chatbot/message` shape) once
  their side is ready.
- Final confirmation that the 3-role model (Administrator/Doctor/Nurse) is
  locked, since adding a role later touches every `requireRole()` check.

Resolved: `logout` in `logins` (was `login_audit.logout_time`) is written by
the API on explicit sign-out — `POST /api/auth/sign-out` finds the most
recent still-open `logins` row for the current session's user and stamps it,
rather than relying on Better Auth's session lifecycle alone.
