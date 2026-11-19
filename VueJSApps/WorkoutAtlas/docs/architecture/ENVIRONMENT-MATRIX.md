# Environment Matrix

| Environment | Frontend | API | Database / Gateway | Verification |
|---|---|---|---|---|
| Local DEV ASK | `http://localhost:5173` | `http://localhost:5000` | Configured MySQL and environment gateway URL | Live listener evidence existed 2026-11-18 |
| Public frontend | `https://workoutatlas.com` | `https://api.workoutatlas.com` | Render/MySQL/gateway configuration in deployed environment | UNVERIFIED locally |
| AI/media gateway | Browser/API via backend | Tailscale HTTPS endpoint | `backend/.env` references configured gateway URL | Live gateway behavior depends on environment credentials |

Do not assume production infrastructure is operational from source configuration alone.
