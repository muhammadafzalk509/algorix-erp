# Deployment — ALGORIX

- **Backend (NestJS)** → Render web service (free, supports WebSockets/Socket.IO)
- **Frontend (Next.js)** → GitHub Pages (static export)
- **Database** → Firestore (already live: project `erpsystem-67e17`)

Repo: https://github.com/muhammadafzalk509/algorix-erp

---

## 1. Deploy the backend on Render

1. Go to https://dashboard.render.com → **New → Blueprint**.
2. Connect this GitHub repo. Render reads [`render.yaml`](render.yaml) and proposes
   the `algorix-backend` web service. Click **Apply**.
3. Open the service → **Environment** and fill in the values marked `sync: false`:

   | Variable | Value |
   |---|---|
   | `FRONTEND_URL` | `https://muhammadafzalk509.github.io` (your Pages origin, no path) |
   | `FIREBASE_PROJECT_ID` | `erpsystem-67e17` |
   | `FIREBASE_CLIENT_EMAIL` | from your service account (firebase-adminsdk-…@…) |
   | `FIREBASE_PRIVATE_KEY` | full key incl. `-----BEGIN/END PRIVATE KEY-----` |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | email |
   | `GOOGLE_CLIENT_ID` | Google OAuth web client id |

   (`JWT_SECRET` / `JWT_REFRESH_SECRET` are auto-generated — leave them.)
4. Deploy. When live you get a URL like `https://algorix-backend.onrender.com`.
   Verify: open `https://algorix-backend.onrender.com/api/health` → `{ "ok": true, ... }`.

> Free plan note: the service sleeps after ~15 min idle and cold-starts (~50s) on the
> next request. Upgrade the plan to keep it always-on.

---

## 2. Deploy the frontend on GitHub Pages

GitHub Pages on a **private** repo requires a paid GitHub plan. On the free plan,
make the repo public first:

```bash
gh repo edit muhammadafzalk509/algorix-erp --visibility public --accept-visibility-change-consequences
```

1. **Set build variables** (Settings → Secrets and variables → Actions → *Variables*),
   using the Render URL from step 1:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://algorix-backend.onrender.com/api` |
   | `NEXT_PUBLIC_WS_URL` | `https://algorix-backend.onrender.com` |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth web client id (optional) |
   | `NEXT_PUBLIC_BASE_PATH` | `/algorix-erp` *(already set)* |

   ```bash
   gh variable set NEXT_PUBLIC_API_URL --body "https://algorix-backend.onrender.com/api" --repo muhammadafzalk509/algorix-erp
   gh variable set NEXT_PUBLIC_WS_URL  --body "https://algorix-backend.onrender.com"     --repo muhammadafzalk509/algorix-erp
   ```

2. **Enable Pages**: Settings → Pages → *Build and deployment* → Source = **GitHub Actions**.
3. **Run the deploy**: Actions → "Deploy frontend to GitHub Pages" → *Run workflow*
   (or push any change under `frontend/`).
4. Site goes live at **https://muhammadafzalk509.github.io/algorix-erp/**.

---

## 3. Wire the two together (CORS)

After the frontend is live, make sure the backend's `FRONTEND_URL` on Render is set to
`https://muhammadafzalk509.github.io` so CORS allows the browser requests. Redeploy the
Render service if you change it.

## Order of operations

Backend (Render) first → get its URL → set `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL`
variables → run the Pages workflow → set Render `FRONTEND_URL` to the Pages origin.
