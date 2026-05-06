# Changelog

## [0.79] — Default Set Logic + Complete Workout Redirect

### Part 1+2 — Default Set Logic (Frontend)
Added `getDefaultSetCount(exercise)` helper in `LogWorkout.vue` used by `buildInitialSets()`:

| Type | Default sets |
|---|---|
| Cardio | **1** (always) |
| Other | **1** (always) |
| Strength | Plan `Sets` value; fallback **3** if missing/null/blank/0 |
| Unknown | Plan `Sets` value if valid; fallback **1** |

Previously `exercise.sets \|\| 1` was used which caused Cardio exercises to inherit whatever `sets` value was on the exercise record (often 3), resulting in 3 cardio sets being created on Start Workout.

### Part 3 — Backend Protection
The backend `PUT /session/:sessionId/save-day` already uses `sets.length` from the payload (not a hardcoded default), so no backend change is needed — the correct set count flows from the frontend payload.

### Part 4 — Complete Workout Redirect
After **Complete Workout** saves successfully:
- Previously: waited 2 s then switched to **Overview**.
- Now: waits 2 s, clears day selection, switches to **Workout History**, and calls `loadWorkoutHistory()` so the completed session appears immediately.

---

## [0.78.h] — Save Day Button + Fix History Exercise Images

### Part 1 — Save Day Button (Day Details Tab)
A **Save Day** button now appears in the sticky bottom bar alongside End Workout and Complete Workout, visible whenever an active in-progress workout day is open.

- Clicking **Save Day** persists the current exercise/set values for the selected day without ending or completing the workout.
- Shows `✓ Day saved!` success feedback (auto-clears after 3 s).
- Shows inline error message if the save fails.
- Both Save Day and Complete Workout disable while a save is in flight.

### Part 2 — Null / Blank Value Handling
A `toSafeNumber()` helper converts `null`, `undefined`, empty string, or `NaN` to `0` before sending any set value to the backend.

Applied to all set fields: `weight`, `reps`, `duration`, `caloriesBurned`, `distanceMiles`, `speedMph`.

Backend `PUT /session/:sessionId/save-day` also uses a `toSafe()` guard before every DB write.

### Part 3 — Backend: `PUT /api/workout-log/session/:sessionId/save-day`
New endpoint added to `backend/api/workout-log.js`:
- Verifies the session is `in_progress` and belongs to the logged-in user.
- Upserts `workout_log` rows per exercise (UPDATE if row exists for session+exercise, INSERT otherwise).
- Upserts `workout_log_sets` rows via `ON DUPLICATE KEY UPDATE`.
- Does **not** touch `status`, `started_at`, or `completed_at`.
- Returns `{ message: 'Day saved successfully.', sessionId }`.

### Part 4 — Fix Workout History Exercise Images
Workout History exercise thumbnails were broken — the `exerciseImage` field from the DB contains a JSON array string like `["Elliptical_Trainer/0.jpg","Elliptical_Trainer/1.jpg"]` which was being used directly as an `<img src>`.

Fix:
- Imported the existing `getExerciseImageFromGallery` utility from `@/utils/exerciseImage`.
- History template now calls `getExerciseImageFromGallery(ex.exerciseImage)` to parse the array, extract the first image, and build the correct asset path (`/assets/Excerises/<folder>/0.jpg`).
- Falls back to the default image if the gallery is missing or unparseable.

---

## [0.78.g1] — Fix Workout History 500 Error (Missing DB Columns)

Resolved the `ER_BAD_FIELD_ERROR: Unknown column 'calories_burned' in 'SELECT'` 500 error on `GET /api/workout-log/history`.

### Root Cause
Migration `backend/migrations/002_workout_log_sets_cardio_fields.sql` (added in 0.78.f) had not been applied to the database. The `GET /history` and `POST /session` routes both reference `calories_burned`, `distance_miles`, and `speed_mph` on `workout_log_sets`, but those columns did not exist yet.

### Fix
- Confirmed the three columns (`calories_burned DECIMAL(7,2)`, `distance_miles DECIMAL(7,3)`, `speed_mph DECIMAL(6,2)`) were added to `workout_log_sets` via the migration.
- No code changes required — all backend/frontend logic from 0.78.f and 0.78.g was already correct.

### Also
- Renamed the previous git commit from `0.77.G` → `0.78.G`.

---

## [0.78.g] — Edit And Save Workout History

Completed workout history records are now editable. Each history session card has an Edit button that switches the set table to editable inputs. Changes are saved via a new PUT endpoint and the history refreshes automatically.

### Backend — `backend/api/workout-log.js`
- Added `PUT /api/workout-log/history/session/:sessionId`.
- Verifies session exists and belongs to the logged-in user (403 if not).
- Rejects edits on `in_progress` sessions (409).
- For each exercise in the payload, verifies the `workout_log` row belongs to the session + user.
- Updates `workout_log_sets` rows: `reps`, `weight`, `duration_minutes`, `calories_burned`, `distance_miles`, `speed_mph`.
- Re-computes and updates `workout_log` summary aggregates (Weight, Reps, Duration, Calories, Distance, Speed).
- Runs transactionally; rolls back on error.
- Returns `{ message, sessionId, updatedExercises }`.

### Frontend — `Member/LogWorkout.vue`
**New state refs:**
- `editingHistorySessionId` — holds the `sessionId` currently in edit mode (null = read-only).
- `historyEditDraft` — `{ [workoutLogId]: [...sets] }` deep clone of original set data for the active edit.
- `savingHistoryWorkout` — disables Save/Cancel buttons during the PUT request.
- `historySaveError` — inline error shown in the session header if the save fails.

**New functions:**
- `startEditHistoryWorkout(session)` — deep-clones all exercise sets into `historyEditDraft`, sets `editingHistorySessionId`.
- `cancelEditHistoryWorkout()` — clears draft and exits edit mode without saving.
- `updateHistoryDraft(workoutLogId, setIdx, field, value)` — mutates the in-memory draft on input change.
- `saveHistoryWorkout(session)` — sends `PUT /api/workout-log/history/session/:sessionId`, calls `cancelEditHistoryWorkout` + `loadWorkoutHistory` on success.

**Template changes:**
- Session cards bind `:class` with `wl-history-session--editing` when in edit mode.
- Session header meta area now shows **Edit + Delete** (read-only mode) or **Cancel + Save + inline error** (edit mode). Only one session can be edited at a time (Edit button is disabled on others).
- Strength set rows: Weight and Reps cells render `<input type="number">` when editing, plain span otherwise.
- Cardio/Other set rows: Duration, Calories, Distance, Speed cells render inputs when editing. Done column is always read-only.

**CSS:**
- `.wl-history-session--editing` — subtle blue-tinted border + background on the active edit card.
- `.wl-hist-edit-btn` (blue), `.wl-hist-save-btn` (green), `.wl-hist-cancel-btn` (grey) — action buttons.
- `.wl-hist-save-error` — inline red error text in the session header.
- `.wl-hist-set-input` — compact number input styled to match the set table grid.

 — Match Workout History Fields To Day Details (Cardio + Other)

Workout History now displays the same per-set detail as Day Details for all exercise types — Cardio and Other show Duration, Calories Burned, Distance (mi), Speed (mph) and Done status per set.

### Database Migration — `backend/migrations/002_workout_log_sets_cardio_fields.sql`
- Added `calories_burned DECIMAL(7,2)`, `distance_miles DECIMAL(7,3)`, `speed_mph DECIMAL(6,2)` columns to `workout_log_sets`.
- **Must run before deploying 0.78.f** — existing rows default to NULL.

### Backend — `backend/api/workout-log.js`
- `POST /api/workout-log/session`: Updated `INSERT INTO workout_log_sets` to store `calories_burned`, `distance_miles`, `speed_mph` from the incoming `caloriesBurned`, `distanceMiles`, `speedMph` set fields. Also updated `ON DUPLICATE KEY UPDATE` clause.
- `GET /api/workout-log/history`: Added `calories_burned AS caloriesBurned`, `distance_miles AS distanceMiles`, `speed_mph AS speedMph` to the per-set SELECT query.

### Frontend — `Member/LogWorkout.vue`
**Template — Workout History per-set tables:**
- **Strength**: unchanged — Set, Weight (kg), Reps, Done (4-column grid).
- **Cardio + Other**: replaced the old 3-column Duration/Done table with a 6-column table showing Set, Duration (min), Calories (kcal), Distance (mi), Speed (mph), Done. Both `cardio` and `other` workoutTypes use this new layout.
- Fixed bug where `other` type was incorrectly falling into the Strength table.
- Removed the old aggregate `.wl-hist-cardio-stats` inline stats block (now superseded by per-set data).
- Fallback (legacy records without sets): updated `cardio` condition to `['cardio','other'].includes(...)`.

**CSS:**
- Replaced single `.wl-hist-sets-head` / `.wl-hist-set-row` grid rules with modifier classes:
  - `.wl-hist-sets-head--strength` + `.wl-hist-set-row--strength` → 4-column layout.
  - `.wl-hist-sets-head--cardio` + `.wl-hist-set-row--cardio` → 6-column layout with `overflow-x: auto` on mobile.
  - `.wl-hist-sets-table--cardio` for horizontal scroll wrapper.



Adds a Delete button to each completed workout session card in the Workout History tab, with a confirmation modal before permanent deletion.

### Backend — `backend/api/workout-log.js`
- Added `DELETE /api/workout-log/history/session/:sessionId`.
- Verifies the session exists and belongs to the logged-in user (403 if not).
- Rejects deletion of `in_progress` sessions (409) — only completed/cancelled sessions can be deleted.
- Runs a transactional delete in order: `workout_log_sets` → `workout_log` → `workout_log_sessions`.
- Returns `{ message, sessionId }` on success or a descriptive error JSON on failure.

### Frontend — `Member/LogWorkout.vue`
**New state refs:**
- `showDeleteHistoryModal` — controls modal visibility.
- `workoutHistoryToDelete` — holds `{ sessionId, planName, workoutDate }` for the targeted session.
- `deleteHistoryLoading` — disables buttons while the request is in flight.
- `deleteHistoryError` — surfaces server errors inside the modal.

**New functions:**
- `openDeleteHistoryModal(session)` — populates `workoutHistoryToDelete` and opens the modal.
- `closeDeleteHistoryModal()` — resets state and closes modal.
- `confirmDeleteHistoryWorkout()` — calls `DELETE /api/workout-log/history/session/:sessionId`, then refreshes history via `loadWorkoutHistory()`.

**Template changes:**
- Added a red **Delete** button (`.wl-hist-delete-btn`) to the right side of every session header in the history list.
- Added a `<Teleport to="body">` confirmation modal showing the plan name and workout date, with Cancel and Delete buttons.
- Modal inline error banner shown if the delete request fails.

**New CSS classes:**
`.wl-hist-delete-btn`, `.wl-modal-overlay`, `.wl-modal`, `.wl-modal__header`, `.wl-modal__close`, `.wl-modal__body`, `.wl-modal__sub`, `.wl-modal__footer`, `.wl-btn-delete`, `@keyframes wl-modal-in`.

## [0.78.d] — Workout In Progress Date Lock Fix

Fixes the selected date not switching to the active workout's start date when clicking "Workouts In Progress", and fixes new workouts always being saved under today's date instead of the user's selected date.

### Problem 1 — New workout always used `today()` regardless of selected date
`startDayWorkout` hardcoded `workoutDate: today()` in the `/workout-sessions/start` POST body. If a user selected 2026-05-05 and started a workout, the session was stored under today's date instead.

**Fix:** `startDayWorkout` now reads `selectedWorkoutDate.value` as the workout start date (falling back to `today()` only if it is blank), and after the session is created it locks `selectedWorkoutDate.value` to that start date.

### Problem 2 — "Workouts In Progress" button didn't restore the session's date
`goToInProgress` only set `selectedDay` and switched tabs — it never touched `selectedWorkoutDate`. A user who started a workout on May 5 and returned on May 6 would see the date picker showing May 6 while viewing a May 5 session.

**Fix:** `goToInProgress` now reads `activeSession.value.workoutDate`, parses it safely, and sets `selectedWorkoutDate.value` before switching to the Day Details tab.

### Problem 3 — On page load the date picker wasn't restored for in-progress sessions
`checkActiveSession` fetched the active session and expanded the plan, but never restored `selectedWorkoutDate`. So on a fresh page load the date picker showed today even if the active session started on a previous day.

**Fix:** `checkActiveSession` now sets `selectedWorkoutDate.value` from `data.session.workoutDate` whenever an active session is found.

### No backend changes required
The `/workout-sessions/start` route already accepts `workoutDate` from the request body and stores it directly in `workout_log_sessions.workout_date`. No SQL migration needed.

### Files changed
- `frontend/src/views/Member/LogWorkout.vue` — `startDayWorkout`, `checkActiveSession`, `goToInProgress`

## [0.78.c] — Workout History SQL Column Fix (`MajorMuscle` → `MuscleGroup`)

Fixes the 500 error that caused the Workout History tab to show "Failed to fetch workout history" after the 0.78.b backend restart.

### Root Cause
The `GET /api/workout-log/history` SQL query referenced `ex.MajorMuscle` — a column that does not exist in the `exercises` table. The actual column name (confirmed from `excerises.js` INSERT/UPDATE statements and the exercises schema) is `MuscleGroup`. MySQL threw `ER_BAD_FIELD_ERROR: Unknown column 'ex.MajorMuscle' in 'SELECT'`, resulting in a 500 response on every history request.

### Fix — `backend/api/workout-log.js`
- Changed `ex.MajorMuscle AS muscleGroup` → `ex.MuscleGroup AS muscleGroup` in the `/history` route SELECT query.
- Backend restarted to load the corrected query.

### No frontend changes required
All frontend state, template, and CSS from 0.78/0.78.a/0.78.b remain intact.

## [0.78.b] — Workout History 404 Fix (Backend Restart)

Fixes the `Server error 404` displayed in the Workout History tab after the 0.78/0.78.a changes.

### Root Cause
The backend Node.js process (PID 16092) had been running since **5 May 2026 08:11 AM** — before the `GET /api/workout-log/history` route was written to `workout-log.js`. Node.js does not hot-reload; the route existed on disk but was never loaded into the running process. Every request to `/api/workout-log/history` fell through to Express's built-in 404 handler.

### Fix
- Identified the stale process using `Get-CimInstance Win32_Process` to match the `server.js` command line.
- Stopped PID 16092 and restarted the backend with `node -r dotenv/config server.js` from the `backend/` directory.
- The backend now serves the updated `workout-log.js` including the `/history` route added in 0.78/0.78.a.

### No code changes required
All backend logic (`workout-log.js`) and frontend logic (`LogWorkout.vue`) were already correct from 0.78 + 0.78.a. The sole fix was restarting the server process.

### Empty state behaviour (confirmed working)
- Empty results → no error banner; shows "No completed workouts found for **username** started on **date**."
- Real server errors (non-2xx) → red error banner with the actual server message.
- Console errors logged via `console.error` for debuggability.

## [0.78.a] — Workout History Load Fix

Fixes a 500 error that prevented the Workout History tab from loading any data.

### Root Cause
The `GET /api/workout-log/history` SQL query referenced `wls.workout_day_name`, a column that **does not exist** in the `workout_log_sessions` table. This caused MySQL to throw an error on every history request, returning a 500 response which the frontend caught as a generic "Unable to load workout history." banner.

### Backend Fix — `backend/api/workout-log.js`
- Removed `wls.workout_day_name AS workoutDayName` from the `/history` SELECT (column does not exist in `workout_log_sessions`).
- The session's day label is now sourced from `wl.source_schedule_group_label` (already present in the query as `scheduleGroup`), which is set at log-write time and correctly identifies the schedule group/day the workout was performed under.
- Updated session-map building to use `ex.scheduleGroup` as `workoutDayName`.

### Frontend Fix — `Member/LogWorkout.vue`
- Improved `loadWorkoutHistory` error handling: when the server returns a non-OK response, the actual server error message is read from the JSON body and surfaced to the user rather than a generic fallback.
- `catch` block now logs the real error to the browser console (`console.error`) for easier future debugging.

## [0.78] — Workout History Tab (Per-Set Detail, Sessions View)

Version 0.78 completely rebuilds the Workout History tab on the `/workouts` page, replacing the old flat exercise list with a sessions-based, per-set detail view filtered by the date the workout was **started**.

### What Changed

#### Backend — `GET /api/workout-log/history`
- Rewrote the route to return a `sessions[]` array instead of a flat `records[]` array.
- Filters completed sessions using `wl.WorkoutDate = ?` (the started date) and `wls.status = 'completed'`.
- JOINs `workout_log_sessions`, `workout_schedules`, and `exercises` to enrich each row.
- Runs a second query to fetch all `workout_log_sets` rows for the returned log IDs, grouped per exercise.
- Each session includes: `sessionId`, `workoutDate`, `workoutDayName`, `sessionStartedAt`, `sessionCompletedAt`, `planName`, and `exercises[]`.
- Each exercise includes: `workoutLogId`, `exerciseName`, `exerciseImage`, `muscleGroup`, `equipment`, `workoutType`, aggregates (`totalSets`, `avgReps`, `avgWeight`, `totalDuration`, `calories`, `distance`, `speed`), and `sets[]`.
- Each set includes: `workoutLogId`, `setNumber`, `weight`, `reps`, `duration`, `completed`.
- Response shape: `{ date, username, sessions }`.

#### Frontend — `Member/LogWorkout.vue`
- **State**: Replaced `workoutHistoryRecords` / `isLoadingWorkoutHistory` with `historyWorkouts`, `historyLoading`, `historyError`, and `workoutHistoryUsername`.
- **Removed**: `historyGrouped` computed property (no longer needed — grouping is done server-side into sessions).
- **`loadWorkoutHistory`**: Updated to consume `data.sessions`; populates `historyWorkouts` and `workoutHistoryUsername`.
- **Date watcher**: Added `watch(selectedWorkoutDate)` to auto-reload history when the selected date changes while the history tab is active.
- **Template**: Replaced the old grouped flat-exercise display with:
  - Date context bar with a Refresh button.
  - Error banner (`historyError`).
  - Loading spinner / empty-state card.
  - Session cards (`wl-history-session`) each showing: session header (plan name, day name, started/completed timestamps) and a per-exercise grid with a per-set table (strength: Set / Weight / Reps / Done; cardio: Set / Duration / Done).
  - Cardio exercises additionally show aggregate stats (calories, distance, speed).
  - Exercises without set data fall back to legacy aggregate display.
- **CSS**: Added 20+ new scoped classes for the history session cards, exercise identity rows, tag pills, set tables, and cardio stat bars.

## [0.77.9.f3] — Workout Interaction Button Fixes

0.77.9.f3 restores all broken workout interaction buttons on the `/workouts` page after the setup/order fixes completed in 0.77.9.f2.

### Fixed
- Fixed all broken workout interaction buttons on `/workouts`
- Restored button click handlers after `0.77.9.f2` refactor
- Fixed missing/misaligned Vue `@click` event bindings on `<ExerciseSessionCard>` in `Member/LogWorkout.vue`
- Fixed missing handler functions that were silently never called due to a Vue 3 ternary-in-`v-on` compilation quirk
- Fixed parameter passing for `exerciseId`, `setIndex`, and related exercise/set identifiers
- Fixed exercise accordion interaction state updates
- Fixed workout action event execution flow
- Fixed collapsed exercise state synchronization
- Fixed exercise selection state management
- Fixed complete set state tracking
- Fixed complete exercise state tracking
- Fixed add/remove set interaction logic

**Root cause:** Event bindings on `<ExerciseSessionCard>` used a ternary-returning-a-function-reference pattern:
```vue
@select="isPreviewMode ? null : selectExercise"
```
In Vue 3's template compiler, a complex expression in `v-on` is compiled as an inline handler: `$event => (isPreviewMode ? null : selectExercise)`. This evaluates the ternary and *returns* the function reference (or `null`) but **never calls it**. Every click fired an event but the handler was never invoked — silently discarding all user interaction.

**Fixes in `LogWorkout.vue`:**
- Replaced all five broken ternary bindings on `<ExerciseSessionCard>` with direct function references:
  - `@select="selectExercise"`
  - `@add-set="addSet"`
  - `@remove-set="removeSet"`
  - `@update-set="updateSet"`
  - `@exercise-completed="onExerciseCompleted"`
- Added `if (isPreviewMode.value) return` guards at the top of each of the five handlers (`selectExercise`, `onExerciseCompleted`, `addSet`, `removeSet`, `updateSet`) so preview mode is still fully respected without needing the broken ternary pattern

### Working Features

#### Workout Controls
- **End Workout** button now works correctly
- **Complete Workout** button now works correctly

#### Exercise Controls
- **Select Exercise** button now opens the selected exercise accordion
- **Complete Exercise** button now:
  - Marks all sets for that exercise as completed
  - Collapses the exercise accordion
  - Auto-advances focus to the next incomplete exercise

#### Set Controls
- **Add Set** button now dynamically appends a new set row (copying values from the last set)
- **Remove Set** button now removes only the targeted set and re-numbers remaining sets
- **Complete Set** button now marks only that individual set as complete

#### Accordion Behavior
- Exercise Collapse/Expand buttons now function properly
- Workout day accordion state is preserved across interactions
- Single-open exercise behavior fully restored

### Stability Improvements
- Added `isPreviewMode` guards inside all mutating handlers to prevent any state writes during preview-only mode
- Prevented undefined function execution caused by the ternary-in-`v-on` pattern resolving to `null`
- Prevented broken state updates from crashing exercise/set interactions
- Reduced Vue runtime interaction errors during workout sessions

## [0.77.9.f2]
### Fixed
- **`Member/LogWorkout.vue`**: Resolved `ReferenceError: Cannot access 'dayExercises' before initialization` (crash at line 58) that caused the `/workouts` page to be blank.

**Root cause:** The `watch(() => dayExercises.value, ...)` call appeared in `<script setup>` *before* the `const dayExercises = computed(...)` declaration. In JavaScript `<script setup>`, `const` declarations are not hoisted — accessing them in a top-level expression before the declaration line is a Temporal Dead Zone (TDZ) violation.

**Fix in `LogWorkout.vue`:**
- Removed the premature `watch(() => dayExercises.value, ...)` block from its position at line 58 (before `dayExercises` existed)
- Moved it to immediately *after* the `const dayExercises = computed(...)` declaration, preserving identical behavior
- All 0.77.9 accordion features (workout day accordion, exercise accordion, Select Exercise, Complete Exercise, set marking) remain intact

## [0.77.9d]
### Fixed
- **`ExerciseSessionCard.vue`**: `cardio-table-wrap` div was left unclosed after 0.77.9c incorrectly removed its closing tag instead of the genuinely spurious extra div. Added the missing `</div>` to restore valid template structure and fix the Vite "Element is missing end tag" compile error that caused a blank page.

## [0.77.9c]
### Fixed
- **`ExerciseSessionCard.vue`**: Corrected indentation of `<div class="cardio-3col-table">` inside the cardio block. Attempted to remove a spurious extra closing `</div>` but removed the wrong one — introduced the `cardio-table-wrap` unclosed-div regression fixed in 0.77.9d.

## [0.77.9b]
### Fixed
- **Accordion default open state** — exercises were all collapsed when Day Details loaded

**Root cause:** `watch(sessionExercises, ...)` observed the raw full exercise list, not the day-filtered `dayExercises` computed. IDs found in the raw list may belong to a different day and never match the rendered cards. Additionally, stale `activeExerciseId` from a previous day was kept alive across day switches.

**Fixes in `LogWorkout.vue`:**
- Replaced `watch(sessionExercises)` with `watch(() => dayExercises.value)` (getter form) so the watcher correctly tracks the filtered, day-specific exercise list
- Added `watch(selectedDay)` that resets `activeExerciseId` to `null` on every day change, clearing any stale selection before the day-exercises watcher re-runs
- Extracted `openFirstIncomplete(exercises)` helper used by both the auto-open watcher and `onExerciseCompleted`
- `onExerciseCompleted` now searches for the next incomplete exercise across the **full remaining list** (wraps around), not just exercises after the current index
- Result: Day Details always auto-opens the first incomplete exercise on load, after Start Workout, after Preview, and after completing an exercise

## [0.77.9a]
### Fixed
- **Critical bug**: `@update-set`, `@remove-set`, `@add-set`, `@select`, `@exercise-completed` event bindings in `LogWorkout.vue` were using `handler($event)` syntax which only passes the **first** emitted argument
  - `updateSet(exerciseId, setIndex, field, value)` — `setIndex`, `field`, `value` were always `undefined`
  - `removeSet(exerciseId, setIndex)` — `setIndex` was always `undefined` (always removed set 0)
  - Changed all bindings from `handler($event)` → `handler` (function reference), which correctly forwards all emitted arguments
  - This fixes: Complete Exercise, Complete Set, Remove Set, Add Set, and accordion Select all now function correctly

## [0.77.9]
### Added
- **Exercise accordion in Day Details** — only one exercise is expanded at a time

#### `ExerciseSessionCard.vue`
- Added `isExpanded` prop (default `true` for backward compat)
- Added `select` emit — fired when header or "Select Exercise" button is clicked
- Added `exercise-completed` emit — fired after "Complete Exercise" button marks all sets done
- Header is now clickable (toggles accordion) with hover and active background states
- Added **Select Exercise / Collapse** button in header right (chevron + label)
- Added **sets completion summary** (`0 / 3`) in header, turns green when all sets done
- Added `completedSets`, `totalSets`, `allDone` computed properties
- All table rows + footer wrapped in `<div v-show="isExpanded" class="sec-body">` — hidden when collapsed
- Active card: blue border + `box-shadow` ring (`session-exercise-card--active`)
- Completed card: green border (`session-exercise-card--done`)
- Active header: light blue background (`sec-header--active`)

#### `LogWorkout.vue`
- Added `watch` import
- Added `activeExerciseId` ref — tracks which exercise is currently expanded
- `watch(sessionExercises)` — auto-opens first incomplete exercise when exercises load; preserves selection if still valid
- Added `selectExercise(id)` — toggle: clicking open exercise collapses it; clicking another opens it
- Added `onExerciseCompleted(id)` — collapses completed exercise, auto-opens next incomplete one; if all done, collapses all
- Passed `:is-expanded`, `@select`, `@exercise-completed` props/events to `ExerciseSessionCard`
- Preview mode: `select` / `exercise-completed` events are no-ops (same pattern as existing)

## [0.77.8]
### Changed
- `ExerciseSessionCard.vue` — unified all workout types to mobile-first 3-column table layout (Set | Info | Value)

#### Strength exercises
- Replaced wide flat row layout with vertical grouped 3-col table
- Rows per set: Weight (kg) → Reps → Action (Remove Set / Complete Set)
- Remove Set hidden when only 1 set exists
- Complete Set marks individual set done (green, centered in Value column)

#### Other exercises (WorkoutType = Other)
- New 3-col table layout: Duration (min) → Notes → Action row
- `duration` defaults to `0`, `notes` defaults to `''` if not present in set data (frontend-only, no backend change)
- Notes field is left-aligned text input (`.set-input--text`)

#### All workout types
- Replaced `v-if="!isCardio"` / `v-if="isCardio"` branching with computed `workoutType`
- `workoutType` normalises `exercise.WorkoutType || exercise.workoutType` to lowercase
  - `'cardio'` → cardio table
  - `'strength'` → strength table
  - `'other'` → other table
  - Unknown / missing → falls back to `isCardio` prop, then defaults to `'strength'`
- All three layouts share the same `.c3-*` CSS classes (no duplication)
- Footer row is shared: `[+ Add Set]` · `[X/Y sets completed]` · `[Complete Exercise]`
- Added `.set-input--text` for left-aligned text inputs (Notes field)
- Added `import { computed } from 'vue'` to script

## [0.77.7f]
### Changed
- Centered "Complete Set" button horizontally inside the Value column of the cardio set row
- UI polish pass: refined cardio workout table structure and action button alignment
- Improved responsive cardio set layout consistency
- Enhanced workout progression workflow clarity (Remove Set / Complete Set / Complete Exercise hierarchy)

## [0.77.7e]
### Changed
- Cardio exercise table: separated "Complete Set" (per-set) from "Complete Exercise" (entire exercise)
  - Renamed in-row button from "Complete Exercise" → "Complete Set" / "Set Done"
  - Button is slightly smaller (`0.77rem`, `4px 11px` padding) to reflect secondary scope
  - Left-aligned "Complete Set" button inside the Value column (`.c3-done-cell` → `flex-start`)
  - Added new "Complete Exercise" button to the bottom footer row (right side)
    - Marks all sets as done via local `completeExercise()` function
    - Larger, more prominent (`0.85rem`, `7px 16px` padding, box-shadow)
    - Shows dimmed `--done` state when all sets already complete
  - Footer row: `[+ Add Set]` · `[X/Y sets completed]` · `[Complete Exercise]` (space-between)
- Added `.c3-finish-btn` / `.c3-finish-btn--done` CSS classes for Complete Exercise button

## [0.77.7d]
### Changed
- Cardio "Completed Exercise" row restructured into a true action row
  - Moved "Remove Set" button into the Info column (replaces the old text label)
  - Centered "Complete Exercise" button in the Value column
  - Removed "Remove Set" from the right side of the Value cell
  - Layout: `[ Remove Set ]` (left) · `[ Complete Exercise ]` (center)
- Added `.c3-info-action` flex container for Info column in the done row

## [0.77.7c] - 2026-05-06

### Overview
Added a visible **Remove Set** button to each cardio set group so users can undo sets added with Add Set.

### Changed — Frontend (`ExerciseSessionCard.vue`)
- **Remove Set button**: Replaced the icon-only ✕ button (`remove-set-btn c3-rm-btn`) in the Completed Exercise row with a labeled **"Remove Set"** button:
  - Red outline style: transparent background, `#fca5a5` border, `#dc2626` text.
  - Hover: light red fill (`#fef2f2`), darker border (`#ef4444`).
  - Smaller than Complete Exercise (`0.75rem`, `4px 10px` padding) — doesn't overpower the green button.
  - Icon: `fa-minus` prefix.
- **Hide when single set**: Changed from `:disabled` to `v-if="exercise.sessionSets.length > 1"` — button is completely hidden when only one set exists, keeping the row clean.
- **Layout**: `.c3-done-cell` changed from `justify-content: center` → `justify-content: space-between` — Complete Exercise button sits on the left, Remove Set on the right.
- **Strength layout unaffected**: The `.remove-set-btn` CSS used by the strength table is unchanged.

### Not Changed
- Complete Exercise button behavior, color, or position (relative to its side of the row).
- All cardio fields, Add Set, backend, Workout History.

---

## [0.77.7b5] - 2026-05-06

### Overview
Centered the "Complete Exercise" button horizontally within the Value column of the cardio logging table.

### Changed — Frontend (`ExerciseSessionCard.vue`)
- Added `justify-content: center` to `.c3-done-cell` — the Complete Exercise button and Remove button are now centered within the Value column cell.
- Removed `margin-left: auto` from `.c3-rm-btn` (no longer needed; centering is handled by the flex container).

### Not Changed
- Button color, behavior, size, or padding.
- All other cardio rows, Strength layout, backend.

---

## [0.77.7b4] - 2026-05-06

### Overview
Full-width cardio table, rebalanced columns, gray completed row background, and a proper green **Complete Exercise** button replacing the small circle checkbox.

### Changed — Frontend (`ExerciseSessionCard.vue`)
- **Table full width**: Removed `max-width: 900px` from `.cardio-table-wrap`. The cardio table now stretches the full available width of the exercise card.
- **Column widths** rebalanced: `30% / 40% / 30%` → `20% / 40% / 40%`:
  - Set column: `20%` (narrower — just holds the set number)
  - Info column: `40%` (field label)
  - Value column: `40%` (wider — more room for inputs and the complete button)
- **Completed Exercise row** — light gray background (`#f9fafb`) with a `border-top` separator, turning `#f0fdf4` green when the set is done. No longer `background: none`.
- **Complete Exercise button** — replaced the small circle `done-toggle` checkbox with a full green button:
  - Default: green (`#16a34a`) — label "Complete Exercise" with circle icon.
  - Completed: dark green (`#166534`) — label changes to "Completed" with check icon.
  - Clicking toggles `done` state (same `update-set` emit, `!set.done`).
- **Removed `.done-toggle` CSS** — no longer used in the cardio layout (strength layout was never using it anyway; strength uses its own `.done-toggle` inside `.col-done` which is unaffected).
- **Remove button** (`c3-rm-btn`) — `flex-shrink: 0` added; `margin-left: auto` pushes it to the right edge of the done cell.
- **Mobile (≤ 600 px)**: Removed stale `.cardio-table-wrap` max-width override (no longer needed). Added `.c3-complete-btn` padding reduction for small screens.

### Not Changed
- Strength exercise layout — completely untouched.
- Cardio field data (`duration`, `caloriesBurned`, `distanceMiles`, `speedMph`, `done`).
- Backend, Add Set logic, Workout History tab.

---

## [0.77.7b3] - 2026-05-06

### Overview
Improved cardio logging table column balance. Replaced fixed pixel widths with proportional percentage columns to eliminate the disconnected Value column and excessive right-side whitespace.

### Changed — Frontend (`ExerciseSessionCard.vue`)
- **Column widths** changed from fixed pixels (`70px / 1fr / 260px`) to percentage-based (`30% / 40% / 30%`):
  - Set column: `30%`
  - Info column: `40%`
  - Value column: `30%`
- Added `width: 100%` to the shared `.c3-head` / `.c3-row` grid rule so columns always fill the container.
- **Row padding** tightened: `5px 12px` → `4px 12px` for denser, more readable rows.
- **Mobile (≤ 600 px)**: Removed the fixed-pixel column override — percentage columns are naturally responsive, so no breakpoint override is needed. Added slight padding reduction (`3px 10px`) instead.

### Not Changed
- Template structure, data fields, Strength layout, backend, Add Set logic.

---

## [0.77.7b2] - 2026-05-06

### Overview
Visual polish pass on the cardio logging table introduced in 0.77.7b. Addresses the sparse, stretched appearance by constraining the table width, fixing column proportions, and adding subtle set-group highlighting.

### Changed — Frontend (`ExerciseSessionCard.vue`)
- **Table max-width**: Wrapped the cardio table in a `.cardio-table-wrap` container capped at `900px`, left-aligned inside the exercise card. The card itself remains full width.
- **Column widths** updated from `40px / 1fr / 120px` → `70px / 1fr / 260px`:
  - Set column widened to `70px` for better number legibility.
  - Value column widened to `260px` — inputs now fill that column properly without overflow.
- **Value inputs**: `width: 100%; box-sizing: border-box` inside the Value column. Inputs no longer stretch across the entire card.
- **First-row tint per set**: The Duration row (first row of each set group) has a subtle blue `rgba(59,130,246,0.04)` tint — turns green when the set is completed — making set boundaries easy to scan.
- **Completed Exercise row**: Gets a `border-top` separator to visually distinguish it from the data rows above.
- **Mobile (≤ 600 px)**: `max-width` removed (table becomes full width); columns tighten to `44px / 1fr / 130px`; font sizes reduce slightly. No horizontal scrolling.
- **Removed stale `@media` block**: Deleted leftover class selectors from 0.77.7a (`cardio-head`, `cardio-row-primary`, etc.) that were no longer used.

### Not Changed
- Cardio field data (`duration`, `caloriesBurned`, `distanceMiles`, `speedMph`, `done`) — untouched.
- Strength exercise layout — untouched.
- Backend, Workout Builder, Overview tab, History tab, Preview mode.

---

## [0.77.7b] - 2026-05-06

### Overview
Replaced the complex multi-row/multi-column cardio layout from 0.77.7a with a simple, mobile-friendly **3-column Set / Info / Value** table.

### Changed — Frontend (`ExerciseSessionCard.vue`)
- Removed the wide two-row-per-set desktop layout and all associated cardio mobile breakpoint rules.
- New cardio table structure: **Set | Info | Value** — 3 columns, clean and responsive.
- Each cardio set renders as a grouped block of 5 rows:
  - `Set N` | Duration (min) | [input]
  - *(blank)* | Calories Burned | [input]
  - *(blank)* | Distance (Miles) | [input]
  - *(blank)* | Speed (Mph) | [input]
  - *(blank)* | Completed Exercise | [checkbox + remove button]
- Sets separated by a 2px border; rows within a set separated by a 1px hairline.
- Completed sets highlighted with a green `#f0fdf4` background tint on the full group.
- Inputs are full-width inside the Value column.
- Table has a border + border-radius container so it looks distinct from the strength table.
- Mobile (≤ 575 px): columns tighten slightly (`32px / 1fr / 90px`), font sizes reduce — no horizontal overflow.
- **Strength exercise layout is unchanged.**

### Not Changed
- `caloriesBurned`, `distanceMiles`, `speedMph`, `duration`, `done` field names (added in 0.77.7a) — preserved as-is.
- `LogWorkout.vue` set helpers — no changes needed.
- Backend, Workout Builder, Overview tab, History tab, Preview mode.

---

## [0.77.7a] - 2026-05-06

### Overview
Upgraded cardio exercise logging in the Workout Log Day Details tab to track four fields per set — Duration, Calories Burned, Distance, and Speed — displayed in a clean two-row desktop layout and a responsive mobile layout.

### Changed — Frontend (`ExerciseSessionCard.vue`)
- Replaced the single-row cardio set layout (Duration only) with a **two-row per set** structure:
  - **Row 1 (desktop)**: Set # | Duration (min) input | Done toggle | Remove button
  - **Row 2 (desktop)**: *(spacer)* | Calories Burned input | Distance (mi) input | Speed (mph) input — each with a label beneath
- Desktop header updated to match the new primary-row columns: Set | Duration (min) | Done.
- Row 2 extra fields (`caloriesBurned`, `distanceMiles`, `speedMph`) share the same set — no new set is created.
- Strength exercise layout is **unchanged**.

### Added — Responsive Mobile Layout (`ExerciseSessionCard.vue`)
- On screens ≤ 575 px, cardio sets render as a stacked 4-column row-per-field pattern:
  - **Row 1**: Set # | Duration input | Duration (min) label | Done toggle + Remove
  - **Row 2**: Set # | Calories input | Calories Burned label | *(blank)*
  - **Row 3**: Set # | Distance input | Distance (mi) label | *(blank)*
  - **Row 4**: Set # | Speed input | Speed (mph) label | *(blank)*
- Desktop header hidden on mobile; inline label shown below the Duration input instead.
- Inputs are full-width within their column; no horizontal overflow.

### Changed — Frontend (`LogWorkout.vue`)
- `buildInitialSets()` now initialises each cardio set with `caloriesBurned: 0`, `distanceMiles: 0`, `speedMph: 0` in addition to existing `duration`, `weight`, `reps`, `done` fields.
- `addSet()` carries forward `caloriesBurned`, `distanceMiles`, `speedMph` from the previous set (mirrors existing weight/reps/duration carry-forward behaviour).

### Not Changed
- Database schema (new fields are frontend-state only in this version).
- Workout History tab.
- Overview tab / Preview Workout.
- Workout Builder.

---

## [0.77.6] - 2026-05-05

### Overview
Replaced the date range picker in the Workout Log header with a single date input and added a third **Workout History** tab that displays completed workout records for the logged-in user on the selected date.

### Changed
- **Header date input**: Removed `DateRangePicker` component. Replaced with a single `<input type="date">` styled for the dark blue header (white border, transparent background, white text, dark calendar icon). Defaults to today's date. Used by both Overview context and Workout History lookup.
- `activeTab` now supports three values: `'overview'` | `'dayDetails'` | `'workoutHistory'`.

### Added — Frontend (`LogWorkout.vue`)
- `selectedWorkoutDate` ref (defaults to today, ISO `YYYY-MM-DD`).
- `workoutHistoryRecords`, `isLoadingWorkoutHistory`, `workoutHistoryUsername` refs.
- `historyGrouped` computed — groups history records by `planName + workoutDayName` for clean card display.
- `loadWorkoutHistory()` — fetches `GET /api/workout-log/history?date=...` on tab click or Refresh button.
- `openHistoryTab()` — switches tab and triggers load.
- **Workout History tab** button in tab bar (always enabled; loads on click).
- **Workout History tab panel**:
  - Date context bar showing selected date + Refresh button.
  - Loading state.
  - Empty state: *"No exercises recorded for {username} on {date}."*
  - History cards grouped by plan + day, each showing per-exercise rows with:
    - **Cardio**: Duration (min), Distance (mi), Calories (kcal)
    - **Strength**: Sets, Reps, Weight (lb)
    - Workout type badge per exercise row.
- CSS for `.wl-date-input`, `.wl-history-datebar`, `.wl-history-group`, `.wl-history-exercises`, `.wl-history-ex`.

### Added — Backend (`workout-log.js`)
- `GET /api/workout-log/history?date=YYYY-MM-DD`
  - Auth-guarded (session required).
  - Joins `workout_log` → `workout_log_sessions` (for plan name) → `exercises` (for exercise title).
  - Returns: `{ date, username, records: [...] }`.
  - `records` includes: `WorkoutLogID`, `WorkoutDate`, `WorkoutType`, `Sets`, `Reps`, `Weight`, `Duration`, `Calories`, `Distance`, `performed_at`, `workoutDayName` (from `source_schedule_group_label`), `planName` (from session `notes`), `exerciseName`.

---

## [0.77.5] - 2026-05-05

### Overview
Added a **Preview Workout** button to each day card in the Workout Log Overview tab.
Users can now inspect a day's exercises without accidentally creating a workout session.

### Added
- `isPreviewMode` ref — tracks whether Day Details is showing a live session or a read-only preview.
- `previewDay(dayName)` function — sets `selectedDay`, builds `sessionExercises` from the expanded plan, sets `isPreviewMode = true`, switches to Day Details tab. No API call, no session created.
- **Preview Workout** button (outline/secondary style) on each day card footer, alongside the existing Start Workout button.
- **Preview banner** in Day Details when `isPreviewMode` is true:
  - Amber/yellow banner: *"Preview only — start the workout to log sets."*
  - Inline **Start Workout** shortcut button inside the banner.
- **Preview badge** ("👁 Preview") shown in the Day Details sub-header next to the exercise count.
- Progress bar hidden in preview mode (no sets to track).
- Exercise list rendered with `opacity: 0.75; pointer-events: none` in preview mode — visible but non-interactive.
- Sticky bottom bar (End Workout / Complete Workout) hidden in preview mode.

### Changed
- Day card footer now shows two buttons when no session is in progress: **Preview** (outline blue) + **Start Workout** (solid blue). Resume Workout still appears when a session is active for that day.
- `startDayWorkout` now sets `isPreviewMode = false` on successful session start, exiting preview mode.
- `endWithoutSaving` now clears `isPreviewMode = false`.

---

## [0.77.4] - 2026-05-05

### Overview
Unified the Workout Log page into a single tabbed hub, replacing the confusing two-page flow
(Workout Log → separate plan page) with an all-in-one experience.

### Changed
- **`LogWorkout.vue`** fully rewritten as a self-contained workout session hub:
  - Added **Overview** and **Day Details** tab bar under the Workout Log header.
  - Removed navigation to `/workouts/:planId` (WorkoutDetail.vue) from the Start Workout flow.
  - Removed the separate plan page header (plan stats, Edit Plan, Back to Workouts hero).

### Added
- **Accordion plan selector (Overview tab)**:
  - All saved workout plans displayed as a modern vertical accordion list.
  - Clicking a plan expands it (collapse any other open plan); loads full plan detail from API on expand.
  - Expanded plan shows a blue border + "Selected" badge.
  - Each expanded plan shows day cards (Monday - Cardio, Tuesday - Chest And Biceps, etc.) with exercise count, estimated duration, workout type, and exercise preview list.
  - **Start Workout** button on each day card — starts the session and auto-switches to Day Details tab.
  - **Resume Workout** button shown if a session is already in progress for that day.
  - **Edit Plan** button on each accordion row — routes to Workout Builder for that plan.
- **Day Details tab (inline session logging)**:
  - Disabled/greyed out until a day is started.
  - Shows selected day name badge in tab label.
  - Displays day sub-header with exercise count + live progress bar (sets completed %).
  - Full `ExerciseSessionCard` exercise logging UI reused from WorkoutDetail.vue.
  - Sticky bottom bar: "X / Y sets done" · End Workout · Complete Workout.
- **Active session recovery**: On mount, if a session is already in progress, auto-expands the matching plan accordion and restores state.
- **Conflict handling**: Banner shown if user tries to start a new day while a session is in progress.
- **Success banner**: "✓ Workout complete!" shown after saving, then auto-returns to Overview.
- **Stats row** (Saved Plans / Avg Duration / Total Exercises) retained above the tab bar.
- **Workouts In Progress** button switches to Day Details tab if a session is active (no page navigation needed).

### User Flow (New)
```
Workout Log → Overview tab → click plan accordion → choose day card → Start Workout → Day Details tab
```
Replaces the old confusing flow:
```
Workout Log → saved plans page → separate /workouts/:planId page → Overview
```

---

## [0.77.3] - 2026-05-05

### Overview
Converted the Workout Builder page from a long scrollable stacked layout into a compact 3-tab wizard UI.
Eliminates excessive vertical whitespace and guides the user through a logical Plans → Details → Schedule Planner flow.

### Changed

**Frontend — WorkoutBuilder.vue**
- Added `builderTab` ref (`'plans'` | `'details'` | `'planner'`) to drive tab visibility.
- Added **tab bar** (`<nav class="builder-tabs">`) with three tabs, placed directly under the blue hero stats bar:
  - **Plans** — always accessible; shows My Workout Schedules list, Create Workout Plan, and Suggest with AI buttons.
  - **Details** — enabled only when a plan is selected/created; shows Workout Name and Workout Goals form.
  - **Schedule Planner** — enabled only after workout details have been saved; shows By Day/Week toggle, Add Day, day accordion cards, exercise blocks, and Add Exercise button.
- **Smart tab auto-switching**:
  - Opening/loading an existing plan → auto-switches to **Schedule Planner**.
  - Creating a new plan → auto-switches to **Details**.
  - Clearing a plan selection → returns to **Plans**.
- Removed collapsible accordion wrappers for Details and Schedule Planner (no longer needed — tabs replace them).
- Replaced bare `<template v-else>` wrappers with `<div v-else>` for full Vue 3 compatibility inside `v-show` sections.
- Added tab bar CSS: pill-style container, blue active state with box-shadow, disabled state for locked tabs.
- Existing functionality fully preserved: create/edit/delete/open plans, add/move/remove exercises, day management.

---

## [0.77.2] - 2026-05-05

### Overview
UI polish pass on the Workout Builder exercise add/edit form. Cardio and Strength exercise fields
now display contextually — only showing the fields relevant to each workout type, with standardized label formatting.

### Changed

**Frontend — WorkoutExerciseBlock.vue**

*Cardio exercises (WorkoutType = Cardio):*
- **Renamed** label: `Duration (min)` → `Targeted Time (Mins)`
- **Renamed** label: `Distance (miles)` → `Targeted Distance (Miles)`
- **Renamed** label: `Calories` → `Targeted Calories`
- **Removed** `Speed (mph)` field — hidden entirely for Cardio exercises.
- Cardio block split from the shared `isCardio || isOther` template into its own dedicated `v-if="isCardio"` block.

*Strength exercises (WorkoutType = Strength):*
- **Removed** `Rest (sec)` field — hidden entirely for Strength exercises.

*Other exercises (non-Strength, non-Cardio):*
- No changes — `isOther` block retains all original fields and labels.

**Frontend — `style.css` (global layout)**
- Reduced `.main-content` top padding: `92px 30px 70px` → `5px 30px 30px`.
- Eliminates excessive vertical whitespace above the blue page header across all pages (Dashboard, Workout Log, Workout Builder, Exercises, Nutrition).

### Fixed
- No empty spacing or layout gaps when fields are conditionally hidden in the exercise form.

---

## [0.77] - 2026-05-04

### Overview
Major Workout Log workflow upgrade. Replaced the single "Start Workout" screen with a two-tab
Overview + Day Details experience, backed by a real active-session tracking system in the database.

### Added

**Frontend — WorkoutDetail.vue (complete redesign)**
- Two-tab layout: **Overview** and **Day Details**.
- **Overview tab**: each workout day (e.g. Monday – Chest, Tuesday – Cardio) rendered as its own card showing:
  - Day name with calendar icon.
  - Exercise count, estimated duration, and workout type.
  - Summary list of all exercises in that day with sets × reps (or duration for cardio).
  - Individual **Start Workout** button per day card.
- **Day Details tab**:
  - Loads only the selected day's exercises.
  - Full set-by-set logging UI via `ExerciseSessionCard`.
  - Locked to the selected day until the session is ended or completed.
  - Tab is disabled in the tab bar until a day has been started.
- **Tab bar** with Overview / Day Details tabs; Day Details shows the active day name as a badge.
- **Active session badge** in the blue hero header showing day name and start time.
- **Conflict banner**: blocks starting a second day while one is already in progress, with a clear message.
- **Green highlight** border and "In Progress" chip on the active day card in Overview.
- **Resume Workout** button replaces Start Workout on the currently-active day card.
- **Sticky bottom bar** on Day Details with:
  - **End Workout** button — cancels the session and returns to Overview without saving.
  - **Complete Workout** button — saves all logged sets, marks session completed, shows success banner, returns to Overview.
- Progress bar and set counter on Day Details (completed sets / total sets).
- On mount: automatically checks for an in-progress session matching this plan and switches to Day Details tab if found.

**Frontend — LogWorkout.vue**
- `hasActiveWorkout` is now driven by a real API call (`GET /api/workout-sessions/active`) on mount — button is green only when a real session exists.
- `goToInProgress()` now navigates to the active session's workout plan in WorkoutDetail.
- `activeSessionData` ref caches the session for instant navigation without a second API call.

**Backend — `backend/api/workout-sessions.js` (new file)**
- `GET  /api/workout-sessions/active` — returns the current user's `in_progress` session from `workout_log_sessions`, or `null`.
- `POST /api/workout-sessions/start` — creates a new session row; returns **409 Conflict** with the existing session if the user already has one in progress.
- `POST /api/workout-sessions/complete/:id` — marks session `completed`, sets `completed_at`.
- `POST /api/workout-sessions/cancel/:id` — marks session `cancelled` (End Workout without saving).
- Registered in `backend/server.js` under `/api`.

### Changed

**Frontend — WorkoutDetail.vue**
- Removed the old single-screen "Start Workout → Save Progress" flow.
- Exercise logging UI moved into Day Details tab only — Overview never shows set inputs.
- Save/Complete now marks the `workout_log_sessions` row as completed in addition to saving log entries.

**Backend — server.js**
- Imported and registered `workout-sessions.js` route module.

### Database
- **`ALTER TABLE workout_log_sessions`** — added two columns to the existing table:
  - `workout_day_id` INT UNSIGNED NULL — optional FK to `workout_schedule_groups.id`.
  - `workout_day_name` VARCHAR(120) NOT NULL DEFAULT '' — human-readable day label (e.g. "Monday").
- No new tables created. All session tracking reuses the existing `workout_log_sessions` table.
- Migration script: `backend/migrations/001_workout_sessions.sql`.

---

## [0.8.0] - 2026-05-02 12:24 AM

### Added
- **Favorite Exercises tab** (`frontend/src/views/Member/exercises.vue`):
  - Added third tab to Exercises Database: Search Exercises | My Custom Exercises | Favorite Exercises.
  - Displays user-specific favorited exercises with loading, error, and empty states.
  - Reuses existing exercise card layout with heart icon buttons.
- **Select button on workout day cards** (`frontend/src/views/Member/WorkoutBuilder.vue`):
  - Added visible "Select/Selected" button to each workout day header.
  - Shows "Select" when day is not selected, "Selected" with blue styling when active.
  - Button order: [Select/Selected] [Edit] [Delete] [Accordion Arrow].
- **Exercise image resolution** (`frontend/src/views/Member/WorkoutBuilder.vue`):
  - Added `normalizeExerciseFolderName()` helper to convert exercise titles to folder names.
  - Added `resolveExerciseImage()` helper with 4-tier priority: ImageURL → ImageGallery[0] → `/assets/Excerises/${title}/0.jpg` → default fallback.
  - Updated `createBlock()` to preserve ImageURL, ImageGallery, and RecordingType fields from selected exercises.
- **Backend static serving for exercise images** (`backend/server.js`):
  - Added `app.use('/assets/Excerises', express.static(...))` route to serve exercise images from free-exercise-db-main/exercises.

### Changed
- **Workout Builder scheduled exercise image carry-over** (`frontend/src/views/Member/WorkoutBuilder.vue`):
  - Fixed scheduled exercises to preserve selected exercise image info instead of falling back to default.
  - Every added exercise now carries over ImageURL/ImageGallery into workout schedule item.
- **Favorite button styling** (`frontend/src/views/Member/exercises.vue`):
  - Changed from yellow outline (btn-outline-warning) to red solid (btn-danger).
  - Changed icon from star (★/☆) to heart (<i class="fa-solid fa-heart"></i>).
  - Changed button text from "Favorite"/"Favorited" to "Fav"/"Unfav".
- **Sidebar role-based menu visibility** (`frontend/src/components/MainSidebarComponent.vue`):
  - Fixed role normalization to check `localStorage.getItem('role')` as fallback.
  - Added `isAdmin`, `isTrainer`, `isUser` computed properties for consistent role checking.
  - Admin users now see Trainer menu and Administrator menu sections.
  - Trainer users now see Trainer menu section only.
  - Added debug logging: `console.log('Sidebar role debug:', { rawUser, normalizedRole, isAdmin, isTrainer, isUser })`.
- **Favorites tab UI/UX improvements** (`frontend/src/views/Member/exercises.vue`):
  - Added loading spinner state while fetching favorites.
  - Added error state with "Try Again" button if fetch fails.
  - Added empty state with heart icon when no favorites exist.
  - Improved data handling with multiple response format fallbacks.
  - Enhanced error logging for debugging.

### Fixed
- **Favorite API error handling** (`frontend/src/views/Member/exercises.vue`):
  - Added detailed console logging for favorite operations: `[Favorite] POST/DELETE ${url}`.
  - Added error response logging with status code and response text.
  - Improved error messages for better debugging.
- **Database foreign key constraint issue** (`backend/api/excerises.js`):
  - Removed `CONSTRAINT fk_ufe_exercise` foreign key from `user_favorite_exercises` table creation.
  - Fixed errno 150 "Foreign key constraint is incorrectly formed" error.
  - Table now creates successfully without foreign key constraint while maintaining indexes and unique constraints.
- **Missing closing div tag** (`frontend/src/views/Member/WorkoutBuilder.vue`):
  - Removed extra `</div>` tag that was causing rendering issues in Favorite Exercises section.

### Backend
- **Exercise favorites API** (`backend/api/excerises.js`):
  - `GET /api/exercises/favorites` - Returns user's favorited exercises (already existed).
  - `POST /api/exercises/:id/favorite` - Adds favorite for logged-in user (already existed).
  - `DELETE /api/exercises/:id/favorite` - Removes favorite for logged-in user (already existed).
  - `user_favorite_exercises` table with user_id, exercise_id, unique constraint, and indexes.

### Notes
- All changes maintain existing functionality - no redesigns or breaking changes to sidebar, dashboard, Workout Builder, or Nutrition sections.
- Exercise images now display correctly using the exercise database in `backend/free-exercise-db-main/exercises/`.

## [0.75.2] - 2026-04-23

### Changed
- **RBAC role-source enforcement for menu visibility** (`backend/api/auth.js`, `frontend/src/components/MainSidebarComponent.vue`):
  - Sidebar visibility now consistently follows the resolved session role from `user_roles`/`roles`.
  - Membership/profile tier fields (`membershipType`) remain in registration/profile flow but are not used for runtime menu permissions.

### Fixed
- **Role-based sidebar visibility regressions** (`frontend/src/components/MainSidebarComponent.vue`):
  - `member/user` now sees only Dashboard + standard links + Help Center.
  - `trainer` now sees Trainer section and does not see Administrator section.
  - `administrator/admin` continues to see all sections.
- **Incorrect role mappings in demo RBAC data** (`user_roles`, `roles`):
  - Removed unintended admin assignments from non-admin demo users that caused Administrator menu overexposure.

### Notes
- **Release version** updated to `0.75.2`.

## [0.75.1] - 2026-04-23

### Added
- **Demo operating mode** (`frontend/src/config/appConfig.js`, `frontend/.env`):
  - Added `VITE_OPERATING_MODE` environment variable (current value: `demo`).
  - Created `appConfig.js` helper exposing `operatingMode` and `isDemoMode` for use across components.
- **Demo login buttons** (`frontend/src/views/Guest/Login.vue`):
  - When `VITE_OPERATING_MODE=demo`, the login page displays role-specific demo buttons for **User**, **Trainer**, and **Admin**.
  - Demo login actions prefill credentials, enable Remember Me, and reuse the existing sign-in flow.
- **Step-based registration wizard** (`frontend/src/views/Guest/register.vue`):
  - Added a three-step onboarding flow: **Account Type** → **Subscription Type** → **Account Info + Terms**.
  - Replaced the account type dropdown with selectable cards for **User**, **Trainer**, and demo-only **Admin**.
  - Added smooth step transitions, inline validation, and draft persistence for all registration inputs.
- **Subscription type step** (`frontend/src/views/Guest/register.vue`, `backend/api/auth.js`):
  - Inserted a dedicated **Subscription Type** step between account type and account info.
  - Registration now loads active tiers for guest signup and saves the selected tier during account creation.
  - Added modern subscription carousel to registration wizard.
  - Improved onboarding flow with slider-based plan selection.
  - Added persistent subscription selection between steps.
- **Horizontal stepper navigation** (`frontend/src/views/Guest/register.vue`):
  - Added horizontal stepper navigation to the registration wizard.
  - Improved onboarding flow clarity and visual progress tracking with active, completed, and locked step states.
- **Modal Terms & Policy agreement** (`frontend/src/views/Guest/register.vue`):
  - Replaced route-based Terms navigation with an in-page modal popup.
  - Added scroll-to-bottom gating before agreement can be confirmed.
  - Agreeing in the modal automatically checks the registration consent box.

### Changed
- **Registration onboarding UX** (`frontend/src/views/Guest/register.vue`):
  - Improved onboarding flow and usability with a modern wizard layout.
  - Eliminated form data loss issues by keeping all state within the registration experience and preserving draft data.
  - Expanded the wizard to **Account Type** → **Subscription Type** → **Account Info** without changing the visual design system.
- **Release note consolidation**:
  - All active registration/auth updates in this cycle are now tracked under **v0.75.1**.
- **Backend registration route** (`backend/api/auth.js`):
  - `POST /api/register` now accepts and validates `membershipType` (`User`, `Trainer`, `Admin`; defaults to `User`).
  - Role slug, membership tier, and billing cycle are now derived from the selected type instead of always defaulting to admin.
- **Role-aware session payload + sidebar visibility** (`backend/api/auth.js`, `frontend/src/components/MainSidebarComponent.vue`):
  - Session responses now include normalized role metadata (`role`, `roleSlug`) derived from role mappings/profile fallback.
  - Sidebar sections are now filtered by role:
    - **Admin**: sees **Trainer** + **Administrator**
    - **Trainer**: sees **Trainer** only
    - **User**: sees neither **Trainer** nor **Administrator**
- **App version** bumped to `0.75.1`.

### Fixed
- **Role enforcement consistency** (`backend/api/admin.js`, `backend/middleware/requireAdmin.js`):
  - Admin API surface remains protected by server-side middleware checks against role mapping/profile/user fallbacks.
  - Session role metadata now aligns frontend visibility behavior with backend authorization decisions.

### Database
- `ALTER TABLE users ADD COLUMN membershipType VARCHAR(20) NOT NULL DEFAULT 'User';` required.



### Added
- **Exercises Database user views + favorites APIs** (`backend/api/excerises.js`):
  - Added authenticated exercise list views for:
    - all exercises
    - current user's exercises
    - current user's favorite exercises
  - Added favorite toggle endpoints:
    - `POST /api/exercises/:id/favorite`
    - `DELETE /api/exercises/:id/favorite`
- **Exercises schema migration** (`backend/sql/exercises_schema.sql`):
  - Added `exercises.CreatedByUserID` for ownership tracking.
  - Added `user_favorite_exercises` mapping table for per-user favorites.

### Changed
- **Exercise library UI filtering** (`frontend/src/views/Member/exercises.vue`):
  - Added view selector (`All Exercises`, `My Exercises`, `Favorite Exercises`).
  - Added inline favorite action per exercise row.
  - Updated exercise library fetch flow to use authenticated filtered endpoint.
- **Exercises page header + tabs** (`frontend/src/views/Member/exercises.vue`):
  - Updated page title to `Exercises Database`.
  - Removed top date selector from the exercises page header.
  - Renamed secondary tab label from `Log Exercise` to `My Custom Exercises`.
- **Sidebar navigation** (`frontend/src/components/sidebarMenu.js`):
  - Added `Exercises Database` link directly under `Workout Log`.
- **Dashboard visual refresh** (`frontend/src/views/Member/HomeDashboard.vue`, `frontend/src/components/fitness/FitnessMetricCard.vue`):
  - Applied modern light card/panel treatment with subtle borders (`#e5e7eb`), 12px radius, white surfaces, and soft elevation.
  - Added soft inner separators using light top/bottom separators and inset shadow accents.

### Fixed
- **Legacy exercise delete route compatibility** (`backend/api/excerises.js`):
  - Added missing `DELETE /api/delete-exercise/:id` endpoint used by existing exercises UI.
- **Exercise mutation session alignment** (`frontend/src/views/Member/exercises.vue`):
  - Added credentialed requests for add/edit/delete exercise actions to match session-based auth.
- **Exercises library empty-state regression** (`backend/api/excerises.js`):
  - Restored fallback JSON exercise loading for `/api/exercises` `view=all` when DB rows are empty or query fails, ensuring exercises always render.

## [0.7.0-beta] - 2026-04-20

### Added
- **Relational workout scheduling model** (`backend/sql/workout_schedule_schema.sql`, `backend/api/users.js`):
  - Added `workout_schedules`, `workout_schedule_groups`, and `workout_schedule_exercises` as the primary planner storage.
  - Added draft-first schedule creation so users can create/save schedule metadata before adding exercises.
- **Performed session data model** (`backend/sql/workout_schedule_schema.sql`, `backend/api/workout-log.js`):
  - Added `workout_log_sessions` and `workout_log_sets`.
  - Added source linkage fields on `workout_log` to connect performed history back to schedule templates.
- **Workout execution flow UI** (`frontend/src/views/Member/WorkoutDetail.vue`, `frontend/src/components/workout-session/ExerciseSessionCard.vue`):
  - Added workout session page with set-by-set tracking and progress save.

### Changed
- **Workout planner APIs migrated to relational backend** (`backend/api/users.js`):
  - Existing `/api/workout-planner` compatibility endpoints now read/write relational schedule data.
  - Added schedule CRUD endpoints for groups and exercises.
- **Workout Builder guided UX** (`frontend/src/views/Member/WorkoutBuilder.vue`, `frontend/src/components/workout-builder/WorkoutScheduleListItem.vue`):
  - Added “My Workout Schedules” section with create/select/edit/delete flow.
  - Added planner mode grouping by day/week with inline group management.
  - Replaced rename popup flow with inline input editing and `Save Day/Week` action.
- **Workout log cards and route flow** (`frontend/src/views/Member/LogWorkout.vue`, `frontend/src/components/workout-log/WorkoutCard.vue`, `frontend/src/router/routing.js`):
  - Added reusable workout cards and direct “Start Workout” route into session execution.
- **Exercise imagery handling** (`frontend/src/components/workout-builder/WorkoutExerciseBlock.vue`, `frontend/src/components/workout-log/WorkoutCard.vue`):
  - Added normalized API-relative image loading with lazy loading and fallback behavior.

### Fixed
- **Case-sensitive DB table mismatches** (`backend/api/excerises.js`, `backend/api/workout-log.js`):
  - Standardized exercise queries to use lowercase `exercises` table name to avoid production DB lookup failures.
- **Workout log endpoint ownership and session safety** (`backend/api/workout-log.js`, `frontend/src/views/Member/exercises.vue`):
  - Enforced authenticated user ownership on add/get/update/delete log endpoints.
  - Updated frontend log requests to include credentials for authenticated routes.

## [0.69.0] - 2026-04-16

### Added
- **Shared member-page layout system** (`style.css`, member views):
  - Added reusable page wrappers (`app-page-shell`, `app-page-canvas`, `app-inner-shell`) for consistent centering and max-width behavior.
  - Added shared inner content surface treatment (soft background, radius, subtle elevation) for a cleaner app canvas.
- **Sidebar visual system upgrade** (`MainSidebarComponent.vue`, `style.css`):
  - Added shared gradient treatment to sidebar section headers.
  - Added upgraded Help Center gradient card variant and improved focus/hover accessibility states.

### Changed
- **Header standardization across member pages** (`HomeDashboard.vue`, `WorkoutBuilder.vue`, `NutritionWorkspace.vue`, `UserSettings.vue`, `ViewProfile.vue`, `style.css`):
  - Unified top header treatment using `ff-page-header` + `app-header-gradient`.
  - Removed mixed legacy wrappers and aligned header visual language.
- **Inner width and rhythm normalization** (shared + page-level):
  - Standardized container width behavior across Dashboard, Workout Builder, Nutrition, Log Workout, Exercises, Settings, and View Profile.
  - Tightened vertical rhythm between page header, first content section, and stacked sections using shared spacing tokens.
- **Account Settings hierarchy polish** (`UserSettings.vue`):
  - Reduced secondary nav visual weight (typography/icon/background states) so primary navigation remains dominant.
- **View Profile full layout modernization** (`ViewProfile.vue`):
  - Rebuilt page into shared shell/canvas/card system.
  - Replaced legacy mixed panel/grid patterns with responsive two-column + stacked card structure.
  - Namespaced internal styles to avoid legacy CSS collisions and normalized typography hierarchy.
- **Dashboard widget card polish** (`FitnessMetricCard.vue`, `HomeDashboard.vue`):
  - Added very light border (`rgba(0,0,0,0.04)`), soft elevation, 14px radius, and standardized internal padding.
  - Improved title/value/subtext/trend typography hierarchy and icon treatment.
  - Added subtle hover lift effect and ensured consistent full-cell card alignment.

### Fixed
- **Nutrition active page consistency** (`NutritionWorkspace.vue`):
  - Corrected active page header structure to match the shared member-page header system.
- **Layout drift across key member routes**:
  - Removed remaining width/spacing inconsistencies introduced by mixed legacy wrappers.

## [0.68.6] - 2026-04-10

### Added
- **Admin Users delete flow with explicit confirmation** (`AdminUsers.vue`):
  - Added delete action button in the Users table.
  - Added delete action button inside Edit User modal.
  - Added confirmation dialog with clear actions:
    - **Yes, Delete** → proceeds with delete request.
    - **No** → cancels and returns to the previous UI state.
- **Admin Roles delete flow with system role protection** (`AdminRoles.vue`, `backend/api/admin.js`):
  - Added `DELETE /api/admin/roles/:id` backend endpoint.
  - Built-in system roles (`member`, `trainer`, `admin`) are fully protected — the backend rejects deletion with a `403` error.
  - Protected roles show a 🔒 lock icon in the Action column instead of a delete button.
  - Non-protected roles show a red trash delete button.
  - Confirmation dialog (Yes, Delete / No) shown before any role is deleted.
  - Deleting a role also removes all `user_roles` pivot assignments for that role.
- **Personalized dashboard greeting** (`HomeDashboard.vue`):
  - Added profile fetch on dashboard load.
  - Header now renders `Welcome back, {firstName}!` when available.
- **Trainer sidebar group** (`sidebarMenu.js`):
  - Added new **Trainer** menu section.
  - Moved **Chat with Trainer** from **Administrator** to **Trainer**.

### Changed
- **Settings profile data hydration** (`UserSettings.vue`, `backend/api/users.js`):
  - Settings page now pulls `firstName`, `lastName`, `username`, and email-like value from backend profile payload.
  - Username display is normalized to email local-part (text before `@`) on settings UI.
- **Role protection hardening for edit operations** (`backend/api/admin.js`, `AdminRoles.vue`):
  - Protected default roles (`member`, `trainer`, `admin`) can no longer be edited from UI.
  - Backend `PUT /api/admin/roles/:id` now rejects protected role edits with `403`.
- **Sidebar menu styling update** (`MainSidebarComponent.vue`, `sidebarMenu.js`, `UserSettings.vue`):
  - Replaced legacy `admin-black` style hook with `admin-light-gray`.
  - Updated sidebar link/text color treatment to light gray (`#797979`) in light theme.
- **Auth UI consistency pass** (`Login.vue`, `register.vue`, `ForgotPassword.vue`, `TermsPolicy.vue`):
  - Tightened spacing and input rhythm.
  - Unified card sizing, button sizing, icon sizing, and footer/link rows.
  - Improved visual consistency across all guest auth screens.
- **Log Workout tabs UX modernization** (`Member/exercises.vue`):
  - Replaced old tab header + triangle indicator with modern button tabs.
  - Added clear active-state underline (orange) and improved hover/active transitions.
  - Improved tab/content panel connection by removing spacing/border artifacts.
- **Search + filter panel redesign** (`Member/exercises.vue`):
  - Introduced unified `search-filter-card` layout with structured grid and aligned controls.
  - Grouped search, filters, and actions into one cohesive control panel.
- **Exercise results card redesign + responsive layout** (`Member/exercises.vue`):
  - Added `Exercise Results` header row with count summary.
  - Updated cards to cleaner image/content/action hierarchy.
  - Improved mobile behavior: stacked cards, readable spacing, full-width action buttons.

### Fixed
- **Schema compatibility for user email field** (`backend/api/users.js`):
  - Added backward-compatible fallback for environments where `users.Email` column does not exist.
  - `GET /api/user-profile-settings` now gracefully falls back to `username` without throwing SQL `ER_BAD_FIELD_ERROR`.
- **Exercises page tab parser/build errors** (`Member/exercises.vue`):
  - Removed malformed nested CSS from earlier tab refactor.
  - Resolved template/style mismatch that caused Vite Vue parser failures.
- **Auth container spacing source correction** (`_main-content.scss`):
  - Reduced inherited login bottom padding to remove excessive vertical whitespace.

## [0.68.5] - 2026-04-14

### Fixed
- **Mobile login now confirmed working** — session persistence fix from 0.68.3e is fully verified on iOS Safari and Android Chrome.

### Removed
- **Browser detection debug UI** (`Login.vue`):
  - Removed `import { detectBrowser }` and all browser detection refs (`DEBUG_BROWSER`, `browserInfo`, `safariDetected`).
  - Removed visible yellow Safari/browser warning box (`v-if="safariDetected"` alert).
  - Removed debug browser/version display line shown under the version number.
  - Removed temporary Safari note text below the version row.
  - Removed scoped CSS classes: `.safari-login-hint`, `.login-safari-temp-note`, `.login-debug-browser`.
  - `browserDetect.js` utility remains in `src/utils/` for potential future use but is no longer imported by any component.

## [0.68.3e] - 2026-04-10

### Added
- **Browser Detect debug utility** (`src/utils/browserDetect.js`):
  - New reusable `detectBrowser()` function that returns `{ name, version, platform, userAgent }`.
  - Detects browsers: Chrome, Safari, Firefox, Edge (incl. mobile variants: CriOS, FxiOS, Edg).
  - Detects platforms: iOS (iPhone/iPad/iPod), Android, Mac, Windows.
  - Uses `navigator.userAgent` for all detection; no third-party library dependency.
- **Browser debug display on login page** (`Login.vue`):
  - Imports `detectBrowser` and runs it at page load.
  - Adds `const DEBUG_BROWSER = true` flag — set to `false` (or tie to `import.meta.env.DEV`) to disable.
  - When `DEBUG_BROWSER` is `true`, shows a small monospace line under the version number:
    `🔍 Browser: Safari 17 (iOS)`
  - Styled as subtle small monospace text; does not affect layout.
  - Clearly marked `TEMP DEBUG` in comments for easy removal later.

### Changed
- **Login diagnostics UX refactor** (`Login.vue`):
  - Replaced large inline Safari diagnostics text block with a compact error/warning message.
  - Added **View Login Diagnostics** action that opens a scrollable modal dialog.
  - Modal now contains full diagnostics details (API base, HTTP status, server message, network message, troubleshooting notes).
  - Added in-modal **Copy Diagnostics** action and close controls.
  - Preserved page centering/spacing so login remains usable on desktop and mobile.

### Fixed
- **Stylesheet MIME error on `/login`**:
  - Fixed `rtlStyle` handling in `themeDirectionSetting.js` by removing the stylesheet `href` in LTR mode instead of assigning an empty string.
  - This prevents browsers from resolving an empty stylesheet URL to the current route (`/login`) and logging strict MIME parse errors.
  - Removed placeholder `href` values from dynamic stylesheet link tags in `frontend/index.html`.
- **Pre-auth 401 request spam on login page**:
  - `App.vue` now skips `loadUserThemeSettings()` on non-protected/public routes.
  - Protected shell components in `App.vue` were changed from `v-show` to `v-if`, preventing hidden component mount hooks from firing unauthenticated API calls on the login page.
  - Stops premature requests to protected endpoints such as `/api/user-profile-settings` and `/api/notifications/unread-count` before session authentication.
- **Cross-site session persistence diagnostics and classification**:
  - Login flow now differentiates credential failures (`401`) from post-login session persistence failures.
  - Added explicit diagnostics fields in frontend login diagnostics:
    - `loginSucceeded`
    - `sessionCookiePersisted`
    - `sessionVerificationPassed`
  - When login succeeds but follow-up `/api/session` fails due to missing cookie, UI now reports:
    - `Login succeeded, but the session cookie was not available for follow-up requests.`
  - Removed misleading fallback text that implied bad credentials for cookie/session isolation failures.

### Backend
- **Session middleware hardening for browser-test/Safari environments** (`backend/server.js`, `backend/api/auth.js`):
  - Added explicit `proxy: true` behavior when secure cookies are enabled behind Render proxy.
  - Kept production cookie policy aligned with cross-origin requirements (`secure: true`, `sameSite: 'none'`).
  - Added temporary debug logging (gated by `DEBUG=true`) for origin, session id, cookie presence, and login/session diagnostics.
  - Added `/api/session` diagnostics fields:
    - `loginSucceeded`
    - `sessionCookiePersisted`
    - `sessionVerificationPassed`
  - Updated `/api/session` note text to clearly call out cookie persistence/isolation failures common in Safari and cloud-browser environments.

### Added
- **Temporary backend connectivity tester on login page** (`Login.vue`):
  - Added compact debug panel gated by `SHOW_BACKEND_TEST` flag.
  - Added **Test Backend API** button that calls `${VITE_API_BASE}/api/debug/ping`.
  - Added **Check Session API** button that calls `${VITE_API_BASE}/api/session` with credentials.
  - Output box now shows request URL, HTTP status, success/failure, parsed response (or raw text), and network/timeout errors.
  - Output area is scrollable and compact to avoid layout takeover.
- **Temporary public diagnostics endpoint** (`backend/api/auth.js`):
  - Added `GET /api/debug/ping` (no auth required) returning safe, non-sensitive connectivity info:
    - `ok`, `message`, `service`, `timestamp`, `env`, `origin`.

## [0.68.3a] - 2026-04-10

### Fixed
- **Login 404 — wrong API endpoint for demo login**:
  - `tempLoginBypass` was calling `/api/tmp-login` which does not exist on the backend.
  - Changed to `/api/login` (the only login endpoint) so demo sign-in works correctly.
- **Login 404 — missing `VITE_API_BASE` at build time**:
  - No `.env.production` file existed; `API_BASE` resolved to an empty string, causing all API calls to hit the frontend server instead of the backend.
  - Created `frontend/.env.production` with `VITE_API_BASE=https://dev-asterisks-github.onrender.com` so the correct backend URL is baked into every production build.
- **Debug logging added before all API calls** (regular login and demo login):
  - `console.log` output shows `API_BASE` and full request URL in browser devtools to confirm routing.
- **Vite chunk size warning causing non-zero build exit code**:
  - Raised `build.chunkSizeWarningLimit` to 1500 kB in `vite.config.js` to suppress exit-1 from pre-existing large vendor chunks.

### Changed
- **Global UI scaling normalization** (`style.css`):
  - Added `html { font-size: 16px; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }` at the top of the stylesheet.
  - Added `body { font-size: 1rem; }` to anchor all `rem`-based sizing to a consistent 16 px baseline across all browsers.
  - Prevents Safari and other mobile browsers from auto-inflating text on narrow viewports.
- **Login card max-width constrained** (`Login.vue`):
  - Added `max-width: 480px; width: 100%;` to `.login-body` scoped styles so the login card no longer stretches to fill the full Bootstrap container on large screens.

## [0.68.3] - 2026-04-09

### Changed
- **Detailed page header gradient theming refactor** (main page banners only):
  - Added shared theme variable `--ff-page-header-gradient` in all primary color stylesheets:
    - `blue-color.css`
    - `orange-color.css`
    - `pink-color.css`
    - `purple-color.css`
    - `green-color.css`
    - `gold-color.css`
    - `eagle_green-color.css`
    - `deep_pink-color.css`
    - `tea_green-color.css`
    - `yellow_green-color.css`
  - Standardized shared page-header radius via `--ff-page-header-radius`.
  - Shared page-header styling now resolves from theme CSS variables, so initial page load reflects the active theme immediately.
  - Theme-color changes in layout settings now automatically update page-header gradients without per-page hardcoded colors.
- **Header consistency updates** across major member pages:
  - Dashboard
  - Exercises
  - Workouts (Log Workout)
  - Workout Builder
  - Nutrition
  - Settings
  - Other pages already using the shared top-banner pattern (`.ff-page-header`)
- **Settings header alignment**:
  - Preserved as the visual reference while now using the same shared theme-driven gradient variable architecture.
- **Header date picker input styling polish**:
  - Updated date-input typography inside page headers to match header UI scale and weight.
  - Improved date-input contrast, padding, and rounded-corner treatment while preserving existing layout/position.
  - Added responsive size tuning for mobile readability.
- **Nutrition header date control simplification**:
  - Removed duplicate top `Selected Date` label and bottom date text from Nutrition header.
  - Kept a single right-aligned date input control using the same simplified pattern as other main pages.
  - Preserved existing functionality and header layout.
- **Safari login failure diagnostics**:
  - Added Safari-targeted detailed error messaging on login failure.
  - Added explicit troubleshooting steps for Safari cookie/session restrictions.
  - Included API/status/network detail context in the on-screen error for faster debugging.
  - Added `Copy Login Diagnostics` action so full failure details can be copied and shared during testing.
  - Added always-visible Safari hint banner on login so users can confirm diagnostics support is active before testing.
  - Added temporary Safari text under login version clarifying that direct backend `/api/session` checks can report `loggedIn:false` due to cookie isolation.

- **Session endpoint diagnostics**:
  - `/api/session` now includes lightweight diagnostics (`hasSessionCookie` and a contextual note) when not authenticated.
  - Helps distinguish cookie transport issues from true auth/session failures.

### Database
- No schema changes in `0.68.3`.

### Files Updated
- `frontend/src/assets/css/style.css`
- `frontend/src/assets/css/blue-color.css`
- `frontend/src/assets/css/orange-color.css`
- `frontend/src/assets/css/pink-color.css`
- `frontend/src/assets/css/purple-color.css`
- `frontend/src/assets/css/green-color.css`
- `frontend/src/assets/css/gold-color.css`
- `frontend/src/assets/css/eagle_green-color.css`
- `frontend/src/assets/css/deep_pink-color.css`
- `frontend/src/assets/css/tea_green-color.css`
- `frontend/src/assets/css/yellow_green-color.css`
- `frontend/src/views/Member/UserSettings.vue`
- `frontend/src/views/Member/WorkoutBuilder.vue`
- `frontend/.env`
- `frontend/src/views/Guest/Login.vue`
- `frontend/public/changelog.txt`
- `Database Log file.txt`

---

## [0.68.2] - 2026-04-09

### Fixed
- **Mobile login/session reliability** improvements for Safari/Android/desktop by waiting for session readiness before route transition.
- **Admin authorization mismatch** resolved with robust role checking (role mappings + fallback profile role support).
- **Settings page loading blocker** resolved (startup preloader no longer persists unexpectedly).

### Changed
- **Password reset temp-login flow hardening**:
  - pending reset login now validates reset-code path consistently;
  - temporary reset code invalidated after successful temp-login handoff.
- **Terms/registration/login UX polish** and defensive flow handling retained.
- **Header/date UX refinements**:
  - Exercises top selected-date label removed while keeping date input control.
  - Nutrition selected-date labeling clarified.
- **Profile greeting copy format** updated to `Greetings, <username>`.
- **Settings header styling baseline** set to the target polished blue gradient used as the v0.68.3 reference.

### Database
- No schema changes in `0.68.2`.

---

## [0.68.1] - 2026-04-09

### Fixed
- **Front page infinite loading spinner** by auto-clearing startup preloader after initial render.

### Changed
- **Login page cleanup**:
  - Removed duplicate lower `Forgot Password?` link (kept the inline link beside `Remember Me`).
  - Removed login `Database status` panel from UI.
  - Reverted footer info sections to single-column stacked layout for better mobile readability.
- **Version bump**:
  - App version now set to `0.68.1` via `frontend/.env` (`VITE_APP_VERSION`).
  - Login fallback version updated to `0.68.1`.

### Database
- No schema changes in `0.68.1`.

### Files Updated
- `frontend/src/App.vue`
- `frontend/src/views/Guest/Login.vue`
- `frontend/.env`
- `frontend/public/changelog.txt`

---

## [0.68] - 2026-04-09

### Added
- **Remember Me session support** on login (`Remember Me` checkbox now extends session cookie lifespan up to 1 week).
- **User profile dropdown menu** in header profile icon with:
  - `Greetings <username>`
  - `View Settings` (routes to user settings)
  - `Logout`
- **Login app version display** (`Version: APP_VERSION`) with fallback to `0.68`.
- **Developer Change Log Notes** link on login page.
- New public changelog pages/files:
  - `frontend/public/changelog.html` (scrollable full-page viewer)
  - `frontend/public/changelog.txt` (text source)

### Changed
- **Theming persistence improvements**:
  - Right layout sidebar now supports saving advanced theme visibility per user.
  - Theme settings and display settings now stay in sync across localStorage and DB profile settings.
- **Profile settings merge logic** in backend now deep-merges nested settings to avoid overwriting sibling config objects.
- **Page header styling consistency updates** across member pages:
  - Account Settings header now uses themed gradient style.
  - Dashboard and Workouts header border/radius alignment updated.
  - Nutrition header date section labeling/alignment updated (`Selected date`).
- **Log Workout page layout alignment** improved to match header/body width consistency.

### Fixed
- Prevented nested user settings from being unintentionally replaced during partial settings saves.
- Improved consistency of theme sidebar hide behavior across startup and saved profile state.

### Database
- No schema changes in `0.68`.

### Files Updated
- `frontend/src/views/Guest/Login.vue`
- `frontend/src/components/HeaderComponent.vue`
- `frontend/src/components/RightSidebarComponent.vue`
- `frontend/src/views/Member/UserSettings.vue`
- `frontend/src/views/Member/HomeDashboard.vue`
- `frontend/src/views/Member/LogWorkout.vue`
- `frontend/src/views/Member/NutritionWorkspace.vue`
- `frontend/src/views/Member/exercises.vue`
- `frontend/public/changelog.html` (new)
- `frontend/public/changelog.txt` (new)
- `backend/api/auth.js`
- `backend/api/users.js`

---

## [0.6.7] - 2026-04-09

### Added
- **Forgot Password Flow** — Implemented password reset request and reset form in frontend (`Guest/ForgotPassword.vue`, `Guest/ResetPassword.vue`).
- Backend API endpoints for password reset email and token validation.
- Email templates for password reset notifications.
- New database fields for password reset tokens and expiry.
- User feedback for password reset success/failure.

### Changed
- Improved error handling and user messages across login/register/forgot password flows.
- Updated frontend and backend dependencies to latest minor versions.
- Minor UI/UX tweaks to guest authentication pages.

### Fixed
- Resolved issues with email delivery for password reset (SMTP config, error logging).
- Fixed edge case where expired tokens were not properly invalidated.

### Database
- Added `password_reset_token` and `password_reset_expires` columns to `users` table.

### Files Updated
- `frontend/src/views/Guest/ForgotPassword.vue`, `frontend/src/views/Guest/ResetPassword.vue`
- `backend/api/auth.js`, `backend/email/templates/resetPassword.html`
- `backend/models/user.js`, `backend/dbConfig.js`
- `frontend/package.json`, `backend/package.json`

---

All notable changes to **FlexFit** are documented in this file.

---

## [0.6.5] - 2026-04-01

### Changed
- **Environment refactor** — replaced all hardcoded `localhost` URLs and custom `RUN_PUBLIC` switch logic with a clean `.env` / `.env.local` split.
- `frontend/.env` now holds production/Render defaults (`VITE_API_BASE` = Render backend URL).
- `frontend/.env.local` holds local dev overrides (`VITE_API_BASE=http://localhost:5000`) — gitignored.
- `backend/.env` now holds production/Render defaults (`FRONTEND_URL`, `SESSION_COOKIE_SECURE=true`, `NODE_ENV=production`).
- `backend/.env.local` holds local dev overrides — gitignored.
- Created `frontend/src/config/env.js` — single shared `API_BASE` export used by all frontend files.
- Removed hardcoded `http://localhost:5000` from all frontend source files (13 files updated).
- Simplified `backend/server.js` — removed `RUN_PUBLIC`/`IS_RENDER` mode detection; server now uses `const PORT = process.env.PORT || 5000` for all environments.
- CORS allowlist driven purely by `FRONTEND_URL` + `CORS_ORIGINS` env vars.
- Session cookie security driven by `SESSION_COOKIE_SECURE` env var.
- `SESSION_SECRET` moved from hardcoded string to env var.
- `backend/dbConfig.js` updated to also load `.env.local` overrides.

### Files Updated
- `backend/server.js`, `backend/dbConfig.js`, `backend/.env`, `backend/.env.local` (new)
- `frontend/.env`, `frontend/.env.local` (new), `frontend/src/config/env.js` (new)
- `frontend/src/router/index.js`, `frontend/src/router/Session.js`
- `frontend/src/components/HeaderComponent.vue`, `frontend/src/components/exercises.vue`
- `frontend/src/views/Guest/Login.vue`, `frontend/src/views/Guest/register.vue`
- `frontend/src/views/Member/Logout.vue`, `frontend/src/views/Member/Notifications.vue`
- `frontend/src/views/Member/AdminUsers.vue`, `frontend/src/views/Member/AdminRoles.vue`
- `frontend/src/views/Member/AdminRoleTester.vue`, `frontend/src/views/Member/exercises.vue`
- `frontend/src/views/LogWorkout.vue`

---

## [0.6.4] - 2026-04-01

### Added
- **Render.com deployment** — full production deployment of frontend and backend.
- Backend binds to `process.env.PORT` (Render dynamic port assignment).
- Session cookies configured with `secure: true` and `sameSite: 'none'` for Render HTTPS.
- `trust proxy` enabled for Render's reverse proxy.
- `GET /api/db-status` endpoint for live database connectivity check.
- `DEBUG=true` mode exposes structured DB error info (`code`, `errno`, `host`, etc.) from `/api/db-status`.
- Temporary PHP DB connectivity test script (`backend/PHP/db_connect_test.php`).
- In-app database status indicator on the Login page (checking / connected / disconnected).

### Fixed
- Linux case-sensitive import errors blocking Render build:
  - `Exercises.vue` → `exercises.vue`
  - `widgets/` → `Widgets/`
  - `template/Product/` → `template/product/`
- `apexcharts` dependency bumped to `^5.10.4` to satisfy `vue3-apexcharts` peer dependency.
- Frontend router guard tightened — requires both `/api/session` and `/api/db-status` to pass before rendering protected routes.
- Root route `/` now redirects to `/login`; dashboard moved to `/dashboard`.
- Render SPA rewrite rule configured (`/*` → `/index.html` as Rewrite, not Redirect).

### Infrastructure
- Frontend static site: `https://flex-fit-lkzh.onrender.com`
- Backend web service: `https://dev-asterisks-github.onrender.com`
- DB host: `65.181.116.252` (Hosting.com/cPanel, remote access enabled for Render IPs)

---

## [0.6.3] - 2026-03-28

### Added
- **In-app notification system** — bell icon in header opens `/notifications` page.
- `frontend/src/views/Member/Notifications.vue` — full notifications page with filter (all/unread), mark as read, mark all read, refresh.
- `backend/api/notifications.js` — REST API: list, unread count, mark read, mark all read, create.
- `backend/sql/notifications_schema.sql` — `notifications` and `notification_preferences` tables.
- Unread badge on bell icon polls backend every 60 seconds.

---

## [0.6.2] - 2026-03-27

### Added
- Membership tiers (`membership_tiers` table).
- Role-based access system (`roles`, `user_roles` tables).
- User profiles (`user_profiles` table).
- User membership billing history (`user_memberships` table).
- Admin UI: Users management, Roles management, Role Tester pages.

---

## [0.6.1] - 2026-03-26

### Added
- Enhanced exercise browser with improved search filtering and category navigation.
- Nutrition macro tracking stabilized with improved Open Food Facts API reliability.
- Workout log history pagination and export functionality.
- Admin dashboard for managing members, exercises, and content.

### Improved
- Workout log UI refinements and data consistency fixes carried forward from 0.6.0-alpha.
- General stability and performance improvements across member-facing views.

---

## [0.6.0-alpha] - 2026-03-23

> ⚠️ **Alpha Release** — Active development. Features may be incomplete or subject to change.

### Added
- Branch `flexfit-0.5` promoted toward **0.6 Alpha** milestone.
- Continued integration of nutrition tracking improvements from prior cycles.
- Ongoing workout log UI refinements and data consistency fixes.

### In Progress
- Enhanced exercise browser and search filtering.
- Nutrition macro tracking and Open Food Facts API stability improvements.
- Workout log history pagination and export.
- Admin dashboard for managing members, exercises, and content.

---

## [0.3.9] - 2025-12-22

### Changed
- Updated `.gitignore` and environment config (`.env`) for cleaner repo hygiene.
- Refined Open Food Facts API integration (`main-api.js`).
- Updated `LogWorkout.vue`, `exercises.vue`, and `nutrition.vue` views with stability fixes.

---

## [0.3.9] - 2025-08-28

### Added
- Expanded Open Food Facts API module (`main-api.js`).
- Initial nutrition view (`nutrition.vue`) introduced to the member area.

---

## [0.3.8-a] - 2025-08-27

### Fixed
- Follow-up patch to 0.3.8 with additional stability corrections.

---

## [0.3.8] - 2025-08-27

### Improved
- General codebase cleanup and refinements following the 0.3.7 release.

---

## [0.3.7] - 2025-07-18

### Added
- **Workout Log Deletion** — Users can now delete recorded workout logs directly from the log table.
- **Per-Row Edit/Cancel** — Each workout log row now supports inline editing. A cancel button lets users revert changes without saving.

### Improved
- Improved vertical spacing and 100% width stacking for workout log rows for better readability on all screen sizes.
- Increased size for log action icons and buttons for improved accessibility and touch support.

### Fixed
- Fixed an issue where deleting a workout log did not correctly update the UI or backend state.
- Resolved missing/incorrect TypeScript configuration (`tsconfig.json` and Vue shims) that caused build errors.
- Addressed layout issues where workout log rows were too close together at full width.

### TypeScript & Build
- Fixed `tsconfig.json` and Vue shims to ensure smooth development and build processes.

### Other
- General code cleanup and improved state management for per-row editing.

---

## [0.3.7.5] - 2025-07-17

### Changed
- Incremental patch fixes ahead of the 0.3.7 release.

---

## [0.3.6] - 2025-07-13

### Improved
- Continued refinement of member-facing views and workout tracking flows.

---

## [0.3.5] - 2025-07-04

### Added
- Continued feature work on the `flexfit-0.5` development branch.

---

## [0.3.3] - 2025-06-04

### Added
- Workout log features and member view updates merged from the `flexfit-0.4` branch.

---

## [0.3.0] - 2025-05-28

### Added
- Full `0.3 Release` — merged backend and frontend branches into a stable baseline.
- Database schema finalized and seeded (`0.3 Release DB`).
- Core backend API structure: `auth.js`, `users.js`, `excerises.js`, `workout-log.js`.
- Open Food Facts API module scaffolded under `api/OpenFoodFactsAPI/`.
- Image upload component added (`Components/ImageUpload/ImageUpload.js`).

---

## [0.2.99] - 2025-05-22

### Changed
- Pre-release stabilization pass before the 0.3 milestone.

---

## [0.2.9] - 2025-03-22

### Added
- Early backend/frontend integration work.
- Initial Vue 3 + Vite frontend scaffolding with routing, stores (Pinia), and i18n support.
- Express/Node.js backend with JWT authentication, bcrypt password hashing, and MySQL via `db.js`.
- Basic member area views: exercises, workout log, nutrition (stubs).
- Role-based routing and layout system (`layouts.js`).
