# WorkoutAtlas Backend — Deployment Environment Variables

This file documents **every environment variable that MUST be set in the Render
backend service dashboard** (`https://dashboard.render.com`) for cross-origin
session cookies to work correctly between the frontend and backend.

> **Do NOT commit secrets to git.** Set all values marked 🔒 in the Render
> dashboard only — never in a `.env` file that is tracked by version control.

---

## ✅ Required — Session & CORS (Critical for auth to work)

| Variable | Required Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Enables `secure=true` + `sameSite=none` on the session cookie. Without this, Safari and all browsers drop cross-origin cookies silently. |
| `FRONTEND_URL` | `https://workoutatlas.com` | Tells the CORS middleware which origin to allow. If this is missing, **every preflight from the frontend is blocked** and login fails. |
| `API_PUBLIC_URL` | `https://api.workoutatlas.com` | Public backend base URL used in diagnostics and external links. |
| `COOKIE_DOMAIN` | `.workoutatlas.com` | Ensures session cookies are valid across `workoutatlas.com` and `api.workoutatlas.com` in production. |
| `SESSION_SECRET` 🔒 | A long random string (32+ chars) | Signs the session cookie. Must be consistent across restarts — Render preserves env vars between deploys. |

---

## ✅ Required — Database

| Variable | Required Value | Why |
|---|---|---|
| `DB_HOST` | `65.181.116.252` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_DATABASE` | `stephenk_flexfit` | Database name |
| `DB_USER` 🔒 | `stephenk_flexfitusr4126` | DB username |
| `DB_PASSWORD` 🔒 | *(see local `.env`)* | DB password |

---

## 🔧 Optional — Fine-tuning

| Variable | Recommended Value | Why |
|---|---|---|
| `DEBUG` | `true` (temporarily) | Enables `🧪` cookie/CORS/session diagnostic logs in the Render log stream. Disable after the auth issue is resolved. |
| `CORS_ORIGINS` | *(leave empty)* | Comma-separated list of additional allowed origins. `FRONTEND_URL` covers the main case. |
| `SESSION_COOKIE_SECURE` | *(leave unset)* | Derived automatically from `NODE_ENV=production`. |

---

## 🚫 What Breaks Without These

| Missing Variable | Symptom |
|---|---|
| `NODE_ENV` not `production` | Cookie gets `SameSite=Lax; Secure=false`. Cross-origin POST (login) fails on Safari/iOS. Session not persisted after redirect. |
| `FRONTEND_URL` missing | CORS blocks all requests from `https://workoutatlas.com`. Browser sees "Network Error" on login. |
| `SESSION_SECRET` missing | Falls back to `dev-only-session-secret`. Session still works but is insecure — sessions invalidated on each deploy. |

---

## 🔍 How to Verify on Render

After setting env vars and deploying, open the **Render Log Stream** and look for:

```
🚀 FRONTEND_URL=https://workoutatlas.com
🌐 Allowed CORS origins: https://workoutatlas.com
🍪 Session cookie: name=flexfit_session secure=true sameSite=none
```

If you see `FRONTEND_URL=(not set)` or `sameSite=lax`, the env vars are missing.

---

## 🩺 Live Diagnostics Endpoints

These endpoints are always available and return diagnostic JSON:

| Endpoint | Purpose |
|---|---|
| `GET /api/debug/ping` | Confirm backend is reachable; shows `env`, `origin` |
| `GET /api/session` | Returns `{ loggedIn, diagnostics }` — shows `cookieDetected`, `sameSiteValue`, `secureFlag`, `corsPassed` |

Example curl (replace with your Render URL):
```bash
curl -v https://api.workoutatlas.com/api/debug/ping
curl -v --cookie "flexfit_session=TEST" https://api.workoutatlas.com/api/session
```

---

## 📋 Render Dashboard Checklist

Before deploying, confirm in **Environment → Environment Variables**:

- [ ] `NODE_ENV` = `production`
- [ ] `FRONTEND_URL` = `https://workoutatlas.com`
- [ ] `SESSION_SECRET` = *(strong random string)*
- [ ] `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` all set
- [ ] No stale `SESSION_COOKIE_SECURE=false` override present

---

*Last updated: v0.81.7 — Render session persistence audit*
