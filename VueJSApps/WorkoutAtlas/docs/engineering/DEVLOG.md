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

## 2026-11-21 - 0.85.313.a7 Rename Week (Stage 8/10)

- Checkpoint first: a6 reviewed (staged-file and secret pattern review clean), committed and pushed as `a222c3228`, browser acceptance recorded as pending.
- Finding: the brief says to reuse the Rename Day modal, but the builder has no such modal; Rename Day is an inline title editor (`startInlineDayNameEdit` / `saveInlineDayNameEdit`) validated by `validateWorkoutDayName`. Rename Week reuses that editor's CSS classes and the same validator (added an optional `noun` argument defaulting to the active label, so day behavior is unchanged and week messages say "week").
- Design: pure helper `renameWeekInPlan` (position kept, assignment values rewritten, own name and capitalisation-only change allowed, other-week duplicates rejected case-insensitively, inputs not mutated). The handler validates, calls it, then swaps in the new `weekGroups` and assignments, transfers the in-builder identity entry, re-syncs week orders and moves `selectedWeek` to the new name in the same tick so the selection watcher and assignment reconcile see a consistent state. Day cards, days and exercises are not touched (exercises are keyed by day, not week). The menu reuses the day kebab classes; the week wrapper keeps `day-kebab-wrap` for look, plus `planner-week-menu-wrap` so the document click handler can close it.
- Identity: checked the save path. `planGroupSync` in `backend/utils/workoutPlanGroups.js` matches existing rows by family plus case-insensitive label, so a renamed week is seen as a removed label plus a new label: the row is deleted and a new one inserted (new group id), and exercises are re-linked through `groupIdByKey` in the same save. A stable week id would need a payload and backend change, which this stage forbids, so this is reported as a limitation rather than worked around.
- Tests: new `WorkoutBuilder.rename-week-contract.test.mjs` (9) and 5 util tests. The a4/a5/a6 contract tests asserted Rename Week was absent; they now assert it exists only below the metadata form.
- Not changed: backend, schema, package, anything above Workout Plan Information, Add Day / Add Exercise / bottom controls / Save, day filtering. Limitations: no component mount or browser check; group-id change on a saved rename unverified on a live DB. User acceptance pending.

## 2026-11-21 - 0.85.313.a8 Week Filtering and Day Assignment (Stage 9/10)

- Checkpoint first: a7 reviewed (staged-file and secret pattern review clean), committed and pushed as `bf66ec03e`, browser acceptance recorded as pending and the persistent week ID limitation noted.
- Finding (blocker, not worked around): the model keys a day by its name alone. `dayGroups` is a case-insensitive unique list, exercises link by `scheduleGroup` = day name, assignments are `{normalizedDay: week}`, and `planGroupSync` matches rows by family plus case-insensitive label. Same-named days in two weeks would merge on load, in assignments and in the save. A safe fix needs a day id or week-qualified key in the payload and backend, which this stage forbids, so duplicates stay rejected globally; the message now names the week that holds the name so the filtered view does not make the rejection look like a bug.
- Design: `visibleDayGroups` filters the sorted `activeGroups` with `getDaysForWeek` (own-property lookup, default-week fallback, empty selection shows everything). Only the card list, expanded/selected day, move up/down, first/last, bottom controls and empty-state use it; `dayGroups`, assignments, exercises, the payload and the Preview stay whole. The new day is assigned in `addScheduleGroupFromValue` in the same tick as the day is added, before the reconcile watcher runs, so top and bottom Add Day share it. `moveDayAmongVisible` swaps with the visible neighbour so hidden days keep their positions.
- Dirty flag: `selectedScheduleGroup` is in the dirty snapshot, so the week-switch watcher only moves the expanded card (UI state) and leaves `selectedScheduleGroup` alone; a view change does not mark the plan dirty. `ensureAccordionSelectionForMode` now picks from visible days and is called again in hydrate after the week is resolved.
- a7 edge case fixed: changing the dropdown while the rename editor was open would have switched the selection on save; the editor is now cancelled on a selection change and the selection moves only if the renamed week was selected.
- Tests: new `WorkoutBuilder.week-filter-contract.test.mjs` (12) and 6 util tests. The a5 week-dropdown test (asserted nothing filters the cards or combines selectedWeek with assignment data) and the 0.85.312 bottom-controls test (asserted whole-plan counts) were updated to the new design; caught by the run.
- Not changed: backend, schema, package, anything above Workout Plan Information, the save payload, Add Week validation, Rename Week. Limitations: no component mount or browser check; identical-name blocker (resolved in a8.1); no UI moves a day between weeks. User acceptance pending. Committed and pushed as `a64c21cf0`.

## 2026-11-21 - 0.85.313.a8.1 Schedule Identity Correction

- Mapping first (read-only): the schema has no unique `(workout_schedule_id, label)` constraint, `workout_schedule_exercises.workout_schedule_group_id` links by id (`ON DELETE SET NULL`), and sessions resolve by `workout_day_id` before label. Conclusion: PROCEED, no migration needed.
- Design: DB group ids are the identity, labels are display. The save payload carries `dayGroupEntries` / `weekGroupEntries` (`{key, id, label, sortOrder}`), each exercise's `scheduleGroupKey` and assignments keyed by internal key. `planGroupSync` has an id-only path (rename keeps the row and id, new entries are inserted, missing ids deleted); the label path is unchanged for legacy payloads. Assignments are saved as `dayWeekAssignmentsById` plus the legacy label map (unique labels only), and legacy label-only saves drop a stale id map.
- Read side: `buildScheduleGroupView` (new `utils/workoutScheduleGroupView.js`) exposes unique compatibility names for repeated labels (first keeps the bare label, later `"<label> (<week>)"`, then `"<label> (n)"`) and the entries, so label-keyed readers and old clients behave as before. `auth.js` remaps the id map when a featured plan is copied; `workout-log.js` maps names back to labels.
- Frontend: internal key = name in `dayGroups` (unique plan-wide), real label in `dayLabelOverrides`, saved id as `dbId` on the identity entry. Add/Rename check duplicates per week; rename moves the identity entry and the override; the saved ids are adopted from the response (`matchSavedGroupIds`); drafts and the dirty state include overrides and ids.
- Tests: 10 new backend identity tests; four backend source-contract suites updated to the new code shapes; frontend a8 contract tests updated; 7 new builder contract tests and 6 new util tests. Full backend run shows 45 failures, all missing `express`/`mysql2` (no `node_modules`), not regressions.
- Not changed: schema, migrations, packages, the 37 `users.js` routes and their order, PlanID 5. Limitations: no browser or live DB check; `PUT /workout-schedules/:id/groups` and the conversion engine still use the label path; label-keyed readers see compatibility names. User acceptance pending. Committed and pushed as `fe82ef325`.

## 2026-11-21 - 0.85.313.a9 Final Regression and Acceptance (Stage 10/10)

- Scope: verification and logs only. a8.1 committed and pushed first (`fe82ef325`). No feature, speculative fix, schema, migration, package or deployment change.
- Test environment: the checkout had no `backend/node_modules`; `npm ci` restored them from the existing lockfile (package files unchanged). The default backend run then showed 13 failures, all `Missing database environment variables` thrown when the DB config module loads (no `backend/.env`), so they are environmental. Running the suite with throwaway in-process DB variables pointing at an unreachable address (no real DB, nothing written) gave 238/238 pass. Frontend 13 files / 140 tests pass; Vite build passed; `users.js` still has 37 routes in the same order.
- Audit: read the label-keyed paths. Planner save and read, adoption and featured clone insert fresh groups from entries (target schedule is empty, so source ids are never matched), registration copy remaps the id map, sessions resolve by `workout_day_id` first. Open items recorded, not fixed: the conversion engine drops entries (compatibility names become labels in the converted copy), `PUT /workout-schedules/:id/groups` deletes and re-inserts groups (no frontend caller), session label fallback. Index check against the repository schema and the 0.83 backup: only non-unique keys; live state unverified.
- Result: automated PASS; user acceptance pending.

## 2026-11-21 - 0.85.313 Merge into BETA

- Merge: `0.85.113` (HEAD `e7b6059e8`, "0.85.313 - Unified Multi-Week Schedule Planner - QA Checkpoint") merged into `BETA` with a true merge commit (`--no-ff`). The merge commit hash is the commit that contains this entry (see `git log --merges -1 BETA`). Rollback hash (BETA before merge): `df1f026d506c50456b477e0777a98bb55c2e1977` (0.85.312 recovery checkpoint).
- Conflicts resolved (10 files, nothing else changed): `WorkoutBuilder.vue` `showBottomScheduleGroupControls` keeps the 0.85.313 selected-week-aware logic (`visibleDayGroups` for the schedule check, exercises counted from the selected week's days). The 0.85.312 requirements remain in force within the selected week: the bottom Add Day control needs at least one visible schedule and at least two unique exercises. `WorkoutBuilder.preview-mobile-contract.test.mjs`: both the 0.85.312 and 0.85.313.a1/a3.2 tests retained, with added assertions that the exercise count derives from the visible day groups and that the control is gated by `showBottomScheduleGroupControls`. Eight documentation files: both histories kept (0.85.312 recovery entries and all 0.85.313 development entries); no entry removed.
- Note: the originally approved final regression commit `0d46d7703` was amended before push into `e7b6059e8` (identical tree; `git diff 0d46d7703 e7b6059e8` is empty).
- Verification (automated): frontend 13 test files, 140/140 pass; backend default run 178 tests (165 pass, 13 environmental failures: missing DB environment variables, none are code defects); backend with isolated throwaway in-process variables 238/238 pass; Vite production build passes; security gate `SECURITY_GATE_PASS`; all 37 `backend/api/users.js` routes present and in identical order to `0.85.113`, `BETA` before merge and baseline `bf66ec03e`.
- Safety: no database change, migration, package/version change, server restart or deployment; PlanID #5 untouched; all 13 Git stashes preserved; no force push or branch deletion.
- User acceptance: PENDING. Browser acceptance and the live-database index verification have not been performed. An automated pass is not user acceptance. Open audit items unchanged: conversion engine writes compatibility names as labels for repeated day names, dormant `PUT /workout-schedules/:id/groups`, session label fallback.

## 2026-11-24 - 0.85.cleanup Application and Legacy Template Inventory

- Objective: inventory and analyse the application and the inherited Digiboard template on a new isolated branch `0.85.cleanup` (base `6fdec96255110ce1588051bbf93afde2073a38b6`, verified `BETA` HEAD). Investigation only.
- Files changed (documentation only): `docs/engineering/APP-CLEANUP-INVENTORY.md` (new), `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`, `CURRENT-STATE.md`, `SESSION-HANDOFF.md`, this log, `docs/qa/QA-INDEX.md`, `docs/INDEX.md`, `docs/governance/DOCUMENTATION-INVENTORY.md`.
- Method: read-only static analysis (import graph, route table, dependency, CSS class, asset and API-caller scans). No source, CSS, dependency, database or API change; no build, test, server or browser run.
- Result: 14-section inventory; 113 non-test frontend files unreachable by static import; 56 template-component routes (39 with no live reference); live template couplings identified; runtime-loaded color stylesheet identified; unmounted `food-items.js`; licensing and debug-endpoint questions raised.
- Remaining risk: static analysis has false positives and negatives (dynamic imports, runtime-built URLs); all recommendations are pending user approval.
- User acceptance: pending. No commit or push was made.


## 2026-11-24 - 0.85.cleanup.1 Controlled Legacy Template Feature Removal

- Objective: owner-approved removal of standalone Digiboard demo features (chat, Calendar, CRM, HRM, e-commerce, email, invoices/contacts, file manager, authentication, pricing/subscription and UI demo pages) on branch `0.85.cleanup` (HEAD `6fdec962`). Owner decision: both profile pages, `/settings`, profile dropdown and right sidebar retained.
- Method: baseline (tests, build, users.js routes), import-graph ownership analysis, then five incremental groups with a static import/route check after each.
- Result: 44 routes removed; 161 files deleted (51 views, 110 exclusively owned template components); 4 files modified (`routing.js`, `sidebarMenu.js`, `HomeDashboard.vue`, `ProfileRightSidebarComponent.vue`). Exact lists in `APP-CLEANUP-INVENTORY.md`.
- Verification (actual): frontend tests 140/140; Vite build OK; backend tests 238/238; `users.js` unchanged; 13 stashes intact. No browser test run.
- Deferred: coming-soon/under-construction, unreferenced shared components/composables, `sidebarMenu-TEMPLATE.js`, other inventory candidates. Pre-existing issues left unrepaired: `/user-settings` and `/admin/role-tester` links in `HomeDashboard.vue`; `MainSidebarComponent.vue` missing import (unreachable file).
- User acceptance: PENDING. BETA integration: NOT AUTHORIZED. No commit or push was made.

## 2026-11-24 - 0.85.cleanup.1 ROLLBACK - FAILED ACCEPTANCE - ROLLBACK REQUESTED

- Trigger: owner reported the application no longer started; user acceptance FAILED; rollback authorised.
- Restored from `6fdec96255110ce1588051bbf93afde2073a38b6` into the working tree only (`git restore --source --worktree`, 165 explicit paths): 161 deleted files and 4 modified source files. `git diff 6fdec962 -- frontend backend` is empty. No reset --hard, clean, commit, push or merge; 13 stashes and BETA untouched; nothing staged.
- Environment: `backend/.env` (git-ignored) present and not touched by this task; `frontend/.env` absent; no `.env` backup in the workspace; no DB, NODE_ENV or SESSION variables at User/Machine level or in VS Code terminal env; no variable changed. No credentials printed or invented (the backend's own startup log printed the configured DB username once).
- Verification: `npm run dev` started both servers. Frontend (Vite 5173) serves the app; backend (5000) answers `/api/debug/ping` 200. The configured MySQL server rejects the connection (ER_ACCESS_DENIED_ERROR), so session store and DB-backed routes (503) fail. Root cause is in the DB credential or remote-access allowlist, not in source (source equals base). Dev servers stopped afterwards.
- Remaining blocker: owner must fix the DB access; no further cleanup authorised; BETA integration NOT AUTHORIZED. No commit or push was made.

## 2026-11-25 - 0.85.cleanup.1.a1 Batch 1 Template Removal (CRM, HRM, e-commerce)
- Objective: owner-authorised Batch 1 only, from the approved Phase 1 allowlist, on `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`). `.env*` files permanently protected; no environment variable changes; static verification only.
- Pre-checks: branch, HEAD, BETA and 13 stash SHAs matched the baseline; only documentation files were modified; all 67 allowlisted files tracked and present; zero retained dependencies across 1,196 src files.
- Changes: 67 files deleted individually (16 views, 51 components); 14 routes removed from `routing.js` (81 -> 67 paths; `/hrm-dashboard` kept); Taskboard (`/task`) link removed from `ProfileRightSidebarComponent.vue`. Exact lists in `APP-CLEANUP-INVENTORY.md`. Empty directories left in place.
- Static verification (actual): deleted set equals allowlist (67/67, nothing extra); only two non-doc files modified; zero backend, CSS/SCSS, package, lockfile, public, asset or env changes; all 14 routes gone and 30 protected or later-batch routes present; only unresolved import is the pre-existing one in `template/MainSidebarComponent.vue`. Not run: tests, builds, installs, servers, DB.
- Known leftovers (not Batch 1): `sidebarMenu-TEMPLATE.js` route-name strings (unreachable); literal in `template/menu/SidebarMenuComponent.vue`; `/add-product` link in Batch 4 component `ProductTableHeaderComponent.vue`; `/chat` and `/calendar` links until Batch 2.
- Skipped candidates: none. Blockers: none.
- User acceptance: PENDING. Batches 2-5 not started. BETA integration NOT AUTHORIZED. No commit, push or merge was made.

## 2026-11-25 - 0.85.cleanup.1.a2 Batch 1 navigation investigation (read-only)
- Trigger: owner reported numerous broken menu links after a1; Batch 1 acceptance not given at that point.
- Method: static comparison of baseline `6fdec962` and the working tree; route-table parse, import and path-string scans, tracing of every menu, bottom-nav, More-screen, profile, header and dashboard link. No tests, build, app start or `.env` access.
- Result: all live links resolved to registered routes and existing components; no retained file depended on a deleted file; the symptom was not reproduced. Only Batch 1 dangling reference: `/add-product` in the Batch 4 demo `ProductTableHeaderComponent.vue`. Pre-existing items noted (Help `href="#"`, dead `/user-settings` and `/admin/role-tester` strings, `/login-2`, missing `@/composable/sidebarMenu` import in an unreachable file). Unverified hypotheses: session-guard redirect during the DB credential blocker, stale dev server, runtime page errors. No source or documentation change was made; the owner then authorised Batch 2.

## 2026-11-25 - 0.85.cleanup.2 Batch 2 Template Removal (chat, calendar, email, invoices, contacts, file manager)
- Objective: owner-authorised Batch 2 only, on `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`). `.env*` files permanently protected; no environment variable changes; static verification only.
- Pre-checks: branch, HEAD, 13 stash SHAs and BETA matched; Batch 1 (67 deletions, 14 route removals) intact; only Batch 1 and documentation changes present. All 27 inventory files tracked and present; the six views were imported only by `routing.js`; no other retained importer or name reference.
- Changes: 27 files deleted individually (exact paths, no wildcards); 6 routes removed (67 -> 61 paths); `sidebarMenu.js` (Trainer section removed because both entries targeted removed routes; Administrator Scheduling and Chat removed); `ProfileRightSidebarComponent.vue` (Message link removed); `HomeDashboard.vue` (Chat/Scheduling role actions and `allMenuLinks` entries removed). Empty directories `template/email` and `template/modals` left in place.
- Static verification (actual): deleted set equals the inventory (27/27) and cumulative deletions equal Batch 1 + Batch 2 (94); six paths and names absent from retained source except unreachable `sidebarMenu-TEMPLATE.js`; only unresolved import is the pre-existing one; 18 protected routes confirmed present; `routing.js` and `sidebarMenu.js` pass `node --check` on Temp copies; zero backend, CSS/SCSS, package, lockfile or env changes. Not run: tests, builds, installs, servers, DB.
- Skipped: orphan `filemanager/FolderList.vue` (not in any approved batch; inventory has 27 files, 28 expected). No blockers.
- User acceptance: PENDING. Batch 3 not started. BETA integration NOT AUTHORIZED. No commit, push or merge was made.

## 2026-11-25 - 0.85.cleanup.3 Batch 3 Template Removal (unused authentication, pricing and email demonstration pages)
- Objective: owner-authorised Batch 3 only, on `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`). `.env*` files permanently protected; no environment variable changes; static verification only; no new temporary scripts created.
- Pre-checks: branch, HEAD, BETA and 13 stashes matched; 94 prior deletions and 61 route paths confirmed; nothing staged. All 19 inventory files tracked and present; 14 were imported only by `routing.js`, 5 (`Login.vue`, `Login-2.vue`, `Registration.vue`, `ResetPassword.vue`, `UpdatePassword.vue` under `template/pages/authentication`) had no importer; none used an API, store or composable. Each of the 14 routes pointed to a `views/template/pages/*` file; no route pointed to `views/Guest/*`.
- Changes: 19 files deleted individually (exact paths, no wildcards); 14 routes removed (61 -> 47 paths); `layouts/Guest.vue` `errorRoutes` lost the stale `'pricing_table'` entry. No navigation component referenced the 14 routes, so none was edited.
- Static verification (actual): 113 deletions = 94 + 19; 47 route paths; all 44 remaining route component imports resolve; zero retained references to the deleted files or the 14 paths and names except unreachable `sidebarMenu-TEMPLATE.js`; `views/Guest/*`, `Blank.vue`, guards and backend untouched; zero backend, CSS/SCSS, package, lockfile or env changes. Not run: tests, builds, installs, servers, DB.
- Skipped: `filemanager/FolderList.vue`; `ComingSoon`, `ComingSoon2`, `UnderConstruction` (not in Batch 3); orphaned images and styles. No blockers.
- Acceptance of Batches 1 and 2 not stated by the owner (both pending). User acceptance of Batch 3: PENDING. Batch 4 not started. BETA integration NOT AUTHORIZED. No commit, push or merge was made.

## 2026-11-25 - 0.85.cleanup.4 Batch 4 Template Removal (unused Digiboard UI demonstrations)
- Objective: owner-authorised Batch 4 only, on `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`). `.env*` files permanently protected; no environment variable changes; static verification only; no temporary scripts created; no composable, dependency, asset or CSS/SCSS deletion.
- Pre-checks: branch, HEAD, BETA and 13 stashes matched; 113 prior deletions and 47 route paths confirmed; nothing staged. All 54 inventory files tracked and present. The 10 views were imported only by `routing.js` (and the unreachable `sidebarMenu-TEMPLATE.js` strings); the 38 deletable components were imported only by the demo views or each other; no live navigation surface referenced the 10 routes. Demo views used no API.
- Protected: `PagePanelHeader.vue`, `TextEditorComponent.vue`, `datatable/DigiDataTable.vue`, `datatable/TableFilterOption.vue` and `form/DropzoneComponent.vue` (owner list) and `employee/TableFilterOption.vue` (name match, preserved conservatively) were kept; they are now unreferenced.
- Changes: 48 files deleted individually (exact paths, no wildcards); 10 routes removed (47 -> 37 paths). No navigation, layout or composable edited.
- Static verification (actual): 161 deletions = 113 + 48; 37 route paths; all remaining route component imports resolve; no retained references to deleted files or removed routes except unreachable `sidebarMenu-TEMPLATE.js`; only unresolved import is the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu`; zero backend, CSS/SCSS, package, lockfile, composable, asset or env changes. Frontend diff 166 files, 15,684 deleted lines, 1 added (Batch 4: 4,766 lines in deleted files plus `routing.js` -60). Not run: tests, builds, installs, servers, DB.
- Skipped: composables `nestableList.js` and `chartsDataManage.js`; `filemanager/FolderList.vue`; `HeaderCalculator.vue`; `sidebarMenu-TEMPLATE.js`; demo-only packages and assets. Resolved side effect: dangling `/add-product` link gone with `ProductTableHeaderComponent.vue`. No blockers.
- Acceptance of Batches 1, 2 and 3 not stated by the owner (all pending). User acceptance of Batch 4: PENDING. Batch 5 not started. BETA integration NOT AUTHORIZED. No commit, push or merge was made.

## 2026-11-25 - 0.85.cleanup Final Cleanup Commit and BETA Integration
- Objective: owner-authorised commit of the completed cleanup, merge into BETA, push of BETA and retirement of the local cleanup branch. `.env*` files protected; no environment variable changes; no tests, builds, startup or DB checks.
- Pre-checks: branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`; BETA = `origin/BETA` at the same commit after fetch (no divergence, no remote cleanup branch); 13 stashes, 165 deletions, 37 route paths and the a2/a3 repairs present; nothing staged; `AGENTS.md`, `CHANGE-CONTROL.md` and `RELEASE-PROCESS.md` read; repository security gate `scripts/security/security_check.ps1` to pass before push.
- Actions: individually staged tracked paths only (no `git add .`/`-A`); commit message `0.85.cleanup: Remove unused template modules and optimize navigation performance`; explicit merge commit into BETA; non-forced push of BETA only; non-forced local branch deletion after ancestry verification. Exact SHAs are in Git history and the owner report.
- Outstanding: full and authentication regression testing pending; no measured benchmark; Vue `parentNode` exception not conclusively resolved; breakpoint work deferred. Post-merge QA PENDING.

## 2026-11-25 - 0.85.cleanup.5.a3 Mobile and Tablet Navigation Performance Optimization
- Objective: owner-authorised, minimal static optimisation after feedback that the application works but is slow. `.env*` files permanently protected; no environment variable changes; static verification only; no temporary files.
- Pre-checks: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA, 13 stashes, 165 deletions and 37 route paths confirmed; nothing staged; a2 diffs present.
- Changes (7 files): `useAuth.js` pending-request sharing (500 ms, no caching) with epoch/sequence stale guards and invalidation at logout; `router/index.js` guard uses the shared request (server validation per protected navigation kept, rules unchanged); `primaryColorChangeSetting.js` idempotent writes; `App.vue` duplicate shell sync removed and click listener cleanup/early return; `layouts/App.vue` guarded `display` write; `HeaderComponent.vue` dead resize logic removed and shared session request; `HomeDashboard.vue` concurrent loading. `AppBottomNav.vue` and `MobileMoreScreen.vue` reviewed, unchanged.
- Static verification (actual): a2 diffs unchanged (`ProfileDropdown.vue` +51/-32, `AppBottomNav.vue` +2/-3); 37 route paths; CRLF kept in all 7 files; editor diagnostics clean; no backend, CSS/SCSS, package or env diff. Not run: tests, builds, installs, servers, DB. No timing measured.
- Unresolved: Vue `parentNode` exception (not claimed fixed). Deferred: other direct session fetches, sidebar session request per 768 px crossing, breakpoints, header offset, dead drawer CSS, AOS, nested overflow. Manual acceptance PENDING; final cleanup acceptance BLOCKED. No commit, push or merge was made.

## 2026-11-25 - 0.85.cleanup.5.a2 Mobile Navigation Performance Targeted Repair
- Objective: owner-authorised repair of two files after `0.85.cleanup.5` failed mobile/tablet acceptance and read-only investigation `0.85.cleanup.5.a1` completed. `.env*` files permanently protected; no environment variable changes; static verification only; no temporary files.
- Pre-checks: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA, 13 stashes, 165 deletions and 37 route paths confirmed; nothing staged.
- Changes: `ProfileDropdown.vue` (+51/-32) diagnostics gated behind opt-in `localStorage` key `wa:debug:profile-dropdown` = `1` (read once at setup; no environment configuration), early return in the outside-pointer handler, route-change handler and `closeDropdown` when closed, diagnostic watchers conditional, Help fallback log kept; `AppBottomNav.vue` (+2/-3) cyclic custom properties removed, `height` fallback `70px`.
- Static verification (actual): every remaining `/api/debug` and `console.log` site is inside a gated function except the Help fallback; listener registration/cleanup and menu handlers unchanged; route paths 37; no other source, backend, CSS/SCSS, package or env diff; editor diagnostics clean. Not run: tests, builds, installs, servers, DB.
- Unresolved: Vue `parentNode` exception (not claimed fixed). Deferred: session-request pattern, breakpoints, header offset, dead drawer CSS, AOS, nested overflow. Manual acceptance PENDING; final cleanup acceptance BLOCKED. No commit, push or merge was made.

## 2026-11-25 - 0.85.cleanup.5 Batch 5 Final Unused Template Composable Cleanup
- Objective: owner-authorised Batch 5 only (four named composables), on `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`). `.env*` files permanently protected; no environment variable changes; static verification only; no temporary scripts created.
- Pre-checks: branch, HEAD, BETA and 13 stashes matched; 161 prior deletions, 15 modified tracked files and 37 route paths confirmed; nothing staged. All four files tracked and present; listed in the original inventory (row T10). `finalBatches.json` held only Batches 1-4, so inventory membership was confirmed from the T10 row of `APP-CLEANUP-INVENTORY.md` and the owner's explicit list. No importer by path, relative path, glob or dynamic import; no use of any exported name in retained source; sweetalert use in retained code imports `sweetalert2` directly.
- Changes: 4 files deleted individually (exact paths, no wildcards; 1,786 lines). No other file edited; no route, navigation, component or composable edit.
- Static verification (actual): 165 deletions = 161 + 4; 37 route paths; one unresolved import in 142 scanned files (pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu`); zero retained references to the four files; all protected components present; zero backend, CSS/SCSS, package, lockfile, asset or env changes. Frontend diff 170 files, 17,470 deleted lines, 1 added. Not run: tests, builds, installs, servers, DB.
- Left: demo-only packages (`vue3-apexcharts`, `vuedraggable`, `swiper`), images formerly imported by `sweetalertManage.js` (`chat-bg*.png`), styles, `frontend/dist`. No blockers.
- Acceptance of Batches 1-4 not stated by the owner (all pending). Final cleanup acceptance: PENDING. BETA integration NOT AUTHORIZED. No commit, push or merge was made.

## 2026-11-25 - 0.85.316.1 Move Action Buttons into Section Headers
- Objective: relocate existing action buttons into section headers for View, Edit and Create Workout Plan; stop after relocation. .env* files protected; no environment variable changes; static verification only.
- Files changed: rontend/src/views/Member/WorkoutBuilder.vue (markup and scoped CSS only); canonical logs (CHANGELOG.md, WORKOUTATLAS_BATCH_RESULTS.md, CURRENT-STATE.md, SESSION-HANDOFF.md, DEVLOG.md, QA-INDEX.md, ACCEPTANCE-MATRIX.md, RELEASE-READINESS.md, VERSIONING.md).
- Implementation: Create/Edit Back to Plans + Save moved into the right of collapsible-header (Save far right), original rows removed; View preview Back to Plans + Use Plan moved beside the preview title via global-library-inline-preview__header (Use Plan far right), original top row removed; header wraps on narrow screens. Handlers, labels, icons, colors, permissions and validation unchanged.
- Tests: none run (not authorised). Diagnostics clean; CRLF kept.
- Remaining issue: owner manual acceptance at desktop, tablet and mobile widths PENDING. No commit, push or merge made.

## 2026-11-25 - 0.85.316.2 Workout Plan Information Two-Column Layout
- Objective: redesign Workout Plan Information into a responsive two-column layout for Create and Edit Workout Plan; stop after the layout. .env* files protected; no environment variable changes; static verification only.
- Owner acceptance recorded (owner-stated): 0.85.316.1 and 0.85.316.1.a1 accepted; header code untouched.
- Files changed: rontend/src/components/workout-builder/WorkoutMetadataForm.vue; rontend/src/views/Member/WorkoutBuilder.vue (cover panel CSS only); canonical logs (CHANGELOG.md, WORKOUTATLAS_BATCH_RESULTS.md, CURRENT-STATE.md, SESSION-HANDOFF.md, DEVLOG.md, QA-INDEX.md, ACCEPTANCE-MATRIX.md, RELEASE-READINESS.md, VERSIONING.md).
- Implementation: new plan-info-columns grid (1fr/2fr); plan-cover slot moved to the left column; Plan Information panel on the right with the existing field order and bindings; Objectives & Goals unchanged below. Cover image centered, aspect ratio kept (object-fit: contain, max 240px), Upload Image centered below; stacks at 768px and below (existing breakpoint).
- Static verification: Create and Edit share the component and slot; bindings and events unchanged; diagnostics clean; CRLF kept. Tests/build/server: not run.
- Remaining issue: owner manual acceptance at desktop, tablet and mobile widths PENDING. No commit, push or merge made.

## 2026-11-25 - 0.85.316.2.a1 Two-Column Layout Sub-Fix
- Objective: correct the rejected 0.85.316.2 layout (Cover Image and Plan Information stacked in the left ~33%). .env* files protected; no environment variable changes; static verification only.
- Failed acceptance recorded: owner rejected 0.85.316.2.
- Root cause: legacy @media (min-width: 769px) rule .metadata-section--plan-info, .metadata-section--goals { grid-column: 1; } in WorkoutMetadataForm.vue also matched the new right panel (same specificity, later in file), forcing it into column 1 / row 2 of the 1fr/2fr grid. Parent containers, .builder-grid, 768px overrides and Bootstrap (not used) were not at fault.
- Correction (rontend/src/components/workout-builder/WorkoutMetadataForm.vue, scoped CSS only): rule narrowed to .metadata-section--goals; explicit desktop placement cover = column 1 / row 1, information = column 2 / row 1; .plan-info-columns width: 100%; at 768px and below both panels reset to column 1 / auto row / 100% width.
- Static verification: diagnostics clean; CRLF kept. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING. 0.85.316.3 (accordions) not started. No commit, push or merge made.

## 2026-11-25 - 0.85.316.3 Workout Plan Information Vertical Accordions
- Objective: organize Workout Plan Information into four vertical accordions on Create and Edit, keeping the accepted two-column layout; stop after the accordion layout. .env* files protected; no environment variable changes; static verification only.
- Owner acceptance recorded (owner-stated): 0.85.316.2 and 0.85.316.2.a1 accepted.
- Files changed: rontend/src/components/workout-builder/WorkoutMetadataForm.vue; rontend/src/views/Member/WorkoutBuilder.vue (`metadataFormRef`, reveal calls in `persistWorkout` validation, compact mobile cover CSS); canonical logs.
- Structure: Plan Information (Plan Name, Plan Type) expanded; Goal (Goal Category, goal selector, Select Goal / + New Goal, target date, Goal Tags, conditional Objective/Goal) collapsed; Settings (Workout Type, Est. Session Time (Minutes), Plan Duration (Weeks)) collapsed; Description collapsed. Standalone Objectives & Goals section removed with no duplicated controls.
- Implementation: `v-show` bodies keep collapsed fields mounted, valued and validated; `revealField()` expands and focuses the owning accordion on Save/Publish validation failure; 35/65 label/input grid via scoped CSS (stacked labels only at 340px and below); white headings/labels; chevron via CSS borders; grid stretch for equal heights; stacked at 768px and below; compact cover on mobile.
- Static verification: four accordions in order; template tags balanced; single occurrence of each moved control; diagnostics clean; CRLF kept. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING. 0.85.316.4 and Schedule Planner redesign not started. No commit, push or merge made.

## 2026-11-25 - 0.85.316.3.a1 Accordion Header Styling Sub-Fix
- Objective: apply approved accordion header colors (collapsed #203252, expanded #24477E, white text and chevron) as a sub-fix of 0.85.316.3; stop after the colors. .env* files protected; no environment variable changes; static verification only.
- File changed: `frontend/src/components/workout-builder/WorkoutMetadataForm.vue` (scoped CSS only) plus canonical logs. `.plan-accordion__header` background set to #203252; `.plan-accordion--open > .plan-accordion__header` sets #24477E, so the color follows the existing open-state class automatically.
- Unchanged: header dimensions/spacing, bodies, label/input alignment, two-column layout, mobile rules, Cover Image, Schedule Planner, fields; no new icons, gradients or animations.
- Static verification: diagnostics clean; CRLF kept. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING. No commit, push or merge made.

## 2026-11-25 - 0.85.316.3.a2 Accordion Header Corners Sub-Fix
- Objective: remove rounded corners from the four accordion headers as a sub-fix of 0.85.316.3; stop after the corners. .env* files protected; no environment variable changes; static verification only.
- File changed: `frontend/src/components/workout-builder/WorkoutMetadataForm.vue` (scoped CSS only) plus canonical logs. `.plan-accordion__header` border-radius set to 0; redundant open-state bottom-radius overrides removed; `.plan-accordion` wrapper radius set to 0 so headers sit flush with no rounded gaps.
- Unchanged: header colors, white text/chevron, height/spacing, equal-height columns, accordion behavior, mobile rules, radii of all other controls.
- Static verification: diagnostics clean; CRLF kept. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING. No commit, push or merge made.

## 2026-11-25 - 0.85.316.3.a3 Accordion Header Border Radius Override Sub-Fix
- Objective: record the failed acceptance of 0.85.316.3.a2 (header buttons still pill-shaped) and correct the actual header buttons; stop after the correction. .env* files protected; no environment variable changes; static verification only.
- Root cause: `frontend/src/styles/design-system.css` (global import in `src/main.js`) sets `border-radius: 999px !important` on `button` (selector list with .btn, .tab, .nav-link, etc.), overriding the non-important scoped `border-radius: 0` from a2.
- Correction: `frontend/src/components/workout-builder/WorkoutMetadataForm.vue` scoped CSS adds `border-radius: 0 !important` for `.plan-accordion__header` (base, hover, focus, focus-visible, active) and `.plan-accordion--open > .plan-accordion__header`; higher specificity beats the global rule. Global button styling not modified.
- Unchanged: colors, white text/chevron, dimensions/spacing, equal-height columns, accordion behavior, mobile rules, other button/input radii.
- Static verification: diagnostics clean; CRLF kept; no visual confirmation. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING. No commit, push or merge made.

## 2026-11-25 - 0.85.316.3.a4 Single Accordion Expansion Sub-Fix
- Objective: allow only one Workout Plan Information accordion open at a time (Create and Edit); stop after single expansion. Owner-stated acceptance of 0.85.316.3.a3 recorded. .env* files protected; no environment variable changes; static verification only.
- Files changed: `frontend/src/components/workout-builder/WorkoutMetadataForm.vue` (script) and `frontend/src/views/Member/WorkoutBuilder.vue` (Publish validation reveal order only) plus canonical logs.
- Implementation: single `openAccordion` ref (`'info'` default, empty string = all collapsed) replaces four independent flags; `toggleAccordion` opens one and closes the previous or collapses the open one; `accordionOpen` is a computed view so the template is unchanged; `revealField` sets the single state; reveal order is now Plan Name, Category, Workout Type. Unused `reactive` import removed. No watchers, remounting, requests or animations; values retained via `v-show`.
- Unchanged: colors, square corners, white text/chevrons, dimensions/spacing, layout, mobile rules, cover image, fields, save logic, Schedule Planner.
- Static verification: source inspection; diagnostics clean; CRLF kept. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING. 0.85.316.4 not started. No commit, push or merge made.

## 2026-11-25 - 0.85.316.4 Schedule Planner Horizontal Week Navigation
- Objective: replace the Week dropdown with horizontal week tabs (max 4 visible, arrows above 4), reorder the planner header rows (title + Add Week + More; tabs; Add Day), and ensure the first Add Day creates the default Week 1; stop after this task. Owner-stated acceptance of 0.85.316.3.a4 (and 0.85.316.3 with its sub-fixes) recorded. .env* files protected; no environment variable changes; static verification only.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue` (template, script, scoped CSS); contract tests `WorkoutBuilder.week-dropdown-contract.test.mjs`, `WorkoutBuilder.add-week-contract.test.mjs`, `WorkoutBuilder.rename-week-contract.test.mjs`, `WorkoutBuilder.week-filter-contract.test.mjs` (strings only, not run); plus canonical logs.
- Implementation: `div.planner-week-tabs` with arrow buttons and a strip of `button.planner-week-tab` driven by `visibleWeekTabs` (window of 4 over `weekOptions`); `shiftWeekTabs` moves the window only; `selectWeekTab` sets the existing name-keyed `selectedWeek`; one watcher reveals the selected tab on load, Add Week and selection change; tab keys use `getScheduleGroupId`. `+ Add Week` and the More menu moved into `div.planner-week-header-actions` in the header row. `addScheduleGroupFromValue` creates and selects `Week 1` when `weekGroups` is empty (shared by top and bottom Add Day) and never adds a second default week. CSS: square corners via `border-radius: 0 !important` (global design-system button rule), 44px tabs, two-line label clamp, touch scroll without page overflow; dropdown CSS removed.
- Unchanged: Add Week gating, rename logic, persistence, week filtering, day cards, accordions, save/publish, backend, database, dependencies.
- Static verification: diagnostics clean; no leftover dropdown usage; CRLF kept. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING. 0.85.316.5 not started. No commit, push or merge made.

## 2026-11-25 - 0.85.317 Recording Type Correction for Saved Plan Exercises
- Objective: investigate and correct Cardio exercises (Marching in Place, Step Jacks (No Jumping), Standing Knee Raises) showing LBS / Reps / Sets as primary fields; stop after the confirmed frontend correction. .env* files protected; no environment variable changes; no backend or database changes; static verification only.
- Investigation: 0.85.311 logic (`frontend/src/utils/exerciseRecordingFields.js`) is intact; Workout Type is deliberately not used for field order (existing test). `createBlock` copies `RecordingType` from the catalog, so newly added exercises are correct when the catalog value is Time & Distance. Saved plan exercises carry no Recording Type: `backend/api/users.js` neither stores it nor selects `e.RecordingType`, so Edit/View blocks fall back to Sets & Reps. Preview and Log Workout have their own Workout Type fallbacks (not changed).
- Files changed: `frontend/src/utils/exerciseRecordingFields.js` (buildCatalogRecordingTypeMap, resolveExerciseRecordingType); `frontend/src/components/workout-builder/WorkoutExerciseBlock.vue` (optional recordingType prop used only when the exercise has none); `frontend/src/views/Member/WorkoutBuilder.vue` (catalog map computed, getExerciseRecordingType, :recording-type binding, preview uses the same resolver); `frontend/src/utils/exerciseRecordingFields.test.mjs` (two tests, not run); plus canonical logs.
- Behavior: explicit Recording Type wins; otherwise the loaded Exercise Database catalog value for the exerciseId; otherwise the existing Sets & Reps default. Nothing is written into plan data, so payload, dirty state and saved values are unchanged.
- Static verification: diagnostics clean; CRLF kept. Tests/build/server/browser: not run.
- Remaining: catalog RecordingType of the three exercises unverified (no database access; database not modified); backend persistence of Recording Type is an unapproved alternative; owner manual acceptance PENDING. No commit, push or merge made.

## 2026-11-25 - 0.85.318 Add Day Button Color
- Objective: change the background of both Schedule Planner Add Day buttons (top and bottom) to #2563EB with white text and icon; cosmetic only; stop after the change. .env* files protected; no environment variable changes; no backend, database or infrastructure changes; static verification only.
- Investigation: both buttons carry `planner-group-add`; the top also `wa-blue-action-btn`, the bottom `planner-group-add--bottom wa-green-action-btn`. A late green block (`.workout-builder-page .planner-group-add`, with hover/focus rules at specificity 0,4,0) set the effective green background for both, so the change is a later, higher-specificity block rather than edits to the earlier rules. Media queries only set size, padding and grid column.
- File changed: `frontend/src/views/Member/WorkoutBuilder.vue` (one appended scoped CSS block `.workout-builder-page button.planner-group-add`: #2563EB background and border, white text; hover/focus/active #1D4ED8; blue focus-visible ring). Not changed: `.btn-add-exercise-day` (green), `.planner-week-add`, shape, size, alignment, disabled behavior, markup, script.
- Static verification: diagnostics clean; CRLF kept. Tests/build/server/browser: not run; not visually verified.
- Remaining: owner manual acceptance PENDING. No commit, push or merge made.

## 2026-11-25 - 0.85.320 Official 0.85 Release Closeout
- Objective: record the owner declaration that the 0.85 milestone is complete (COMPLETE - OWNER ACCEPTED), the 8 of 8 published Global Workout Plans, the 0.85 accomplishment summary, and the 0.86 next milestone (0.87 iPhone, 0.88 Android after it); then commit and push after the repository security gate. .env* files protected; no environment variable changes; no backend, database, infrastructure, dependency or application functionality changes; no tests, builds or startup.
- Files changed (documentation): CHANGELOG.md, WORKOUTATLAS_BATCH_RESULTS.md, docs/engineering/{CURRENT-STATE,SESSION-HANDOFF,DEVLOG,VERSIONING}.md, docs/qa/{QA-INDEX,ACCEPTANCE-MATRIX}.md, docs/releases/RELEASE-READINESS.md, docs/backlog/{ROADMAP,BACKLOG}.md, docs/product/CONTENT-INVENTORY.md.
- Handling: historical records preserved; per-task statuses (including 0.85.316.4, 0.85.317, 0.85.318 pending-acceptance rows) not rewritten; WA-QA-* and WA-UI-TABLET-001 not marked passed; WA-CONTENT-001, -002 and -004 closed by owner statement; WA-CONTENT-003 left open. Package versions stay 0.85.308. 0.86 implementation not started.
- Verification: no tests, builds or runtime checks run; none claimed.

## 2026-11-26 - 0.85.323 Mobile Logout Confirmation Correction
- Objective: logout from the mobile More menu and Profile dropdown must show the existing confirmation (Confirm runs the existing logout, Cancel dismisses). Investigate root cause first, minimal frontend correction. .env* protected; no environment variable, backend, database, infrastructure or dependency changes; static verification only.
- Investigation: the confirmation is the `/logout` route page; the More menu row is a plain router-link. Backend `POST /api/logout` (destroy session, clear cookies) inspected read-only and is not the cause. Root cause (static analysis, not reproduced): `Logout.vue` redirected to login on any `/api/session` probe failure without ending the session; the page ignored the logout result and `useAuth().logout()` cleared state and redirected even when the backend logout failed; the Profile dropdown Sign Out called the shared logout with no confirmation.
- Files changed: `frontend/src/views/Member/Logout.vue` (shared `fetchSessionSnapshot`, no redirect on request failure, error plus retained confirmation on failed logout), `frontend/src/composable/useAuth.js` (optional `stayOnFailure`; default unchanged), `frontend/src/components/ProfileDropdown.vue` (Sign Out routes to `/logout`).
- Static verification: diagnostics clean; CRLF kept. Tests/build/server/browser/device: not run.
- Remaining: owner mobile acceptance PENDING; confirm desktop dropdown showing the confirmation is intended; `ExternalRegister.vue` direct logout unchanged. No commit, push or merge made. 0.86 not started.
## 2026-11-28 - 0.85.321 Missing Active Workout Exercise Cards
- Objective: restore exercise cards on the Current Workout page for new and resumed workouts (post-release maintenance). Read `.github/copilot-instructions.md`, CURRENT-STATE and CHANGE-CONTROL first. .env* protected; no environment variable, backend, database, infrastructure or dependency changes; static verification only.
- Investigation: header, count, progress and buttons come from `LogWorkout.vue` computed state (`dayExercises` is populated); cards are `ExerciseSessionCard.vue`. That component used `normalizeWorkoutTypeBadge` without importing it and used `completedSets`, `totalSets`, `allDone`, `hasPrefilledValues`, `prefillClass` that no longer exist in its script. Git history: removed in `6dbf903b1` (0.85.311), unchanged by `df1f026d5` (0.85.312). Hydration, filtering and group mapping inspected; not the cause.
- File changed: `frontend/src/components/workout-session/ExerciseSessionCard.vue` (import added, five definitions restored, legacy `isCardio` fallback for the set-table type when no explicit Workout Type).
- Static verification: diagnostics clean; CRLF kept; all template identifiers confirmed defined. Tests/build/server/browser: not run.
- Remaining: owner manual acceptance PENDING (new and resumed workouts, desktop, tablet, mobile). No commit, push or merge made. Not owner accepted.
## 2026-11-28 - 0.85.322 Mobile Profile Dropdown Fix
- Objective: the avatar tap on mobile must open and keep the existing profile dropdown (post-release maintenance). Determine whether it fails to open, closes immediately or renders behind another component.
- Investigation: `ProfileDropdown.vue` event path traced (pointerdown/touchstart/pointerup/click guards, outside-pointer capture listener, route-change close, Escape): no defect, unchanged since 0.85.239. `App.vue`, `AppBottomNav.vue`, `MobileMoreScreen.vue` and header CSS checked for competing listeners/clipping: none; `overflow-x: clip` does not clip the dropdown. Confirmed stacking cause: dropdown is inside the header context (1052); the mobile More screen (1410) paints above it.
- File changed: `frontend/src/components/HeaderComponent.vue` (one unscoped media-query rule raising the header to 1430 only while `.profile-dropdown-menu` is rendered, 768px and below).
- Static verification: diagnostics clean; CRLF kept (730/730). Tests/build/server/browser/device: not run.
- Remaining: owner mobile acceptance PENDING. No commit, push or merge made. Not marked accepted.
## 2026-11-28 - 0.85.324 Final Maintenance Checkpoint
- Objective: review 0.85.321, 0.85.322 and 0.85.323 for conflicts and prepare the checkpoint (documentation and static review only; no scope expansion; `0.85` remains complete).
- Review: read the uncommitted diffs of the five modified frontend files. No file is changed by more than one correction. Checked that `normalizeWorkoutTypeBadge`, `getRecordingFieldGroups` and `fetchSessionSnapshot` are exported, that `Logout.vue` defines `user` and `authLogout`, that the `logout()` default-argument change is compatible with `ExternalRegister.vue`, that Sign Out closes the dropdown before routing (releasing the 0.85.322 header lift) and that the More Logout row routes to `/logout`. No conflict found.
- Static verification: editor diagnostics clean on the five files; docs re-checked for NUL and CRLF/LF. Tests/build/server/browser/device: not run.
- Remaining (non-blocking): owner manual acceptance of all three; confirm desktop Sign Out confirmation is intended; `ExternalRegister.vue` logout unchanged; `:has()` needs a current browser. No commit, push or merge made. `0.86` not started.
## 2026-11-28 - 0.85.325 Final Maintenance Audit and Render Readiness Review
- Objective: static source audit of 0.85.321-0.85.324 (not assuming earlier reports) and Render Linux compatibility review; no tests, builds, installs, startup or live requests; `.env*` not read.
- Findings: 0.85.321 cards render for new and resumed workouts (one `dayExercises` computed drives count and cards; completed sets preserved). Defect `0.85.321.a1`: `ExerciseSessionCard.vue` `workoutType` had lost the Recording Type-first logic from 0.85.311 (`6dbf903b1`, removed by recovery `df1f026d5`), so the set table disagreed with `LogWorkout.vue` `normalizeExerciseWorkoutType`. Repaired (computed only). 0.85.322: listeners added in `onMounted` and removed in `onUnmounted`, router hook unsubscribed, desktop CSS unchanged. 0.85.323: both entry points route to `logout`; Confirm uses `useAuth.logout`; Cancel keeps the session; failure stays on the confirmation; duplicate-request guard present; workout drafts untouched.
- Render (static/expected): import and require case-exact; lockfiles tracked; Node 22; backend `0.0.0.0` + `PORT`, `trust proxy`, secure cross-site cookies. Dashboard-level only: no `render.yaml`, no `start` script, SPA rewrite not in repo, env values not inspected. Dead `template/MainSidebarComponent.vue` has a missing import but is not bundled (pre-existing).
- Verification: diagnostics clean on `ExerciseSessionCard.vue`. Build and runtime: NOT RUN. No deployment, commit, push or merge. Owner acceptance pending. `0.86` not started.
- Owner authorization (2026-11-28): commit and push of 0.85.321, 0.85.321.a1, 0.85.322, 0.85.323, 0.85.324 and 0.85.325 to `BETA` with a normal non-force push (existing Render auto-deploy triggered by it authorized; no manual deployment). Static readiness: YES. Render build/runtime verification: PENDING. Manual acceptance testing: PENDING. Next milestone: `0.86` (not started).