# ALGORIX — Enterprise ERP Architecture

A production-grade, role-based internal management system for engineering departments,
with a strict role hierarchy, centralized control (CTO), and real-time tracking.

This document is the canonical architecture. It is grounded in the code that already
exists in this repo and marks every spec requirement as **✅ implemented**, **🟡 partial**,
or **🔴 to add**.

---

## 0. Spec → Status map

| Requirement | Status | Where |
|---|---|---|
| Next.js (App Router) UI | ✅ | `frontend/app/**` (route groups) |
| REST API | ✅ | NestJS, all routes under `/api/*` |
| Secure JWT auth (access + refresh) | ✅ | `auth/` — 15m access / 7d refresh, rotation |
| Middleware-based RBAC | ✅ | global `JwtAuthGuard` → `TierGuard` → `CapabilityGuard` |
| Modular folder structure | ✅ | one NestJS module per domain |
| Clean UI / business / DB separation | ✅ | `app+components` / `service` / `PrismaService` |
| CTO is single authority for activation | ✅ | `PATCH /api/users/:id/status` is `@Tiers(TIER_1)` only |
| VPE read-only global visibility | 🟡 | VPE (TIER_2) sees all data; write scope is curated per-module |
| Departments logically separated, exec-visible | 🟡 | today via **role hierarchy** + `department` string; a first-class `Department` model is proposed in §3.2 |
| Every action logged (audit trail) | ✅ | global `AuditInterceptor` → `AuditLog` table |
| Scalable for enterprise | ✅ | stateless API + JWT, indexed Postgres, modular monolith (split-ready) |
| Notifications | ✅ | `Notification` model + Socket.IO gateway |
| Tasks (assignee/status/priority/deadline) | ✅ | `Task` model + `tasks/` module |

The one structural gap versus your data model is a **first-class `Department` entity**
(today departments are expressed through the role hierarchy and a `department` string on
`User`). §3.2 gives the exact schema + migration to close it.

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            CLIENT (browser)                            │
│  Next.js 14 App Router · React · Tailwind · Socket.IO client           │
│  Route groups: (auth) · (dashboard) · (client-portal)                  │
│  lib/api.ts  → fetch wrapper (Bearer token + silent refresh)           │
│  lib/auth.tsx → session context   lib/permissions.ts → tier-based nav  │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │ HTTPS  (Authorization: Bearer JWT) │ WebSocket (Socket.IO)
                ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         API LAYER  (NestJS, /api)                      │
│                                                                        │
│   Global pipeline (order matters):                                     │
│   ┌──────────────┐  ┌────────────┐  ┌────────────────┐                 │
│   │ JwtAuthGuard │→ │ TierGuard  │→ │ CapabilityGuard │ → controller    │
│   └──────────────┘  └────────────┘  └────────────────┘                 │
│        auth            vertical RBAC     lateral RBAC                   │
│                                                                        │
│   AuditInterceptor wraps every state-changing request (POST/PUT/...)   │
│                                                                        │
│   Controllers  →  Services (business logic)  →  PrismaService (DB)      │
│   Modules: auth users clients projects tasks task-logs comments        │
│            documents notifications leads leaves invoices tickets       │
│            analytics gantt audit payroll attendance qa engineering     │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ Prisma Client
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│   PostgreSQL 16   ·   Cloudflare R2 (docs)   ·   SMTP (mail)           │
└──────────────────────────────────────────────────────────────────────┘
```

**Layering rules**
- **UI layer** — `frontend/app/**` pages + `frontend/components/**`. No business rules; it calls the API via `lib/api.ts`.
- **Business logic** — NestJS `*.service.ts`. All authorization, validation (DTOs + `class-validator`), and domain rules live here. Controllers are thin.
- **Database layer** — a single `PrismaService` (global). No raw SQL in controllers; services own all queries.

**Why NestJS for the API (not Next.js API routes):** your spec says "REST or GraphQL API"
and "middleware-based RBAC + clean separation." NestJS gives first-class guards/interceptors,
DI, and per-domain modules — which is what makes the enterprise RBAC and audit requirements
clean and testable. The Next.js App Router is used for the **UI** exactly as the spec prefers.

---

## 2. Role hierarchy & RBAC model

Two orthogonal axes:

**A. Vertical — `PermissionTier`** (data-visibility rank, enforced by `TierGuard`):

| Tier | Role(s) | Visibility |
|---|---|---|
| TIER_0 | CEO | read-all (executive) |
| TIER_1 | CTO | full control · **only authority to activate users** |
| TIER_2 | VP Engineering | global visibility (Engineering Hub) |
| TIER_3 | Head of Developer · Tester Head · IoT Head | team/manager |
| TIER_4 | Head of Documentation | docs domain |
| TIER_5 | Developer · Documentation Specialist · IoT Engineer | own data only |
| TIER_6 | QA | quality validation |
| TIER_7 | HR / Payroll Officer | payroll domain |

**B. Lateral — `Capability`** (functional unlocks, enforced by `CapabilityGuard`), e.g.
`USER_MANAGE`, `QA_VALIDATE`, `PAYROLL_VIEW/EDIT/AUDIT`, `ATTENDANCE_MANAGE`,
`NOTIFY_GLOBAL`, `AUDIT_VIEW`. A role's *tier* sets rank; its *capabilities* unlock modules
regardless of tier.

`seesAllData(tier)` = everyone except TIER_5 (developers/specialists are scoped to their own
records); used by services to filter list queries.

---

## 3. Database Schema (Prisma / PostgreSQL)

### 3.1 Current core models (already in `backend/prisma/schema.prisma`)

```prisma
model Role {
  id             Int            @id @default(autoincrement())
  name           String         @unique
  permissionTier PermissionTier
  capabilities   Capability[]
  description    String?
  users          User[]
}

model User {
  id           Int        @id @default(autoincrement())
  firstName    String
  lastName     String
  email        String     @unique          // ← maps to your "username/email"
  passwordHash String                       // bcrypt
  phone        String?
  roleId       Int
  role         Role       @relation(fields: [roleId], references: [id])
  department   String?                      // 🟡 string today; see §3.2
  designation  String?
  status       UserStatus @default(PENDING_APPROVAL)  // pending → active → inactive
  refreshToken String?                       // hashed; powers refresh-token rotation
  createdBy    Int?                          // CTO/admin who created the account
  lastLogin    DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  tasks        Task[]
  // ...notifications, taskLogs, leaveApplications, attendance, etc.
}

model Task {
  id          Int          @id @default(autoincrement())
  projectId   Int
  project     Project      @relation(fields: [projectId], references: [id])
  assignedTo  Int?
  assignee    User?        @relation(fields: [assignedTo], references: [id])
  title       String
  description String?
  priority    TaskPriority @default(MEDIUM)  // LOW | MEDIUM | HIGH | CRITICAL
  status      TaskStatus   @default(TODO)     // TODO|IN_PROGRESS|REVIEW|TESTING|DONE
  dueDate     DateTime?                        // ← "deadline"
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Notification {
  id         Int      @id @default(autoincrement())
  userId     Int                               // recipient
  title      String
  message    String
  isRead     Boolean  @default(false)
  senderId   Int?                              // null = system
  senderRole String?                           // denormalized sender role name
  category   String?                           // SYSTEM|GLOBAL|TECHNICAL|TEAM|DEV_INSTRUCTION
  createdAt  DateTime @default(now())
}

model AuditLog {                                // ← "every action must be logged"
  id         Int      @id @default(autoincrement())
  userId     Int?
  action     String                            // "POST /api/tasks"
  method     String
  path       String
  entity     String?                           // "task", "payroll", ...
  entityId   String?
  statusCode Int?
  metadata   Json?                             // redacted body/params/query
  ip         String?
  createdAt  DateTime @default(now())
  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

(Plus: `Project`, `Milestone`, `GanttItem`, `TaskLog`, `Comment`, `Client`, `Lead`,
`Invoice`, `Document`, `Ticket`, `Leave`, `SalaryRecord`, `PayrollEntry`,
`AttendanceSession`, `Bug`, `SignupRequest`.)

### 3.2 Proposed addition — first-class `Department`

This closes the one gap with your data model. Departments become real entities with a head
and a category, while keeping the existing role hierarchy intact.

```prisma
model Department {
  id        Int      @id @default(autoincrement())
  name      String   @unique                  // "Development", "QA", "Documentation", "IoT"
  category  String?                            // "Engineering" | "Operations" | ...
  headId    Int?     @unique                   // the lead user (Head of X / Tester Head / IoT Head)
  head      User?    @relation("DeptHead", fields: [headId], references: [id])
  members   User[]   @relation("DeptMembers")
  tasks     Task[]
  createdAt DateTime @default(now())
}

// User: replace the `department String?` with a relation
//   departmentId Int?
//   memberOf     Department? @relation("DeptMembers", fields: [departmentId], references: [id])
//   headOf       Department? @relation("DeptHead")
// Task: add
//   departmentId Int?
//   department   Department? @relation(fields: [departmentId], references: [id])
```

Migration path (non-destructive):
1. `npx prisma migrate dev --name add_department` (adds tables/columns, nullable).
2. Backfill: create the 4 departments, set each `headId`, map existing users by their current `department` string / role.
3. Switch the Engineering Hub aggregation (`engineering` module) from role-name grouping to `departmentId` grouping.

> The existing `engineering` module already groups people into Development / QA / Documentation
> / IoT by role; the `Department` model formalizes that grouping and lets tasks carry a
> `departmentId` directly (your `Task.department` field).

---

## 4. Folder Structure

### 4.1 Frontend (Next.js App Router) — `frontend/`

```
app/
  (auth)/                  login, request-signup, forgot/reset password
  (dashboard)/             authenticated app (shared layout + sidebar)
    layout.tsx             session guard + tier-filtered nav
    dashboard/  users/  clients/  projects/  progress/  gantt/
    tasks/  task-logs/  engineering/  analytics/  documents/
    invoices/  payroll/  leaves/  attendance/  tickets/  qa/
    notifications/  settings/  cto/signup-requests/
  (client-portal)/         external client view
  layout.tsx  globals.css
components/                ui.tsx (Button/Card/Table/...), ThemeToggle, ...
lib/
  api.ts                   fetch wrapper, token store, silent refresh
  auth.tsx                 React context: user/session
  permissions.ts           Tier type, NAV[], navForTier(), can()
  useList.ts  utils.ts  password.ts
```

### 4.2 Backend (NestJS) — `backend/`

```
src/
  main.ts                  bootstrap, global prefix, CORS, validation pipe
  app.module.ts            wires all modules + 3 global APP_GUARDs
  prisma/                  PrismaService (@Global)
  auth/                    controllers, service, jwt.strategy, guards/
  common/
    decorators/            @Public  @Tiers  @RequireCapability  @CurrentUser
    tier.util.ts           seesAllData(), isDeveloper()
    validators/
  audit/                   AuditInterceptor + AuditService + controller
  users/ clients/ projects/ tasks/ task-logs/ comments/ documents/
  notifications/ (+ gateway)  leads/ leaves/ invoices/ tickets/ analytics/
  gantt/ payroll/ attendance/ qa/ engineering/
prisma/
  schema.prisma  seed.ts  migrations/
```

Each domain module follows the same shape: `*.module.ts`, `*.controller.ts`,
`*.service.ts`, `dto/*.dto.ts` — UI-agnostic, independently testable, and split-ready into
microservices if scale ever demands it.

---

## 5. API Endpoints (representative, all under `/api`)

| Module | Method & path | Guard |
|---|---|---|
| **Auth** | `POST /auth/login` · `/auth/refresh-token` · `/auth/google` · `/auth/forgot-password` · `/auth/reset-password` | `@Public` |
| | `POST /auth/logout` · `/auth/change-password` | authed |
| | `POST /auth/request-signup` | `@Public` |
| | `GET /auth/signup-requests` · `POST /auth/signup-requests/:id/approve` · `/reject` | `TIER_0,1` |
| **Users** | `GET /users` | `TIER_0,1,2,3` |
| | `GET /users/me` · `POST /users/me/avatar` · `GET /users/:id` · `PUT /users/:id` | authed / self |
| | `POST /users` · `DELETE /users/:id` | `TIER_0,1` |
| | `PATCH /users/:id/status` | **`TIER_1` (CTO only — activation)** |
| **Projects** | `GET /projects` · `GET /projects/:id` · milestones GET | authed |
| | `POST/PUT /projects` · milestones POST/PUT | `TIER_0,1,2` |
| | `DELETE /projects/:id` | `TIER_0,1` |
| **Tasks** | `GET /tasks` · `GET /tasks/:id` · `PATCH /tasks/:id/status` | authed (own/manager) |
| | `POST /tasks` · `PUT /tasks/:id` · `POST /tasks/:id/assign` | `TIER_0,1,2,3` |
| | `DELETE /tasks/:id` | `TIER_0,1,2` |
| | `PATCH /tasks/:id/validate` | `@RequireCapability(QA_VALIDATE)` |
| **Engineering Hub** | `GET /engineering/overview` · `GET /engineering/teams` | `TIER_0,1,2` |
| **Gantt** | `GET /gantt/progress` · `GET /gantt/:projectId` | authed |
| | `GET /gantt/:projectId/report` · `/chart` (PDF) | authed |
| | `POST/PUT/DELETE /gantt/items...` | `TIER_0,1,2` |
| **Notifications** | `GET /notifications` · `POST /mark-read/:id` · `/mark-all-read` | authed |
| | `POST /notifications/broadcast` | `@RequireCapability(NOTIFY_GLOBAL)` |
| **Payroll** | `GET/PUT /payroll/salaries...` · `entries` · `export` | `PAYROLL_VIEW/EDIT` |
| | `GET /payroll/audit` | `@RequireCapability(PAYROLL_AUDIT)` |
| **QA / Bugs** | `POST /bugs` (`QA_VALIDATE`) · `GET /bugs` · `PATCH /bugs/:id/status` | mixed |
| **Audit** | `GET /audit` | `@RequireCapability(AUDIT_VIEW)` |
| **Attendance** | `POST /attendance/ping` · `GET /attendance/me` | authed |
| | `GET /attendance` · `/report` · `POST /override` | manager / `ATTENDANCE_MANAGE` |
| **Also** | clients · leads · invoices · documents · leaves · tickets · analytics | tier/capability-gated |

---

## 6. Role-based middleware logic (real code)

Three global guards run in order on every request (`app.module.ts`):

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },    // 1. authenticate
  { provide: APP_GUARD, useClass: TierGuard },        // 2. vertical RBAC
  { provide: APP_GUARD, useClass: CapabilityGuard },  // 3. lateral RBAC
]
```

**1 — Authenticate (skip `@Public`):**

```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) { super(); }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    return isPublic ? true : super.canActivate(ctx);
  }
}
```

**2 — Vertical RBAC (`@Tiers(...)`):**

```ts
@Injectable()
export class TierGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionTier[]>(
      TIERS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;                 // unrestricted route
    const { user } = ctx.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException('No role on user.');
    if (!required.includes(user.role.permissionTier))
      throw new ForbiddenException('You do not have permission for this action.');
    return true;
  }
}
```

**3 — Lateral RBAC (`@RequireCapability(...)` — must hold ALL listed):**

```ts
const held: Capability[] = user.role.capabilities ?? [];
const missing = required.filter((c) => !held.includes(c));
if (missing.length) throw new ForbiddenException('You do not have permission...');
```

**Declarative usage on routes:**

```ts
@Patch(':id/status')
@Tiers(PermissionTier.TIER_1)                 // CTO only — the activation rule
setStatus(@Param('id', ParseIntPipe) id, @Body() dto) { ... }

@Post('broadcast')
@RequireCapability(Capability.NOTIFY_GLOBAL)  // lateral unlock, any tier that holds it
broadcast(@Body() dto) { ... }
```

Capabilities are read from the **live** role loaded on each request (see §7), so granting or
revoking access takes effect immediately — no re-login required.

---

## 7. Auth + sample code (JWT access + refresh)

**Token issuance** — short-lived access (15m) + long-lived refresh (7d, rotated; the hash is
stored on the user so a stolen refresh token can be revoked):

```ts
private async signTokens(userId: number, email: string, tier: string) {
  const accessToken = await this.jwt.signAsync(
    { sub: userId, email, tier },
    { expiresIn: this.config.get('JWT_EXPIRES_IN') || '15m' });
  const refreshToken = await this.jwt.signAsync(
    { sub: userId, email, tier },
    { secret: REFRESH_SECRET, expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d' });
  return { accessToken, refreshToken };
}
// on login: store bcrypt(refreshToken) on the user, return both tokens
```

**Strategy — loads the live user/role every request and enforces active status:**

```ts
async validate(payload: JwtPayload) {
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id, email, firstName, lastName, status,
              role: { select: { id, name, permissionTier, capabilities } } },
  });
  if (!user) throw new UnauthorizedException('User no longer exists.');
  if (user.status !== 'ACTIVE')
    throw new UnauthorizedException('Account is not active.');   // pending/inactive blocked here
  return user;   // attached to req.user → read by both RBAC guards
}
```

**Client side — Bearer + silent refresh** (`frontend/lib/api.ts`): on a `401`, the wrapper
calls `/auth/refresh-token`, swaps tokens, and retries the original request once; on failure it
clears the session and redirects to login.

**Account lifecycle (the centralized-control rule):**
`request-signup` (public) → `PENDING_APPROVAL` → **CTO** approves (`signup-requests/:id/approve`)
→ `ACTIVE`. Only `@Tiers(TIER_1)` can flip `status` via `PATCH /users/:id/status`. A non-active
user can authenticate a token but is rejected at `validate()`, so deactivation is effectively
instant.

---

## 8. UI Dashboard Structure

- **Shell** — `(dashboard)/layout.tsx`: redirects unauthenticated users to `/login`, renders a
  sidebar built from `navForTier(user.permissionTier)`, shows the tier badge, runs the
  attendance heartbeat.
- **Tier-driven navigation** — `lib/permissions.ts` declares `NAV[]`; each item lists the tiers
  allowed to see it, so the menu self-assembles per role (e.g. *Engineering Hub* → TIER_0/1/2,
  *Payroll* → TIER_0/1/7, *Signup Requests* → TIER_0/1).
- **Executive views** — *Dashboard*, *Analytics*, *Engineering Hub* (VP team-progress + cross-team
  assignment), *Project Progress* (+ Gantt with PDF report/chart export).
- **Operational views** — Tasks, Task Logs, Documents, QA/Bugs, Attendance, Leaves, Tickets.
- **Real-time** — a Socket.IO client subscribes to the `notifications` gateway; the bell updates
  live and `broadcast` pushes org-wide messages.
- **Defense in depth** — the menu hides unauthorized links *and* every page's API calls are
  guard-checked server-side, so URL-typing a forbidden route returns `403`.

---

## 9. Scalability & operations

- **Stateless API + JWT** → horizontal scale behind a load balancer; refresh-token hash in DB
  is the only per-user server state.
- **Modular monolith** → clean module boundaries mean any domain (e.g. `payroll`, `analytics`)
  can be peeled into its own service without touching callers.
- **Indexed audit + query paths**; list endpoints are tier-filtered at the DB, not in memory.
- **Externalized side-effects** — files → Cloudflare R2, email → SMTP (both env-driven, with
  dev fallbacks), so the API stays stateless.
- **Config via env** (`backend/.env`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `JWT_REFRESH_EXPIRES_IN`, `R2_*`, `SMTP_*`.

---

## 10. Recommended next steps to fully match the spec

1. **Add the `Department` model** (§3.2) and switch Engineering Hub + task assignment to
   `departmentId`. *(structural; ~1 migration + service updates)*
2. Add `Task.departmentId` so tasks are department-routable (your `Task.department` field).
3. Optionally formalize **VPE read-only** with a `READ_ONLY` capability or a write-guard, so
   global visibility can never become global write.
4. Add an **audit viewer UI** page over the existing `GET /api/audit` (data already collected).

Everything else in your spec is already implemented and running in this repo.
```
