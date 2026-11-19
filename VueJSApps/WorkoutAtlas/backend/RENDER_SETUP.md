# WorkoutAtlas Backend Deployment Environment — Compatibility Entry Point

**Status:** deployment procedure UNVERIFIED until explicit hosting evidence is supplied.

The historical Render setup previously contained environment names and example values. Secrets and live account details must not be committed or reproduced here.

Use these repository sources for current configuration:

- [Environment matrix](../docs/architecture/ENVIRONMENT-MATRIX.md)
- [Local development runbook](../docs/operations/LOCAL-DEV-RUNBOOK.md)
- [Deployment runbook](../docs/operations/DEPLOYMENT-RUNBOOK.md)
- `backend/server.js` for CORS, sessions, route mounts, and startup behavior
- `backend/.env` only as a local/developer environment source; never publish secret values
- `frontend/src/config/env.js` for frontend API base resolution

## Approval-required deployment gates

- Verify `NODE_ENV`, frontend origin, API public URL, cookie/session configuration, database variables, and gateway variables in the deployment environment.
- Do not paste passwords, database credentials, session secrets, OAuth secrets, or gateway tokens into Git.
- Production deployment and server changes require explicit authorization.
