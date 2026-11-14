# WorkoutAtlas Batch Results

## 0.85.288 — Start New Workout confirmation fix
- Scope: remove the stale destructive second-workout replacement flow from the frontend conflict modal and align the UI with the backend two-active-session policy.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: targeted workout-session backend regressions + frontend build (see terminal logs), manual live-browser check still recommended on iPhone-sized viewport and real active session flow.
- Commit hash: pending until local git commit is created.
- Caveats: no gateway or production-data changes; no destructive session-ending request is sent for the second active session.
