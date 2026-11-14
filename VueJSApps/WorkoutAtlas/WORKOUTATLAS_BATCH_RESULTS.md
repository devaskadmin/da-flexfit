# WorkoutAtlas Batch Results

## 0.85.290 — Completion routes to Workout Log history
- Scope: ensure successful Complete & End Workout navigates to the existing Workout Log history tab after backend completion instead of resetting to the overview tab.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: pending full backend suite and frontend production build after the patch; final live iPhone confirmation still required.
- Commit hash: pending until local git commit is created.
- Caveats: no production data or gateway changes; completion navigation is blocked until a successful backend completion response is returned.

## 0.85.289 — Session-aware Workout Timer Controls
- Scope: verify the existing session-aware timer behavior against the Prompt 2 acceptance criteria without introducing a second timer or schema changes.
- Files changed: `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: existing timer unit tests passed; frontend production build succeeded.
- Commit hash: `03716589998d6504416ba660ae28ba271b9d50d3`.
- Caveats: manual live gym verification on iPhone remains the only non-automated acceptance item.

## 0.85.288 — Start New Workout confirmation fix
- Scope: remove the stale destructive second-workout replacement flow from the frontend conflict modal and align the UI with the backend two-active-session policy.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: targeted workout-session backend regressions + frontend build (see terminal logs), manual live-browser check still recommended on iPhone-sized viewport and real active session flow.
- Commit hash: `63727a9fea5a50a08909ef530d5e070649a1aa83`.
- Caveats: no gateway or production-data changes; no destructive session-ending request is sent for the second active session.
