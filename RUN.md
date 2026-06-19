# ALGORIX — How to Run (Windows / PowerShell)

Three parts run together: **Database (Docker)** → **Backend (NestJS :4000)** → **Frontend (Next.js :3000)**.

---

## A. First time only (one-time setup)

```powershell
# 0) Make sure Docker Desktop is running

# 1) Start the PostgreSQL database
cd c:\Users\dell\Desktop\erp-system
docker compose up -d

# 2) Backend: install deps, create DB tables, seed CEO+CTO, (optional) demo data
cd c:\Users\dell\Desktop\erp-system\backend
npm install
npx prisma migrate dev      # creates all tables
npm run db:seed             # creates roles + CEO + CTO logins
npm run demo:seed           # OPTIONAL: sample project + Gantt timeline

# 3) Frontend: install deps
cd c:\Users\dell\Desktop\erp-system\frontend
npm install
```

---

## B. Every time you want to run it

Open **three** terminals (or run each, leave it open).

```powershell
# Terminal 1 — Database (skip if already "Up")
cd c:\Users\dell\Desktop\erp-system
docker compose up -d

# Terminal 2 — Backend  →  http://localhost:4000
cd c:\Users\dell\Desktop\erp-system\backend
npm run start:dev

# Terminal 3 — Frontend  →  http://localhost:3000
cd c:\Users\dell\Desktop\erp-system\frontend
npm run dev
```

Then open **http://localhost:3000**

Login:
- CEO  → `ceo@company.com` / `ChangeMe!CEO123`
- CTO  → `cto@company.com` / `ChangeMe!CTO123`

---

## C. Stop everything

```powershell
# stop backend/frontend (kills all node)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# stop the database (data is kept safe in the Docker volume)
cd c:\Users\dell\Desktop\erp-system
docker compose stop
```

---

## D. Handy extras

```powershell
# View the database in a browser GUI
cd c:\Users\dell\Desktop\erp-system\backend
npx prisma studio                # → http://localhost:5555

# Health check (is backend up?)
# open in browser: http://localhost:4000/api/health
```

## Test logins (created during development — delete anytime)
- HR / Payroll Officer → `hr@test.com` / `HrPass123` (Payroll module)
- QA → `qa@test.com` / `QaPass123` (QA/Bugs, task validation)

These let you explore the new modules. To remove them:
```sql
-- in: docker exec -it erp_postgres psql -U erp -d erpdb
DELETE FROM "User" WHERE email IN ('hr@test.com','qa@test.com');
```

## Google Sign-In (optional)
- The login page shows a "Sign in with Google" button **only when a Client ID is set**.
- It's login-only for existing **ACTIVE** users (matched by email); it never creates accounts.
- Setup steps: see `GOOGLE_SIGNIN.md`.

## Notes
- Database = PostgreSQL in Docker (container `erp_postgres`, db `erpdb`, port 5432). Data persists in Docker volume `erp-system_erp_pgdata`.
- If port 4000/3000 is stuck, run the stop command in section C, then start again.
- Email/file-upload need SMTP/R2 creds in `backend/.env` (optional; app works without them in dev).
