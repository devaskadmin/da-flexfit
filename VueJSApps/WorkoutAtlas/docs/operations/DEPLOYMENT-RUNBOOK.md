# Deployment Runbook

**Status:** UNVERIFIED/approval-gated. Repository configuration references Render hosting and public domains, but deployment procedures require explicit environment evidence and authorization.

- No deployment is part of documentation work.
- Verify source commit, package versions, tests, QA status, migrations, backup, and rollback before deployment.
- Do not push or deploy without explicit approval.

## 0.85.325 static Render review notes (2026-11-28; static only, nothing deployed or changed)

- Not in the repository, so confirm in the Render dashboard: backend Start Command (`backend/package.json` has no `start` script; `node server.js` is expected), static-site rewrite `/*` -> `/index.html` for history-mode routes (for example `/logout`), and the existing CORS/session environment values (not inspected; `.env*` not read).
- Statically verified: case-exact imports/requires, tracked lockfiles, Node 22 (`backend/.nvmrc`, `engines`), backend binds `0.0.0.0` on `PORT`, `trust proxy` set, secure cross-site session cookies. Production build and runtime verification have not been run.
- Owner authorized the push of `0.85.321`-`0.85.325` to `BETA` (2026-11-28), including any existing Render automatic deployment it triggers. Render build and runtime verification and manual acceptance testing remain pending; no manual deployment or deployment-setting change was made.
