---
name: WorkoutAtlas Backend
description: "Use for Express routes, authentication, authorization, workout APIs, MySQL access, and backend testing."
applyTo: "backend/**"
---

- Preserve route mounts in `backend/server.js` unless a task explicitly changes them.
- Keep backend authorization independent of frontend role labels.
- Do not mutate database records or run migrations without explicit approval.
- Add targeted backend tests for defect repairs.
- Never expose credentials or gateway secrets in source or docs.
