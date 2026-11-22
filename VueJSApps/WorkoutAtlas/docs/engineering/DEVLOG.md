# WorkoutAtlas Engineering Development Log

This log records engineering activity concisely and links to detailed evidence.

## 2026-11-18 — DEVOPS-DOCS-001

- Objective: establish enterprise documentation architecture and AI operating model.
- Files changed: documentation and agent customization files under `docs/`, `.github/`, `.gitlab/`, `AGENTS.md`, and `README.md`.
- Source of truth preserved: existing `CHANGELOG.md` and `WORKOUTATLAS_BATCH_RESULTS.md`.
- Tests: Markdown link inventory and documentation diff validation; no application suite rerun required.
- Remaining risk: live 0.85.309 acceptance gates remain unresolved.
- User acceptance: pending.

## 2026-11-18 — WA-UI-TABLET-001

- Objective: repair Find Plans tablet overflow and action accessibility.
- Root cause: the marketplace table remained at its 720px minimum width while the viewport/card layout switched only at 768px, leaving 769–1024px compressed or internally scrollable.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`; `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`.
- Implementation: added a scoped 769–1024px card presentation reusing existing plan data and handlers; preserved the desktop table above 1024px and the existing ≤768px card presentation.
- Tests: focused node contract tests passed 6/6; Vite production build passed; live 320, 390, 768, 800, 820, 1024, and 1366px browser geometry verification passed without mutation.
- Remaining issue: live user acceptance remains pending. No database or plan mutations were performed.

## 2026-11-21 — 0.85.309a Top Save Button Alignment

- Objective: refine 0.85.309 top Back/Save alignment for Create and Edit Workout Plan modes.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`; `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`; canonical 0.85.309 and 0.85.309a release documentation.
- Implementation: shared full-width row, far-left Back, far-right Save, identical `32px` control height/min-height/line-height, retained Save green/white styling, and unchanged save handler/business logic.
- Tests: focused frontend contract suite passed `21/21`; Vite production build passed with `701` modules transformed and `dist` generated.
- Remaining issue: live desktop/tablet/mobile browser geometry and Create/Edit save workflows require user verification.
- User acceptance: pending.

## 2026-11-21 — 0.85.311 FIX Consolidated Recording Corrections

- Objective: consolidate and verify recording field ordering, layout, More/Less, tags, and labels.
- Files changed: shared recording utility/test plus WorkoutExerciseBlock.vue and ExerciseSessionCard.vue.
- Recording behavior: Recording Type exclusively controls field order; Workout Type independently controls badge/tag classification.
- Layout: LBS, horizontal left labels, exactly three fields per row, fourth-column compact More/Less, and second expanded field row.
- Tests: focused recording/builder suite passed `19/19`; diagnostics passed; Vite build passed `701` modules and generated `dist`.
- Remaining issue: live browser coverage across all surfaces/viewports and user acceptance remain pending.

## 2026-11-21 — 0.85.312 Bottom Add Day/Add Week Controls

- Objective: restore bottom Add Workout Day/Add Workout Week controls in Create/Edit Plan schedules.
- Root cause: bottom handler and state existed, but template rendering and eligibility conditions were missing.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`; `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`; canonical 0.85.312 changelog and release evidence.
- Implementation: controls render below the schedule list after at least one schedule and two exercises, remain outside collapsed accordions, reuse existing handler/validation, and append groups.
- Tests: focused contract suite passed `12/12`; diagnostics passed; Vite production build passed `701` modules and generated `dist`.
- Remaining issue: live browser interaction and responsive acceptance remains pending.
- User acceptance: pending.

## 2026-11-21 — 0.85.312 Recovery Checkpoint

- Verified consolidated source state for 0.85.309, 0.85.309a, 0.85.311 FIX, and 0.85.312.
- Automated recording/builder verification passed 19/19; touched diagnostics passed; Vite build passed 701 modules.
- Outstanding: live browser acceptance for Save, bottom schedule controls, recording layouts, and responsive surfaces.
- 0.85.313 reset to TODO; no implementation started.

## 2026-11-21 — 0.85.313 Baseline Verification

- Branch verification: FAIL. HEAD `0fbf3b293cc6fb6363cac2922894bfc098c81bed` is on local/remote-tracking branch `0.85.113`; the commit subject is `0.85.113.RESET`, not `0.85.113.RESET` as a checked-out branch name.
- Restored baseline verification: PASS. HEAD tree exactly matches BETA `df1f026d506c50456b477e0777a98bb55c2e1977`, the `0.85.312` recovery checkpoint; direct tree diff is empty.
- Working tree: clean and unstaged; no source or database mutations occurred.
- API: `backend/api/users.js` contains 4,768 lines and 37 route definitions.
- Assignment/storage: day/week assignments use `scheduleMode`, `dayGroups`, `weekGroups`, group-order arrays, and exercise `scheduleGroup`; MySQL persistence uses `workout_schedules`, `workout_schedule_groups`, and `workout_schedule_exercises` with replacement writes.
- Protect PlanID 5: preserved. No implementation or subsequent workflow starts until explicit approval.

## 2026-11-21 — 0.85.313 Stage 1/10 Verification

- Objective: verify branch, 0.85.312 baseline, `users.js` size/route count, and working tree; verification only.
- Results: branch `0.85.113.RESET` FAIL (checked out `0.85.113`; HEAD subject `0.85.113.RESET`); baseline 0.85.312 PASS (empty diff against BETA `df1f026d506c50456b477e0777a98bb55c2e1977`); `users.js` 4,768 lines and 37 routes; source tree clean.
- Correction: route category counts are 4/14/5/9/4/1 (= 37); earlier 9/13/5/10 breakdown was inaccurate.
- No application, database, or PlanID 5 change. Stage 2 awaits approval.

## 2026-11-21 — 0.85.313.a1 Default Week Initialization

- Objective: initialize Week 1 automatically for newly created workout plans without altering saved plans.
- Root cause: `createWorkoutPlan` explicitly reset both `dayGroups` and `weekGroups` to empty arrays; backend defaults (`Week 1`) never reached the new-draft frontend state.
- Change: `DEFAULT_NEW_PLAN_WEEK_NAME = 'Week 1'`; `createWorkoutPlan` seeds `weekGroups`, syncs week order entries, and calls `ensureAccordionSelectionForMode` for day and week. Day mode default and empty Day View are preserved.
- Files: `frontend/src/views/Member/WorkoutBuilder.vue`; `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`.
- Tests: contract suite `14/14`; Vite production build passed; `users.js` `37` routes, no diff.
- Safety: no backend, database, migration, PlanID 5, or package-version change. User acceptance pending.

## 2026-11-21 — 0.85.313.a2 Default Day Assignment (Stage 3/10) - SUPERSEDED by 0.85.313.a2.1

- Checkpoint: Stage 2 committed as `97397e075` and pushed to `origin/0.85.113` after staged-file, secret-pattern, and exclusion review.
- Objective: assign unassigned items to Week 1 on plan load without saving, duplicating, or altering valid assignments.
- Finding: the data model stores one `scheduleGroup` per exercise and has no day-to-week link; unassigned content is exercises with an empty `scheduleGroup` (backend falls back to the first group only on save).
- Change: new pure helper `frontend/src/utils/workoutDefaultWeekAssignment.mjs` applied in `hydratePlanner`; target is existing `Week 1`, else first week, else new `Week 1`; weeks de-duplicated case-insensitively, matching day label reused.
- Tests: helper `7/7`, builder contract `14/14`; Vite build passed (`702` modules); `users.js` `37` routes, no diff.
- Limitation: no live browser verification; default week appears as a day card in Day View when such exercises exist. User acceptance pending.

## 2026-11-21 — 0.85.313.a2.1 Correct Day Assignment

- Defect in a2: it assigned individual exercises to a week, which could surface a `Week 1` day card and relabel exercise groups.
- Fix: removed exercise-level helper (never committed). New pure module `frontend/src/utils/workoutDayWeekAssignment.mjs` keeps `{ day -> week }` in a `dayWeekAssignments` ref; `reconcileDayWeekAssignments` keeps valid entries, drops stale ones, defaults unassigned days to existing `Week 1` or first week, one entry per day (case-insensitive). Rename/duplicate carry assignments; reset clears them.
- Wiring: `hydratePlanner`, `createWorkoutPlan`, `resetPlannerDraft`, rename/duplicate handlers, and a `[dayGroups, weekGroups]` watcher. Mapping is not in `buildPlannerDirtyState` or the save payload; hydration has no fetch/save.
- Tests: new suite `11/11`, builder contract `14/14`; Vite build passed (`702` modules); `get_errors` clean; `users.js` `37` routes, no backend/package diff.
- Limitations: invisible in UI and not persisted (lost on reload); no live browser verification. User acceptance pending; backend persistence not begun.

## 2026-11-21 — 0.85.313.a3 Persist Day-to-Week Assignments

- Finding: `workout_schedules.settings_json` exists only in `backend/schema/workout_schedule_schema.sql`; no code or docs read or wrote it. It is therefore the existing mechanism by definition only, and its presence in the live DB is unverified.
- Backend: `backend/utils/workoutPlanSettings.js` (normalize, parse, merge, persist with an injected connection). `users.js`: require, `hasSettingsJson` schema-state flag (read-only `information_schema` clause), `normalizePlannerPayload` carries `settings`, `PUT /workout-planner` calls `persistDayWeekAssignments` after `replaceScheduleGroupsAndExercises` inside the transaction, `buildPlannerFromSchedule` returns `settings.dayWeekAssignments`. +23 lines; route table identical.
- Frontend: `readSavedDayWeekAssignments`, `buildDayWeekAssignmentsSettings`, `serializeDayWeekAssignments`; `hydratePlanner` restores then reconciles and seeds `Week 1` when a plan has no weeks; payload and dirty state include assignments. a1 contract test adjusted (hydrate may now reference the default week name once; total references 3).
- Tests: frontend `28/28`; backend `workout-plan-settings` `11/11` with an in-memory fixture; `node --check` clean; Vite build passed (`702` modules). `workout-plan-conversion-engine` and `featured-plan-public-access` fail locally only because `mysql2` is not installed.
- Limitations: no-op if the column is absent; the backend persists only the active mode's groups, so assignments to unsaved week names default on reload; global and clone paths not covered. User acceptance pending.

## 2026-11-21 — 0.85.313.a3.1 Database Verification

- Attempted read-only verification of `workout_schedules.settings_json`. `backend/dbConfig.js` reads `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_DATABASE` from `backend/.env`/`.env.local`: only `.env.example` exists, no `DB_*` or `MYSQL*` variables are set, `mysql2` is not installed, and no `mysql` CLI is on PATH. Stopped there; did not look for or use any other credentials.
- Searched the repository for `settings_json`: the schema SQL and the `0.76`/`0.83` database backups. The backups define a nullable `longtext utf8mb4_bin` column with `json_valid`; only the definition lines were read.
- Agent-side outcome: could not query the database directly. Read-only `information_schema.COLUMNS` query provided for the user (also in `docs/database/SCHEMA.md`). No code, schema, data, or package change. STOP.
- Follow-up: user ran it in phpMyAdmin and got zero rows, but the screenshot showed `information_schema` as the selected database, so `DATABASE()` was `information_schema`. First result was inconclusive. The re-run without `DATABASE()` returned 1 row: `stephenk_flexfit.workout_schedules.settings_json`, `longtext`, `IS_NULLABLE` `YES`, default `NULL`. VERIFIED (user-run, read-only).

## 2026-11-21 — 0.85.313.a3.2 Preserve Day and Week Groups

- Checkpoint first: a3/a3.1 committed and pushed (`1e8fa6818`).
- Root cause: `replaceScheduleGroupsAndExercises` deleted all groups and re-inserted only the active mode's set, so the other set vanished and IDs changed on every save. The frontend already sent both sets.
- Fix: `backend/utils/workoutPlanGroups.js` (`planGroupSync`, `syncScheduleGroups`) matches existing rows by family and lowercase label, updates in place, inserts new, deletes unmatched rows of a synced family. `normalizePlannerPayload` adds `groupSetsProvided`. Placeholder-only inactive sets are not written; custom `workout_log_display_order` preserved only under the existing flag.
- Tests: new `workout-plan-groups.test.js` (21): both modes, ID stability, reorder, removal isolation, collisions across families, unsent sets, placeholders, duplicates, `any` vs `day`, legacy schema, assignment week names, schedule scoping, PlanID 5 snapshot, source contract. Three first-run failures were fixtures that used the placeholder `Week 1` alone, which the rule intentionally skips; fixtures corrected. Frontend contract test added (`29/29`). Backend `11/11` (settings). Vite build passed.
- Not changed: downstream readers that count all groups; exercise ID regeneration; `PUT /workout-schedules/:id/groups`. User acceptance pending.

## 2026-11-21 — 0.85.313.a3.3 Schedule Group Filtering

- Inventory of readers of `workout_schedule_groups`: `workout-log.js` (`getWorkoutLogDayOrdering`, `PUT /day-order`, `POST /day-order/reset`), `dashboard.js` (`weeklyTarget`), `users.js` (global plan-list `group_agg`, add-exercise default group, loader and save paths), `workout-sessions.js` (day lookups by id or label), `auth.js` (clone on register).
- Design: week rows are containers; a plan's workout days follow its `schedule_mode` (same split as `buildPlannerFromSchedule`). `schedule_mode` is a base-schema column, so no schema probing is needed. Legacy Week View (`schedule_mode = 'week'`) keeps week groups so its behavior is unchanged.
- Change: `backend/utils/workoutScheduleGroupFilter.js` (`filterGroupsForScheduleMode`, `buildScheduleModeGroupFilterSql` with identifier-checked aliases). `workout-log.js` selects `schedule_mode` and `group_type` and filters in JS for both `GET` and `PUT /day-order`; `dashboard.js` joins `workout_schedules` and applies the predicate; `users.js` `group_agg` joins `workout_schedules group_ws` and applies it.
- Tests: `workout-schedule-group-filter.test.js` (24) loads the real `workout-log.js` and `dashboard.js` with stubbed express and an in-memory pool (module loader hook), translates the SQL predicate to JS and compares it with the helper, and snapshot-checks PlanID 5. `users.js` is covered by source contract only (`mysql2` missing). All first-run green; checked the dashboard test would not match unfiltered SQL.
- Left alone: add-exercise default group (`users.js`), `workout-sessions.js` lookups, `auth.js` clone, `POST /day-order/reset`. Limitation: SQL never executed on real MySQL. User acceptance pending.

## 2026-11-21 — 0.85.313.a3.4 Global Plan Persistence

- Checkpoint first: a3.2/a3.3 committed and pushed as `20fefbfff`.
- Findings: `replaceScheduleGroupsAndExercises` is shared by five paths but only `PUT /workout-planner` persisted `dayWeekAssignments`. The global editor creates a draft (`POST /admin/global-workout-plans`, only an `Any Day` group) and then saves through `PATCH .../schedule` with `plannerPayload`, which already includes `settings`; so one backend call covers create and edit. `buildPlannerFromSchedule` exposes the source assignments, and `mapPlannerExercisesForAdoption` spreads `sourcePlanner`, so `settings` reaches the clone planner. The conversion template (`workoutPlanTemplate.js`) drops `settings`, so the source plan's `settings` is re-attached. `auth.js` copies group and exercise rows directly and never read `settings_json`.
- Change: `persistDayWeekAssignments(connection, <new id>, <planner>, { hasSettingsJson: schemaState.hasSettingsJson })` after the group/exercise save in the four `users.js` paths; `auth.js` reads the featured source `settings_json` (only if the column exists) and persists it for the new member's copy.
- Tests: `workout-plan-global-persistence.test.js` (11): table fixture for adopt/clone/edit, other-settings preservation, empty source, no-column no-op, statement scoping and no DDL, PlanID 5 snapshot, source contracts for the five paths and `auth.js`, 37 routes. The `workout-plan-settings` wiring count was updated from 1 to 5.
- Not changed: save semantics, routes, schema, UI. Limitation: not executed on real MySQL; integration suites needing `express`/`mysql2` cannot run locally. User acceptance pending.

## 2026-11-21 — 0.85.313.a4 Unified Schedule Planner (Stage 5/10)

- Checkpoint first: a3.4 diff reviewed (staged-file and secret pattern review clean, `.local-only/` and `.artifacts/` not in the commit), committed and pushed as `f34e9eab1`, live acceptance recorded as pending.
- Findings: the mode toggle in the planner section only called `changeScheduleMode`; `scheduleMode` is forced to `'day'` on hydrate, new plan and clear, and no other code sets it, so removing the toggle leaves the builder permanently in day mode. The save payload already sends both `dayGroups` and `weekGroups`, their orders and `settings.dayWeekAssignments`, so no save or load change was needed. `LogWorkout.vue` and `WorkoutDetail.vue` keep their own legacy `scheduleMode === 'week'` handling for saved plans and are untouched.
- Change: deleted the toggle markup (and its now-empty `planner-header-actions--schedule` wrapper) and `changeScheduleMode` in `WorkoutBuilder.vue`; left a short comment. CSS for `.planner-mode-*` left in place (inert; many responsive overrides, removal deferred).
- Tests: `WorkoutBuilder.unified-planner-contract.test.mjs` (8). First run had one failure: the day-card check used `class="workout-day-card"` but the class is bound as `:class="['workout-day-card', ...]"`; assertion corrected.
- Not changed: backend, schema, package, anything above Workout Plan Information, week dropdown and Rename Week (next stage). Limitation: no component mount or browser check. User acceptance pending.

## 2026-11-21 — 0.85.313.a5 Week Selection Dropdown (Stage 6/10)

- Checkpoint first: a4 reviewed (staged-file and secret pattern review clean), committed and pushed as `5ffa3132b`, browser acceptance recorded as pending.
- Design: `weekGroups` already always holds at least `Week 1` after load (hydrate defaults an empty set), so the dropdown is built straight from it. Display label and selection rule live in two pure helpers (`buildWeekOptions`, `resolveSelectedWeek`) so the stored name is never altered; the label only adds `(Default)` for the week named `Week 1` (case-insensitive). `selectedWeek` is a plain ref kept valid by a watcher on `weekGroups`; hydrate and reset set it explicitly so a previous plan's selection does not leak into the next plan.
- Deliberately kept out of the payload, `buildPlannerDirtyState` and the local draft, so switching weeks cannot mark the plan changed, be saved, or lose unsaved edits. The day cards loop (`accordionGroupsWithExercises`) is unchanged and does not read the selection.
- Tests: new `WorkoutBuilder.week-dropdown-contract.test.mjs` (7) and 4 util tests. The new test first sliced the SFC wrongly (this file has the script block before the template), so 4 assertions failed; slicing was corrected in the new test and in the a4 contract test (which had passed by accident). The a4 assertion that no week `<select>` exists was replaced by an Add Week / Rename Week-absent assertion.
- Not changed: backend, schema, package, anything above Workout Plan Information, Add Day / Add Exercise / bottom controls / Save, day filtering, Add Week, Rename Week. Limitation: no component mount or browser check. User acceptance pending.

## 2026-11-21 - 0.85.313.a6 Add Week (Stage 7/10)

- Checkpoint first: a5 reviewed (staged-file and secret pattern review clean), committed and pushed as `317087e56`, browser acceptance recorded as pending.
- Design: eligibility is a pure helper `weekHasDayWithExercise` that takes the selected week, the day list, the day-to-week assignments and the exercises, and uses the builder's own `countUniqueWorkoutPlanExercises` for counting, so it follows the same exercise rule as the rest of the planner. Assignment keys are read with an own-property check. Name generation is `buildNextWeekName`: smallest unused `Week N` from 2, case-insensitive (gap-filling, so Week 1 + Week 3 gives Week 2). `addWeek` only appends to `weekGroups`, syncs the week order and sets `selectedWeek`; it never touches assignments, days or exercises, so the new week is empty and unsaved edits survive.
- The dropdown is deliberately not tied to `canAddWeek`, so switching existing weeks stays available.
- Tests: new `WorkoutBuilder.add-week-contract.test.mjs` (8) and 6 util tests. The a4 and a5 contract tests asserted that no Add Week text exists; both were relaxed to assert Rename Week is absent only. The a4 test needed a second edit after the first replacement left the old regex in place; caught by the run.
- Not changed: backend, schema, package, anything above Workout Plan Information, Add Day / Add Exercise / bottom controls / Save, day filtering, Rename Week. Limitations: no component mount or browser check; no UI to assign days to weeks, so a new week stays empty; empty-week save not verified on a live DB. User acceptance pending.
