# WorkoutAtlas Batch Results

## 0.85.292 — Existing set edit persistence and history integrity
- Scope: ensure direct edits to existing set values persist without requiring add/remove/complete follow-up actions, and flush persistence before Workout Log history reload.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `frontend/src/components/workout-session/ExerciseSessionCard.vue`, `backend/tests/workout-log-session-persistence.test.js`, `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: full backend suite passed; frontend build passed; added regression tests cover corrected completed-set edits, rapid successive edits, remove-set persistence cleanup, and two-session isolation.
- Caveats: authenticated live browser replay remains dependent on local auth/backend availability in this environment.

## 0.85.291 — Compact mobile Exercise Picker layout
- Scope: reduce the Add Exercise modal’s wasted vertical real estate and keep the Category/Equipment filters compact on narrow mobile widths without altering the picker’s exercise selection logic.
- Files changed: `frontend/src/components/workout-builder/ExercisePickerModal.vue`, `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: frontend production build passed; modal opened successfully at 375px and 430px in local browser checks; full authenticated workout-flow validation remains blocked by the local app’s auth/CORS issue.
- Caveats: the Vite frontend currently redirects to login and cannot reach the backend at `http://localhost:5000` from the browser in this environment, so live active-session validation remains pending.

## 0.85.290 — Completion routes to Workout Log history
- Scope: ensure successful Complete & End Workout navigates to the existing Workout Log history tab after backend completion instead of resetting to the overview tab.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: backend full suite passed (118/118); frontend production build passed; live iPhone confirmation still required.
- Commit hash: `ca7dc832d140e6ba0a46b60abe4b9977763be731`.
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
