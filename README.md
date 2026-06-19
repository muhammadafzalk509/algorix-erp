# ALGORIX — Project Management & ERP Platform

Full-stack, role-based ERP for a software company.

- **Backend:** NestJS + Prisma + PostgreSQL (JWT access+refresh, tier-based RBAC, Socket.IO)
- **Frontend:** Next.js 14 (App Router) + Tailwind
- **DB:** PostgreSQL (Docker)

## Role hierarchy (two-layer)
| Position | Tier | Count |
|---|---|---|
| CEO | TIER_0 (read-all) | 1 (seed only) |
| CTO | TIER_1 (full + approve devs) | 1 (seed only) |
| VP Engineering | TIER_2 | 1 |
| Head of Developer | TIER_3 | 2 |
| Head of Documentation | TIER_4 | 1 |
| Developer | TIER_5 (own data) | 5 max (CTO-approved) |

## Run

```bash
# 1) Database (Docker)
cd erp-system
docker compose up -d

# 2) Backend  → http://localhost:4000
cd backend
npm install
npx prisma migrate dev      # first time only
npm run db:seed             # creates roles + CEO + CTO
npm run start:dev

# 3) Frontend → http://localhost:3000
cd ../frontend
npm install
npm run dev
```

Seed logins: `ceo@company.com / ChangeMe!CEO123` · `cto@company.com / ChangeMe!CTO123`

## Modules (API at `/api/*`)
auth (+ Google sign-in) · users (+ avatar) · clients · projects (+milestones) ·
tasks (+ QA validate) · task-logs · comments · documents (R2 + virus-scan hook) ·
notifications (Socket.IO + role broadcasts) · leads · leaves · invoices (PDF) ·
tickets · analytics (+ project report) · gantt · **payroll** · **attendance** ·
**qa/bugs** · **audit trail**

## Access model (RBAC)
Two layers: a **tier hierarchy** (`TIER_0` CEO … `TIER_7` HR) for data visibility,
plus **capabilities** (`PAYROLL_*`, `QA_VALIDATE`, `ATTENDANCE_MANAGE`,
`NOTIFY_GLOBAL`, `AUDIT_VIEW`, …) for functional access. Enforced by `TierGuard`
(`@Tiers`) and `CapabilityGuard` (`@RequireCapability`). See `docs/ARCHITECTURE.md`.

## Optional integrations (env-driven)
- **Cloudflare R2** (`R2_*`) — document uploads
- **SMTP** (`SMTP_*`) — real emails (otherwise logged to console in dev)

See `backend/.env.example` for all variables.
