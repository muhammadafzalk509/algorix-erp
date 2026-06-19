# Google Sign-In — Setup

Google sign-in is a **login method for users who already exist and are `ACTIVE`**.
It matches by email and **never creates accounts**, so the signup-approval / RBAC
flow is untouched. An unknown or non-active email is rejected.

```
Click "Sign in with Google"
   → Google returns an ID token (JWT credential) to the browser
   → Frontend POSTs it to  /api/auth/google
   → Backend verifies the token with Google (google-auth-library)
   → Looks up the email in PostgreSQL (Prisma User table)
        ├── exists & ACTIVE  → issue JWT access + refresh (same as password login)
        └── unknown / not active → 401 "Ask an admin to invite you."
   → Dashboard
```

The button only appears once a Client ID is configured; until then the page works
exactly as before (password login only).

---

## 1. Create an OAuth 2.0 Client ID

1. Go to <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → OAuth consent screen** → configure it (External is fine for
   testing; add your own Google account under **Test users**).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized JavaScript origins** — add:
   - `http://localhost:3000`
6. Click **Create** and copy the **Client ID** (looks like
   `1234567890-abc...apps.googleusercontent.com`).

> Google Identity Services uses the JavaScript origin only — no redirect URI or
> client secret is needed for this ID-token flow.

---

## 2. Paste the Client ID into both env files

Use the **same** Client ID in both.

`backend/.env`
```
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

`frontend/.env.local`
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

---

## 3. Restart both servers

Env vars are read at boot, so restart after editing:

```powershell
# backend (Terminal 2)
cd c:\Users\dell\Desktop\erp-system\backend
npm run start:dev

# frontend (Terminal 3)
cd c:\Users\dell\Desktop\erp-system\frontend
npm run dev
```

---

## 4. Test

- The Google account you sign in with must match an existing **ACTIVE** user's email.
  To try it with a seed account, set that user's email to a Google address you own,
  or add yourself as a user first.
- Open <http://localhost:3000/login> → click **Sign in with Google**.
- Unknown email → "No account for this Google email. Ask an admin to invite you."

### Quick backend check (no browser)
```powershell
# Not configured / bad token both fail safely:
curl -s -X POST http://localhost:4000/api/auth/google -H "Content-Type: application/json" -d '{\"idToken\":\"bad\"}'
```
