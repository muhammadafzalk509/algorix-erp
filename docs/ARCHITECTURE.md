# ALGORIX — Target Architecture & Module Design

> **Implementation status (built):** All 7 rollout steps are implemented and
> verified — (1) RBAC capabilities + QA/HR roles, (2) audit trail, (3) password
> policy + Settings (dark mode, avatar), (4) Payroll, (5) Attendance, (6) QA
> workflow + role broadcasts, (7) file-pipeline mimetypes + scan hook, Gantt
> colour standard, and the extended project report. Migrations are applied and
> the app runs. The sections below remain as the design reference.

This document maps the requested spec onto the **existing** ALGORIX codebase
(NestJS + Prisma + PostgreSQL backend, Next.js 14 frontend). Every item is tagged:

- ✅ **EXISTS** — already implemented, no work or minor work.
- 🔧 **EXTEND** — partially there; needs additions.
- 🆕 **NEW** — must be built.

> Reality check: ~70% of this spec is already in the repo. The genuinely new
> work is **QA + HR roles, Payroll, Attendance, Audit trail, Profile picture,
> Dark mode, and stricter password-policy enforcement.** The rest is extension.

---

## 0. Current state snapshot

**Backend modules** (`backend/src/`): `auth`, `users`, `clients`, `projects`,
`tasks`, `task-logs`, `comments`, `documents`, `notifications` (+ Socket.IO
gateway), `leads`, `leaves`, `invoices`, `tickets`, `gantt`, `analytics`,
`mail`, `storage` (Cloudflare R2), `prisma`, `common`.

**RBAC today** — a single **linear tier** enum:

| Tier | Role | Data visibility |
|---|---|---|
| TIER_0 | CEO | read-all |
| TIER_1 | CTO | full + approves devs |
| TIER_2 | VP Engineering | org-wide |
| TIER_3 | Head of Developer | org-wide (no team model yet) |
| TIER_4 | Head of Documentation | org-wide |
| TIER_5 | Developer | own data only |

Enforced by `@Tiers(...)` decorator + `TierGuard` (`src/auth/guards/tier.guard.ts`),
data scoping by `seesAllData()` (`src/common/tier.util.ts`). JWT carries `{ sub, email, tier }`.

---

## 1. 🔧 Auth & Security

| Spec | Status | Notes |
|---|---|---|
| bcrypt hashing, no plaintext | ✅ | `bcrypt.hash(pw, 10)` everywhere; `passwordHash` only |
| Forgot-password OTP via email | ✅ | `forgotPassword`→`verifyOtp`→`resetPassword` in `auth.service.ts`; OTP via `MailService` |
| New + confirm password screen | ✅ | `app/(auth)/reset-password/page.tsx` |
| Password policy (8+, upper, lower, number) | 🔧 | **Not enforced.** Only `@MinLength(8)` exists |
| Google sign-in | ✅ | `POST /api/auth/google` (login-only) |

**Password policy (the one real gap).** Add a reusable validator and apply it to
`ResetPasswordDto`, `ChangePasswordDto`, and any admin user-create DTO:

```ts
// common/validators/strong-password.ts
export const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
// class-validator: @Matches(STRONG_PASSWORD, { message: '8+ chars, upper, lower, number' })
```

Mirror the rule in the frontend forms for instant feedback (do **not** rely on
client validation for security — keep the server `@Matches`).

> Production note: OTP is an **in-memory Map** today (`otpStore`). For multi-instance
> deploys move it to a DB table or Redis (documented as a TODO in the service).

---

## 2. 🔧 Role System (RBAC) — the key architectural decision

The spec adds **QA** and **HR / Payroll Officer**. These are *lateral* functional
roles — they don't slot cleanly into the current *linear* `TIER_0..TIER_5`
hierarchy (e.g. HR needs Payroll but not engineering data; QA needs task
validation but isn't "above" a developer).

**Recommended model: keep tiers for the data-visibility hierarchy, add a
capability layer for functional access.** Minimal disruption, fully extensible.

### Schema changes

```prisma
enum PermissionTier {
  TIER_0  // CEO
  TIER_1  // CTO
  TIER_2  // VP Engineering
  TIER_3  // Head of Development
  TIER_4  // QA            (NEW — repurpose/extend; see note)
  TIER_5  // Developer
  TIER_6  // HR / Payroll Officer (NEW)
}

enum Capability {
  PAYROLL_VIEW
  PAYROLL_EDIT
  PAYROLL_AUDIT      // CTO/CEO read-only audit
  QA_VALIDATE        // move task IN_PROGRESS->REVIEW/DONE, file bugs
  ATTENDANCE_MANAGE  // CTO manual override
  NOTIFY_GLOBAL      // CEO global broadcast
  USER_MANAGE
  // ...extend as needed
}

model Role {
  id             Int            @id @default(autoincrement())
  name           String         @unique
  permissionTier PermissionTier
  capabilities   Capability[]   // NEW — Postgres native enum array
  description    String?
  users          User[]
  createdAt      DateTime       @default(now())
}
```

> "Head of Documentation" (TIER_4) is not in the new spec. Options: keep it and
> add QA/HR as TIER_6/TIER_7, **or** repurpose TIER_4 → QA. Decide before
> migrating; the table above assumes QA takes a tier slot and HR is appended.
> **This is a decision to confirm before writing the migration.**

### Enforcement

- **Hierarchy / data scope** — unchanged `@Tiers(...)` + `TierGuard` + `seesAllData()`.
- **Capabilities** — new `@RequireCapability(Capability.PAYROLL_EDIT)` decorator +
  `CapabilityGuard` that reads `user.role.capabilities`. JWT payload gains
  `caps: Capability[]` so the guard needs no DB hit (refreshed on token refresh).

```ts
// auth: signTokens payload -> { sub, email, tier, caps }
// common/guards/capability.guard.ts mirrors TierGuard but checks caps[]
```

- **CEO-sensitive overrides** — a dedicated `@CeoOnly()` guard (tier === TIER_0).
  No capability can grant it; enforced at the route level.

### Seed updates (`prisma/seed.ts`)
Add QA and HR roles with their capability sets; CEO gets `NOTIFY_GLOBAL`,
CTO gets `PAYROLL_AUDIT` + `ATTENDANCE_MANAGE`, HR gets `PAYROLL_VIEW|EDIT`,
QA gets `QA_VALIDATE`.

---

## 3. 🔧 Notification System

| Piece | Status |
|---|---|
| `Notification` model, REST + unread count | ✅ `notifications.service.ts` |
| Real-time push via Socket.IO | ✅ `notifications.gateway.ts` |
| Bell icon + dropdown (title, time, read/unread) | ✅ `app/(dashboard)/notifications` + layout bell |
| **Sender role on each message** | 🔧 add `senderId`/`senderRole` |
| **Role-scoped broadcast** (CEO→all, CTO→tech, VP→team) | 🆕 broadcast endpoint |

### Schema extension
```prisma
model Notification {
  // ...existing fields
  senderId   Int?
  sender     User?   @relation("NotificationSender", fields: [senderId], references: [id])
  category   String? // SYSTEM | TECHNICAL | PROJECT | DEV_INSTRUCTION | GLOBAL
}
```

### Broadcast design
`POST /api/notifications/broadcast { audience, title, message, category }`
- `audience` resolves to a set of recipient userIds by tier:
  - CEO (`NOTIFY_GLOBAL`) → all users
  - CTO → TIER_1..TIER_5 (technical/system)
  - VP → project/team members
  - Head Dev → developers + QA
- Fan-out: create one `Notification` row per recipient, then emit
  `gateway.pushToUser(userId, payload)` for each (the gateway already maps
  userId→socket). Guarded by tier/capability.

---

## 4. 🔧 Settings Module

| Spec | Status |
|---|---|
| Change password (with policy) | ✅ endpoint; 🔧 add policy validator (§1) |
| Dark / light mode toggle | 🆕 frontend-only: `next-themes` + Tailwind `darkMode: 'class'`, persisted to localStorage; optional `user.theme` column to sync across devices |
| Profile picture upload (images only) | 🆕 reuse the file pipeline (§6) with image-only mimetype filter; add `User.avatarUrl String?` |

`PATCH /api/users/me/avatar` (multipart) → R2 upload → save `avatarUrl`.
`PATCH /api/users/me` for profile fields + theme.

---

## 5. 🆕 Payroll Module (CTO + HR access)

New module `src/payroll/`. Capability-gated: `PAYROLL_VIEW`/`PAYROLL_EDIT` (HR),
`PAYROLL_AUDIT` (CTO/CEO read-only).

### Schema
```prisma
model SalaryRecord {            // current compensation per employee
  id          Int      @id @default(autoincrement())
  userId      Int      @unique
  user        User     @relation(fields: [userId], references: [id])
  baseSalary  Decimal
  currency    String   @default("USD")
  effectiveAt DateTime @default(now())
  updatedBy   Int
  updatedAt   DateTime @updatedAt
}

model PayrollEntry {            // one pay run line per employee
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  periodStart DateTime
  periodEnd   DateTime
  baseSalary  Decimal
  bonus       Decimal  @default(0)
  deductions  Decimal  @default(0)
  overtime    Decimal  @default(0)
  netPay      Decimal  // computed = base + bonus + overtime - deductions
  note        String?
  createdBy   Int
  createdAt   DateTime @default(now())
}

model SalaryChangeLog {         // audit of comp changes (CTO audit view)
  id        Int      @id @default(autoincrement())
  userId    Int
  field     String   // baseSalary | bonus | ...
  oldValue  String
  newValue  String
  changedBy Int
  createdAt DateTime @default(now())
}
```

### Endpoints
| Method | Path | Capability |
|---|---|---|
| GET | `/api/payroll/salaries` | PAYROLL_VIEW |
| PUT | `/api/payroll/salaries/:userId` | PAYROLL_EDIT (writes `SalaryChangeLog`) |
| GET | `/api/payroll/entries?userId=&from=&to=` | PAYROLL_VIEW |
| POST | `/api/payroll/entries` | PAYROLL_EDIT |
| GET | `/api/payroll/:userId/history` | PAYROLL_VIEW |
| GET | `/api/payroll/:userId/report.pdf` | PAYROLL_VIEW (reuse PDFKit from invoices) |
| GET | `/api/payroll/export?format=csv\|xlsx` | PAYROLL_VIEW |
| GET | `/api/payroll/audit` | PAYROLL_AUDIT (CTO/CEO) |

`netPay` computed server-side on create; export reuses the same PDFKit setup
already used by the invoices module, plus a CSV/XLSX writer.

---

## 6. 🔧 File Management Pipeline (Development module)

Already solid (`documents.service.ts` + `storage/r2.service.ts`): server-side
mimetype + size validation, R2 upload, **versioning by filename**, rollback,
linked to project/task. Visibility via tier nav.

**Gaps vs spec:**
- Allowed types: add **CSV, XLS, DOC** (currently PDF, DOCX, XLSX, PNG, JPG, ZIP).
- "Linked to version" → already versioned; expose version in UI.
- "Virus-checked (conceptually)" → add a pluggable `ScanService` hook
  (no-op in dev; ClamAV/VirusTotal in prod) called before persisting.

```ts
const ALLOWED = {
  'application/pdf':'pdf','application/zip':'zip','application/x-zip-compressed':'zip',
  'text/csv':'csv','application/vnd.ms-excel':'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx',
  'application/msword':'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
  'image/png':'png','image/jpeg':'jpg',
};
```

**Pipeline:** `Multer (memory) → mimetype allowlist → size cap → ScanService.scan()
→ version resolve → R2.upload(key) → Document row → audit log`.
Visible to CEO/CTO/VP via existing tier-filtered listing.

---

## 7. 🔧 Task Management

Mostly exists (`tasks` module; `Task` has title, description, priority, status,
dueDate=deadline, assignedTo). Spec status names differ — map them:

| Spec | Existing enum |
|---|---|
| Pending | `TODO` |
| In Progress | `IN_PROGRESS` |
| Under Review | `REVIEW` |
| (Testing) | `TESTING` |
| Completed | `DONE` |

**Changes:** allow VP/CTO to assign to Head Dev / Developer / **QA** (tier+capability
check on assignment); QA transitions task `IN_PROGRESS → REVIEW/DONE` gated by
`QA_VALIDATE`; add bug-report linkage (reuse `SupportTicket` or a `Bug` linked to task).

---

## 8. 🆕 Attendance System

New module `src/attendance/`. Rule: a session counts once the user stays logged
in ≥ 20 minutes; CTO can override manually.

### Schema
```prisma
enum AttendanceStatus { PRESENT ABSENT MANUAL }

model AttendanceSession {        // heartbeat-driven session tracking
  id         Int      @id @default(autoincrement())
  userId     Int
  user       User     @relation(fields: [userId], references: [id])
  loginAt    DateTime @default(now())
  lastSeenAt DateTime @default(now())
  durationMin Int     @default(0)
  date       DateTime              // date-only (for daily rollup)
  status     AttendanceStatus @default(ABSENT)
  markedBy   Int?                  // set when CTO overrides
  @@index([userId, date])
}
```

### Logic
- On login → create `AttendanceSession`.
- Frontend sends a heartbeat `POST /api/attendance/ping` every ~2–5 min; server
  updates `lastSeenAt` and recomputes `durationMin`. Once `durationMin >= 20`
  → `status = PRESENT`. (Implementation: heartbeat is the robust path; a pure
  server timer can't see a closed tab.)
- `PATCH /api/attendance/:id/override` (capability `ATTENDANCE_MANAGE`, CTO) →
  set `status = MANUAL`, record `markedBy`, write audit log.

### Reports
`GET /api/attendance/report?scope=daily|weekly|monthly&from=&to=` →
aggregate per user; export PDF (PDFKit) / Excel, same as payroll.

---

## 9. 🔧 Project Management & Gantt

| Piece | Status |
|---|---|
| `GanttItem` model (name, start, end, progress, color, order) | ✅ |
| Gantt CRUD + progress + report endpoints | ✅ `src/gantt` |
| Frontend Gantt page | ✅ `app/(dashboard)/gantt` |
| Color-coded status (green/yellow/red/blue) | 🔧 standardize the palette |
| Project report (completion %, dev perf, QA summary, deviations, milestones) | 🔧 extend `analytics` |

**Gantt approach:** data already lives in `GanttItem` (per-project bars with
`progress` 0–100 and `color`). Standardize status→color in one place:

```
COMPLETED → green   IN_PROGRESS → yellow   DELAYED → red   PLANNED → blue
```
Render with a lightweight client lib (e.g. `frappe-gantt` or a custom SVG/Canvas
timeline) reading `/api/gantt/:projectId`. "Delayed" = `endDate < now && progress < 100`.

**Project report** extends the `analytics` module: task completion ratio
(DONE / total), developer performance (from `TaskLog.hoursSpent` + closed tasks),
QA feedback summary (bugs/validations), timeline deviation (planned vs actual
end), milestone tracking (`Milestone.completion`).

---

## 10. 🆕 Audit Trail (cross-cutting)

Spec: "All actions must be logged." Add a global, append-only audit log.

```prisma
model AuditLog {
  id         Int      @id @default(autoincrement())
  userId     Int?
  action     String   // e.g. "payroll.update", "task.assign", "attendance.override"
  entity     String   // "PayrollEntry" | "Task" | ...
  entityId   String?
  metadata   Json?    // before/after diff, request summary
  ip         String?
  createdAt  DateTime @default(now())
  @@index([entity, entityId])
  @@index([userId])
}
```

**Implementation:** a NestJS **interceptor** (`AuditInterceptor`) on mutating
routes (POST/PUT/PATCH/DELETE) that writes an `AuditLog` row after success.
Sensitive modules (payroll, attendance override, role changes) also write
explicit domain logs (`SalaryChangeLog`). Read access: CEO/CTO only.

---

## 11. Frontend module structure (Next.js App Router)

Existing route groups: `(auth)`, `(dashboard)`, `(client-portal)`. Add:

```
app/(dashboard)/
  payroll/        page.tsx        # HR + CTO; tables, history, export    🆕
  attendance/     page.tsx        # self view + CTO override + reports    🆕
  qa/             page.tsx        # QA queue: tasks under review + bugs    🆕
  audit/          page.tsx        # CEO/CTO audit log viewer               🆕
  settings/       page.tsx        # + dark mode toggle, avatar upload      🔧
components/
  ThemeToggle.tsx                 # next-themes                            🆕
  AvatarUpload.tsx                                                          🆕
  GanttChart.tsx                  # standardized colors                    🔧
lib/
  permissions.ts                  # add QA/HR tiers + capability helpers   🔧
```

Nav gating stays in `lib/permissions.ts` (`NAV[].tiers`); add capability-aware
entries (e.g. Payroll visible to HR tier + anyone with `PAYROLL_VIEW`).

---

## 12. Backend module additions (summary)

```
src/
  payroll/      payroll.module.ts  .service.ts  .controller.ts  dto/   🆕
  attendance/   attendance.module.ts .service.ts .controller.ts dto/   🆕
  audit/        audit.module.ts  audit.interceptor.ts  audit.service.ts 🆕
  common/
    guards/     capability.guard.ts  ceo-only.guard.ts                  🆕
    decorators/ require-capability.decorator.ts                         🆕
    validators/ strong-password.ts                                      🆕
  documents/    + ScanService hook, expanded mimetypes                  🔧
  notifications/ + broadcast + sender fields                            🔧
```

---

## 13. Suggested rollout order

1. **Schema + RBAC core** — add `Capability`, role capabilities, new roles,
   `CapabilityGuard`, JWT `caps`. Migration + seed. *(unblocks everything)*
2. **Audit trail** — interceptor + `AuditLog` (so new modules log from day one).
3. **Password policy** + Settings (dark mode, avatar) — small, high-value.
4. **Payroll** — schema, endpoints, export, audit view.
5. **Attendance** — sessions, heartbeat, reports.
6. **QA workflow + notifications broadcast** — task validation, role messaging.
7. **File pipeline + Gantt polish** — mimetypes, scan hook, color standardization,
   extended project report.

Each step is an independent migration + module; the app keeps running between steps.

---

## Open decisions (confirm before migrating)

1. **Tier layout for QA / HR** — give them new tier slots (TIER_6/TIER_7) or
   repurpose TIER_4 (Head of Documentation)? Affects the enum migration.
2. **Attendance heartbeat interval** + whether a closed tab should end a session
   immediately or after a grace period.
3. **Payroll currency** — single currency or per-employee (schema supports per-employee).
4. **OTP store** — keep in-memory (dev) or move to Redis/DB now (prod-readiness).
