# WorkoutAtlas Batch Results

## 0.85.301 - Workout completion timer shutdown and session isolation
- Scope: investigate and fix completion lifecycle integrity so completed workout sessions permanently stop timer progression, preserve final duration, and remain isolated from other unfinished sessions.
- Root-cause evidence:
	- Backend completion used a single elapsed recomputation path (`TIMESTAMPDIFF(started_at, NOW())`) for all live statuses, so completing a paused session could absorb paused idle wall-clock time.
	- Frontend completion/pause-resume path could accept delayed transition responses after teardown without an explicit stale-response guard.
- Files changed: `backend/api/workout-sessions.js`, `frontend/src/views/Member/LogWorkout.vue`, `backend/tests/workout-session-recovery.integration.test.js`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification:
	- Targeted completion/session regressions passed (15/15).
	- Targeted history/summary regressions passed (12/12).
	- Targeted persistence/status regressions passed (16/16).
	- Frontend timer utility tests passed (11/11).
	- Full backend suite passed (155/155).
	- Frontend production build passed (`BUILD_OK`).
- Runtime/browser note: `/workout-log` currently redirects to `/login` in this environment without an authenticated member session, so full authenticated breakpoint replay for completion interactions (320/375/390/430/desktop) could not be executed in this run.

## 0.85.300 - avatarPath database error and session-role reliability
- Scope: investigate and resolve `Unknown column 'avatarPath'` by validating live schema and applying compatibility-safe auth/session/avatar query behavior without schema mutation.
- Root-cause evidence: read-only DB inspection confirmed active `users` table lacks `avatarPath` and `avatarName` columns (and snake_case variants), while auth/session code contained explicit avatar-column SQL.
- Files changed: `backend/api/auth.js`, `backend/src/routes/avatar.js`, `backend/tests/auth-avatar-session-compat.integration.test.js`, `backend/tests/auth-register-featured-plan.integration.test.js`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification: targeted auth/avatar/session and featured-registration tests passed (11/11); full backend suite passed (154/154); frontend production build passed (`BUILD_OK`).
- Browser/auth smoke limitations: local browser validation remained constrained by available authenticated credentials/session context, so end-to-end live login/profile/logout replay was not executed here; automated auth/session regression coverage was expanded to cover the schema mismatch condition directly.

## 0.85.299 - Featured workout plan registration integration
- Scope: complete registration-feature integration so guest-selected featured plans are copied into a new user's private plan library during account creation using existing personal-copy architecture and transactional safety.
- Files changed: `backend/api/auth.js`, `frontend/src/views/Guest/register.vue`, `backend/tests/auth-register-featured-plan.integration.test.js`, `backend/tests/featured-plan-public-access.test.js`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification: targeted registration/featured tests passed (8/8); full backend suite passed (151/151); frontend production build passed (`BUILD_OK`).
- Browser evidence: registration flow remained responsive with no horizontal overflow at 320/375/430 and desktop widths on subscription and info steps; featured-card selection path is data-dependent and was not visually exercised because no featured plans were available in this local runtime dataset.

## 0.85.298 - Workout set persistence and history integrity hardening
- Scope: audit and harden set edit/add/remove/completion persistence integrity by preserving 0.85.292 architecture and fixing a live-state gap where paused sessions could skip progress persistence.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `backend/tests/workout-log-session-persistence.test.js`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification: targeted persistence/history/session regressions passed (37/37); full backend suite passed (144/144); frontend production build passed (`BUILD_OK`).
- Compatibility checks: retained green coverage for daily summary behavior (0.85.294), mobile action layout paths (0.85.295 unaffected frontend routes), timer/session lifecycle paths (0.85.296), and paused-session schema compatibility regressions (0.85.297).
- Caveats: authenticated end-to-end browser replay in this session remains dependent on local auth/session availability; no schema changes were made in 0.85.298.

## 0.85.297 - Timer paused-status schema compatibility
- Scope: make Workout Timer paused-session lifecycle fully schema-compatible by adding paused enum migration support, aligning canonical schema defaults/statuses, and closing paused-active query gaps in plan/session cleanup paths.
- Files changed: `backend/api/users.js`, `backend/api/workout-sessions.js`, `backend/schema/workout_schedule_schema.sql`, `backend/migrations/workout/20261117_workout_session_status_paused.sql`, `backend/tests/workout-session-recovery.integration.test.js`, `backend/tests/workout-session-status-schema.test.js`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification: targeted paused/schema/session regressions passed (18/18); full backend suite passed (142/142); frontend production build passed; `git diff --check` passed.
- Caveats: long-running local backend processes may continue serving pre-patch route wiring until restart, so local 404 behavior for newly introduced endpoints can persist in stale process instances when restart is deferred.

## 0.85.296 — Workout timer and session persistence reliability
- Scope: stabilize Current Workout timer/session reliability by adding explicit pause/resume lifecycle support, automatic tab leave/return timer control, and paused-session recovery while preserving existing history summary behavior.
- Files changed: `backend/api/workout-sessions.js`, `backend/api/workout-log.js`, `backend/tests/workout-session-recovery.integration.test.js`, `frontend/src/views/Member/LogWorkout.vue`, `frontend/src/utils/workoutSessionTimer.test.mjs`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification: frontend timer utility tests passed (11/11); targeted backend timer/session/history tests passed (30/30); full backend suite passed (136/136); frontend production build passed.
- Browser evidence: authenticated Current Workout rendered with the new timer control at 320/375/430/768/1024/1440 with no horizontal overflow; mobile screenshots captured at 375 and 430 including the Pause/Play control beside Workout Time.
- Caveats: live Pause/Play interaction against the long-running local backend process could not be fully validated in-browser because that already-running process returned 404 for newly added pause/resume routes until restart; no restart was performed per instruction.

## 0.85.295 — Mobile workout button layout fixes
- Scope: stabilize Current Workout exercise-card action layout on mobile so Add Set and Complete Exercise remain consistently placed and readable across narrow breakpoints while preserving all workout behavior.
- Files changed: `frontend/src/components/workout-session/ExerciseSessionCard.vue`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification: full backend suite passed (134/134); frontend production build passed.
- Browser evidence: authenticated Current Workout checks passed at 320/375/430/768/1024/1440 with no horizontal overflow; interactive checks confirmed Add Set, mark set complete, and expand/collapse still function after layout changes; screenshots captured at 375 and 430.
- Caveats: real iPhone device QA is still recommended to confirm production parity for mobile spacing/typography nuances.

## 0.85.294 — Daily cumulative workout time in Workout Log
- Scope: add a daily cumulative `Total Workout Time Today` history summary above Workout Log results while preserving all existing history record rendering and controls.
- Files changed: `backend/api/workout-log.js`, `backend/utils/workout-history-summary.js`, `backend/tests/workout-history-daily-summary.test.js`, `backend/tests/workout-log-history-visibility.test.js`, `frontend/src/views/Member/LogWorkout.vue`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`.
- Verification: targeted regressions passed (17/17); full backend suite passed (134/134); frontend production build passed.
- Browser evidence: authenticated Workout Log history tab rendered `Total Workout Time Today` with `00:00:00` and completed-session count; viewport checks at 320/375/430 reported no horizontal overflow.
- Caveats: real iPhone device QA is still recommended to confirm production parity for all mobile typography/spacing nuances.

## 0.85.293 — Cardio workout history visibility restoration
- Scope: fix local/UTC workout date drift that could make in-progress cardio entries appear in Current Workout but disappear from Workout Log for the selected local day.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `backend/api/workout-log.js`, `backend/tests/workout-log-history-visibility.test.js`, `backend/tests/workout-log-session-persistence.test.js`, `CHANGELOG.md`, `frontend/package.json`, `backend/package.json`.
- Verification: backend full suite passed (124/124); frontend production build passed; added regressions verify in-progress cardio history visibility and local-date fallback save semantics.
- Caveats: authenticated live browser/iPhone replay remains dependent on local auth session availability in this environment.

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
