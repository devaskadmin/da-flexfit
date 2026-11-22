# WorkoutAtlas Session Handoff

## Current objective
A fresh agent should continue from enterprise documentation validation and synchronize implementation to the 0.85.309 backlog. No application or data changes are authorized until a task is explicitly scoped and approved.

## Repository state

- Application versions: frontend/backend `0.85.308`
- Branch: `BETA`
- Pre-DEVOPS-DOCS-002 HEAD: `b7a4481702201de0b6577591828d965cb418b4c4`
- QA checkpoint: `0.85.309`
- Previous documentation commit: `b7a44817`
- Confirm the final HEAD with `git rev-parse HEAD` after DEVOPS-DOCS-002 is committed.
- Existing QA documentation changes: `CHANGELOG.md` and `WORKOUTATLAS_BATCH_RESULTS.md` are preserved

## Most recent completed task
Fresh-agent documentation onboarding validation, 0.85.309 live evidence preservation, and tablet-defect backlog synchronization.

## Open failures and pending acceptance

- No confirmed application defect was established for unresolved live gates.
- Publish/unpublish persistence needs reliable live replay.
- Featured registration needs available Featured source content and disposable accounts.
- Live trainer/admin/member write authorization needs disposable records.
- ExerciseScope mutation permissions need disposable records.
- Live two-session/third-session limit needs two disposable sessions.
- `WA-UI-TABLET-001`: Find Plans remains desktop-table-like at 800px with internal horizontal scrolling and potentially clipped actions; implementation pending, priority P2 pending action-blocking confirmation.

## Protected data

- PlanID 5 — Stephen K – Lean Muscle.
- Existing personal workout history.
- Existing paused sessions.
- Non-disposable Global plans and production accounts.

## Relevant files

- `docs/engineering/CURRENT-STATE.md`
- `docs/backlog/BACKLOG.md`
- `docs/qa/releases/0.85/0.85.309.md`
- `CHANGELOG.md`
- `WORKOUTATLAS_BATCH_RESULTS.md`

## Next authorized action
No implementation action is authorized until scoped approval is provided. The exact next targeted development task is `WA-UI-TABLET-001 — Tablet Find Plans responsiveness`, a P2 UI regression pending implementation approval. Separate live 0.85.309 acceptance requires explicit disposable-test scope.

## Next targeted development task
`WA-UI-TABLET-001 — Tablet Find Plans responsiveness` after implementation approval. Acceptance testing must check page-level and component/table overflow at 768, 800, 820, and 1024px.

## Explicit restrictions

- No push or deploy.
- No migrations or database writes.
- No application source changes.
- No server restart or infrastructure changes.
- No package-version bump.
- No credential, cookie, or secret recording.

## WA-UI-TABLET-001 closeout

- Implementation complete in `frontend/src/views/Member/WorkoutBuilder.vue`.
- Focused contract tests and Vite build passed.
- Live browser checks passed at 320, 390, 768, 800, 820, 1024, and 1366px.
- Search, no-match/empty behavior, and read-only preview were verified without persistent mutation.
- Status: USER ACCEPTANCE PENDING.

## 0.85.309a top Save alignment closeout - 2026-11-21

- Aligned Back to Plans and Save in one full-width row for Create and Edit Plan.
- Back is far left and Save is far right.
- Both controls use `32px` height/min-height and `32px` line height.
- Save remains `#15803D` with `#FFFFFF` text.
- Existing `handlePrimarySave` and save/publish behavior are unchanged.
- Focused frontend contract tests passed `21/21`; Vite production build passed `701` modules and generated `dist`.
- Live browser acceptance remains pending. Do not begin 0.85.313 or other implementation work.

## Restored-code verification-only closeout - 2026-11-21

- HEAD verified: `6dbf903b1e7ae1dd4e25fc34b07a1508fe6ed043`.
- 0.85.309 top-right Save: FAIL.
- 0.85.309a alignment: FAIL.
- 0.85.311 recording type/fields/layout/More-Less/tags: PASS in source and focused automated verification.
- 0.85.312 bottom Add Day/Add Week: MISSING.
- No source, version, migration, server, database, or protected-data changes were made.
- Stop point: verification complete; no implementation or 0.85.313 work authorized or started.

## 0.85.312 bottom Add Day/Add Week closeout - 2026-11-21

- Restored bottom Add Workout Day/Add Workout Week controls after at least one schedule and two exercises.
- Controls remain visible outside collapsed accordion content and append new groups to the end.
- Existing top controls, 0.85.311 fields, Add Exercise controls, Save logic, backend, and database remain unchanged.
- Focused contract suite passed `12/12`; Vue/test diagnostics passed; Vite build passed `701` modules and generated `dist`.
- Live browser acceptance remains pending for Create/Edit, Day/Week, accordions, and responsive layouts.
- Stop; do not begin 0.85.313.

## 0.85.311 FIX closeout - 2026-11-21

- Consolidated Recording Type field ordering, LBS labels, universal row layout, More/Less behavior, and independent Workout Type tags.
- `exerciseRecordingFields.js`, `WorkoutExerciseBlock.vue`, and `ExerciseSessionCard.vue` are the shared implementation sources.
- Existing 0.85.309/309a Save controls and 0.85.312 bottom controls were preserved.
- Focused tests passed `19/19`; diagnostics passed; Vite build passed `701` modules and generated `dist`.
- Live desktop/tablet/mobile and Create/Edit/View/preview/log/history/active/resume visual acceptance is NOT VERIFIED.
- User acceptance remains pending. Stop; do not begin 0.85.313 or 0.85.315.

## 0.85.312 recovery checkpoint closeout - 2026-11-21

- Consolidated status: 0.85.309, 0.85.309a, 0.85.311 FIX, and 0.85.312 implementations are present and build/test verified.
- Automated evidence: 19/19 focused recording/builder tests; production build passed 701 modules.
- Outstanding acceptance: live Save alignment, bottom Day/Week controls, recording surfaces/viewports, and Create/Edit save workflows require user browser verification.
- 0.85.313: TODO; no implementation or change starts until authorized.

## 0.85.313 baseline verification closeout - 2026-11-21

- Request: `0.85.113.RESET` branch; result: **FAIL** as a branch-name check. Checked-out local and upstream-tracking branch is `0.85.113`, while HEAD commit is named `0.85.113.RESET`.
- HEAD: `0fbf3b293cc6fb6363cac2922894bfc098c81bed`.
- Restored 0.85.312 baseline: **PASS**. Direct tree diff against BETA `df1f026d506c50456b477e0777a98bb55c2e1977` (`0.85.312 - Recovery checkpoint for 0.85.309 through 0.85.312`) is empty.
- Working tree: clean; status `## 0.85.113...origin/0.85.113`; no staged or tracked changes.
- `backend/api/users.js`: `4,768` lines; `37` route definitions.
- Exact API route inventory: `GET /user-id`, `GET /users`, `GET /user-profile-settings`, `PUT /user-profile-settings`, `POST /workout-schedules`, `GET /workout-schedules`, `GET /workout-schedules/:id`, `POST /workout-schedules/:id/plan-type-conversion-preview`, `POST /workout-schedules/:id/plan-type-conversion`, `POST /workout-schedules/:id/cover`, `DELETE /workout-schedules/:id/cover`, `PATCH /workout-schedules/:id`, `PUT /workout-schedules/:id/groups`, `POST /workout-schedules/:id/exercises`, `PATCH /workout-schedules/:id/exercises/:scheduleExerciseId`, `DELETE /workout-schedules/:id/exercises/:scheduleExerciseId`, `GET /workout-schedules/:id/delete-impact`, `DELETE /workout-schedules/:id`, `GET /featured-workout-plans`, `GET /global-workout-plans`, `GET /global-workout-plans/:id`, `POST /global-workout-plans/:id/use`, `POST /featured-workout-plans/:id/clone`, `GET /admin/global-workout-plans`, `GET /admin/user-workout-plans`, `GET /admin/global-workout-plans/:id`, `POST /admin/global-workout-plans`, `PATCH /admin/global-workout-plans/:id`, `PATCH /admin/global-workout-plans/:id/schedule`, `POST /admin/global-workout-plans/:id/exercises`, `DELETE /admin/global-workout-plans/:id/exercises/:scheduleExerciseId`, `DELETE /admin/global-workout-plans/:id`, `GET /workout-planner`, `GET /workout-planner/provenance`, `PUT /workout-planner`, `DELETE /workout-planner/:planId`, `GET /has-saved-workout-list`.
- Week/day assignment: normalized in `normalizePlannerPayload` and reconstructed in `buildPlannerFromSchedule`; exercises carry `scheduleGroup`, while `dayGroups`/`weekGroups` and separate order arrays retain labels and sort order.
- Storage: MySQL `workout_schedules`, `workout_schedule_groups`, and `workout_schedule_exercises`; `replaceScheduleGroupsAndExercises` replaces groups and exercise rows after preserving relevant custom display order.
- Existing frontend assignment functions: `normalizeGroupKey`, `getScheduleGroupId`, `resolveScheduleGroupNameFromId`, `toggleScheduleGroupAccordion`, `addScheduleGroupFromValue`, `addScheduleGroup`, `addScheduleGroupBottom`, `duplicateScheduleGroup`, `moveScheduleGroup`, and `removeScheduleGroup` in `frontend/src/views/Member/WorkoutBuilder.vue`.
- No application code, database, migration, package, server, protected PlanID 5, personal history, paused-session, or refactoring change was made.
- STOP: baseline verification complete. Await approval; do not implement, modify the branch name, or alter data.

## 0.85.313 Stage 1/10 closeout - 2026-11-21

- Branch `0.85.113.RESET`: FAIL (checked out `0.85.113`; only the HEAD commit subject is `0.85.113.RESET`).
- Baseline 0.85.312: PASS (HEAD `0fbf3b293cc6fb6363cac2922894bfc098c81bed` has an empty diff against BETA `df1f026d506c50456b477e0777a98bb55c2e1977`).
- `backend/api/users.js`: 4,768 lines; 37 routes (4 user/profile, 14 workout-schedules, 5 featured/global, 9 admin, 4 workout-planner, 1 has-saved-workout-list).
- Working tree: source clean; only documentation records modified.
- Stage 1 was verification only. Do not begin Stage 2 until the user approves and decides on the branch-name mismatch.

## 0.85.313.a1 Default Week Initialization closeout - 2026-11-21

- Branch `0.85.113` (user-approved working branch). New plans now start with `Week 1` in `weekGroups` via `createWorkoutPlan` in `WorkoutBuilder.vue`; Day View stays empty and Day mode stays default.
- Not touched: `hydratePlanner`, `resetPlannerDraft`, backend, database, packages, PlanID 5.
- Tests: contract suite `14/14` (2 new); Vite build passed; `users.js` still `37` routes.
- Known limit: backend persists only the active mode's groups, so `Week 1` saves only when the plan is saved in Week View.
- No commit made. STOP; await user acceptance before any further work.

## 0.85.313.a2 Default Day Assignment closeout (Stage 3/10) - 2026-11-21 - SUPERSEDED by 0.85.313.a2.1

- Committed and pushed the Stage 2 checkpoint first: `97397e075` on `origin/0.85.113`.
- Stage 3 (uncommitted): on plan load, `hydratePlanner` assigns exercises lacking a schedule group to `Week 1` in memory using the new `workoutDefaultWeekAssignment.mjs` helper. No save during load; valid assignments and recording values untouched.
- Tests: helper `7/7`, builder contract `14/14`; Vite build passed (`702` modules); `users.js` `37` routes, no backend/package/database change; PlanID 5 untouched.
- Limitation: data model has no day-to-week link; no live browser check.
- STOP; await user acceptance. Do not begin 0.85.313.a3.

## 0.85.313.a2.1 Correct Day Assignment closeout - 2026-11-21

- Replaced the exercise-level a2 logic: whole days are mapped to weeks in memory (`dayWeekAssignments`, `workoutDayWeekAssignment.mjs`). Exercises and their group labels load exactly as saved; no `Week 1` day card is created.
- Defaults: existing `Week 1`, else first existing week; valid assignments preserved; one week per day.
- Not persisted or saved; excluded from dirty state/payload. No backend persistence started.
- Tests: new suite `11/11`, builder contract `14/14`; Vite build passed (`702` modules); `users.js` `37` routes unchanged; PlanID 5 untouched. Stage 2 is pushed (`97397e075`); Stage 3 work is uncommitted.
- STOP; await user acceptance. Do not begin backend persistence or 0.85.313.a3.

## 0.85.313.a3 Persist Day-to-Week Assignments closeout - 2026-11-21

- Stage 3 committed and pushed (`71c1048a8`) before Stage 4 work.
- Persistence uses the existing `workout_schedules.settings_json` column: `PUT /api/workout-planner` merges `settings.dayWeekAssignments` (other keys preserved) through `persistDayWeekAssignments` in `backend/utils/workoutPlanSettings.js`; `buildPlannerFromSchedule` returns it as `planner.settings.dayWeekAssignments`. No schema change, route change, or data write; PlanID 5 untouched.
- Frontend: restore + reconcile on load, `Week 1` initialized when no weeks, payload and unsaved-change detection include assignments.
- Verification: frontend `28/28`; backend new suite `11/11`; `node --check` clean; 37 routes identical to HEAD; Vite build passed (`702` modules). Two existing backend tests need `mysql2` (not installed locally).
- Open items for the user: confirm `settings_json` exists in the target database (otherwise persistence is a no-op); unsaved custom week names are not persisted by the backend; global/clone paths do not write assignments.
- Stage 4 changes are uncommitted. STOP; await user acceptance. Do not begin Stage 5.

## 0.85.313.a3.1 Database Verification closeout - 2026-11-21

- Agent-side live query was BLOCKED (the user ran it instead, see below): no `backend/.env`, no `DB_*` variables, no `mysql2` (backend `node_modules` absent), no `mysql` client. Nothing was queried, guessed, or searched for credentials.
- Indirect only: backups `0.76` and `0.83` show a nullable `longtext utf8mb4_bin` column with `json_valid`.
- VERIFIED by the user (phpMyAdmin, 2026-11-21): `stephenk_flexfit.workout_schedules.settings_json` exists, `longtext`, `IS_NULLABLE` `YES`, default `NULL`.
- No code, schema, data, or package change; PlanID 5 untouched. Stage 4 changes remain uncommitted. STOP; do not begin Stage 5.
- First attempt was inconclusive (`information_schema` selected, `DATABASE()` mismatch); the re-run without `DATABASE()` returned the column. Open: browser save and reopen acceptance, and checking other environments (for example production) before release.

## 0.85.313.a3.2 Preserve Day and Week Groups closeout - 2026-11-21

- a3/a3.1 committed and pushed first (`1e8fa6818`). a3.2 is uncommitted: new `backend/utils/workoutPlanGroups.js`, new `backend/tests/workout-plan-groups.test.js`, `users.js` wiring, and one added frontend contract test.
- Behavior: both day and week groups are saved regardless of mode; IDs, names and order survive re-saves; removals are scoped to the edited set; unsent and placeholder-only empty sets are untouched. `PUT /workout-schedules/:id/groups` untouched; 37 routes in the same order.
- Verification: backend `21/21` + `11/11`, frontend `29/29`, `node --check` clean, CRLF kept, Vite build passed. Backend tests that import `express`/`mysql2` cannot run locally.
- Decision for the user: other readers count or list all groups regardless of type (`workout-log.js` day ordering and `day-order` save, `dashboard.js` weekly target, plan list `group_count`). Filtering them by mode is a separate change that was not made.
- Open: browser save and reopen acceptance in day and week modes, mode switch, reload. PlanID 5 untouched; no DB or schema change. STOP; await acceptance. Do not begin Stage 5.

## 0.85.313.a3.3 Schedule Group Filtering closeout - 2026-11-21

- Resolves the a3.2 decision: Workout Log day ordering, dashboard weekly target and global plan-list day counts now exclude week containers. a3.2 and a3.3 are both uncommitted.
- New `backend/utils/workoutScheduleGroupFilter.js` (JS and SQL form of one rule). Day-mode plans: every group type except `week`. Legacy Week View (`schedule_mode = 'week'`): week groups, unchanged. Edited `workout-log.js` (`GET`/`PUT /day-order`), `dashboard.js` (`weeklyTarget`), `users.js` (`group_agg` subquery plus import). No save-logic, UI, route or schema change; PlanID 5 untouched.
- Verification: new suite `24/24` (real route modules, stubbed express and pool), `21/21` + `11/11`, frontend `29/29`, Vite build passed, route tables identical to HEAD, CRLF kept.
- Still open: SQL unexecuted on real MySQL; day-mode plans with only weeks show 0 days and miss the global publish gate; add-exercise default group (`users.js`) and `workout-sessions.js` day lookups not filtered; browser acceptance of day and week modes. STOP; await acceptance. Do not begin Stage 5.

## 0.85.313.a3.4 Global Plan Persistence closeout - 2026-11-21

- a3.2/a3.3 were accepted and pushed as `20fefbfff` (branch `0.85.113`). a3.4 is uncommitted; do not commit or push unless asked.
- Day-to-week assignments now persist on global/featured/community create and edit (`PATCH /admin/global-workout-plans/:id/schedule`), global adopt, featured clone, plan-type conversion (`users.js`) and the register-time featured copy (`auth.js`). Reuses `persistDayWeekAssignments`; frontend unchanged; no schema, route, data or package change; PlanID 5 untouched; 37 `users.js` routes identical to HEAD.
- Verification: new `workout-plan-global-persistence` `11/11`, settings `11/11`, groups `21/21`, group filter `24/24`, frontend 7 files pass, Vite build passed, `node --check` clean, CRLF kept.
- Still open: browser acceptance (create/edit a global plan with week assignments, clone a plan, adopt a global and a featured plan, reopen each and confirm weeks and assignments); `settings_json` must exist in each target DB; SQL not run on real MySQL. a3.4 is committed and pushed as `f34e9eab1`. Await acceptance.

## 0.85.313.a4 Unified Schedule Planner closeout (Stage 5/10) - 2026-11-21

- a3.4 pushed first (`f34e9eab1`, branch `0.85.113`, live acceptance pending). a4 was committed and pushed as `5ffa3132b`; do not commit or push a5 unless asked.
- Frontend only (`WorkoutBuilder.vue`): Day View / Week View tabs and `changeScheduleMode` removed; one Schedule Planner of workout day cards. Add Day, Add Exercise, bottom controls and Save unchanged. The builder was already always in day mode, so the payload (both group sets, orders, `settings.dayWeekAssignments`, exercises) is unchanged. Nothing above Workout Plan Information, no backend/DB/package change, PlanID 5 untouched.
- Verification: new contract suite `8/8`, all 8 frontend test files pass (70 tests), Vite build passed, CRLF kept.
- Still open: browser check (tabs gone, day cards and Add Day/Add Exercise/Save work, a plan with weeks reopens with its week assignments intact after save, a legacy week-mode plan still opens); layout spacing after the tab removal is unverified; inert `.planner-mode-*` CSS remains; no week dropdown or Rename Week yet. STOP; await acceptance. Do not begin Stage 6.

## 0.85.313.a5 Week Selection Dropdown closeout (Stage 6/10) - 2026-11-21

- a4 pushed first (`5ffa3132b`, branch `0.85.113`, browser acceptance pending). a5 was committed and pushed as `317087e56` (browser acceptance pending).
- Frontend only: a Week dropdown at the top of the Schedule Planner (below Workout Plan Information, above Add Day and the day cards). Options = existing weeks; `Week 1` displays as `Week 1 (Default)` and stays stored as `Week 1`; default selection Week 1, else the first week. Helpers `buildWeekOptions` / `resolveSelectedWeek` in `workoutDayWeekAssignment.mjs`; `selectedWeek` is UI state only (not in payload, dirty snapshot or draft) and does not filter or edit anything. No day filtering, Add Week or Rename Week.
- Verification: new contract suite `7/7`, util suite `18/18`, a4 contract `8/8`, all 9 frontend test files pass (81 tests), Vite build passed, CRLF kept. No backend/DB/package change; PlanID 5 untouched.
- Still open: browser check (dropdown renders above the day cards with `Week 1 (Default)` first; switching weeks changes nothing else and keeps unsaved edits; a plan with custom weeks and a plan without Week 1 select the first week; save and reopen unchanged); selection has no visible effect until day filtering; no Add Week / Rename Week. STOP; await acceptance. Do not begin Stage 7.

## 0.85.313.a6 Add Week closeout (Stage 7/10) - 2026-11-21

- a5 pushed first (`317087e56`, branch `0.85.113`, browser acceptance pending). a6 was committed and pushed as `a222c3228` (browser acceptance pending).
- Frontend only: `+ Add Week` beside the Week dropdown. Enabled only when the selected week has a day with at least one exercise (selected week's assignments only; also requires create/edit mode). Adds the next unused `Week N` (from Week 2, smallest free number), selects it, new week is empty. Helpers `weekHasDayWithExercise` / `buildNextWeekName`. Existing weeks, days, exercises, assignments and unsaved edits untouched; switching weeks never gated. No Rename Week, no day filtering.
- Verification: new contract suite `8/8`, util suite `24/24`, a4/a5 contract suites updated and pass, all 10 frontend test files pass (95 tests), Vite build passed, CRLF kept. No backend/DB/package change; PlanID 5 untouched.
- Still open: browser check (Add Week disabled when the selected week has no exercised day and enabled otherwise; click creates Week 2 / Week 3 and selects it; new week is empty; switching weeks always works and keeps unsaved edits; save and reopen keeps the new week); there is no UI yet to assign days to weeks, so a new week stays empty and Add Week is disabled while it is selected; empty-week persistence unverified on a live DB. STOP; await acceptance. Do not begin Stage 8.

## 0.85.313.a7 Rename Week closeout (Stage 8/10) - 2026-11-21

- a6 pushed first (`a222c3228`, branch `0.85.113`, browser acceptance pending). a7 was committed and pushed as `bf66ec03e`.
- Frontend only: three-dot menu beside the Week dropdown with Rename Week (inline editor; there is no Rename Day modal, so it reuses the inline day-rename styling and `validateWorkoutDayName`, now with an optional noun). Helper `renameWeekInPlan`. Accepts spaces, apostrophes and hyphens (day character rules, max 60); rejects empty and case-insensitive duplicate names; keeps position, assigned days, in-builder identity, exercises, selection and unsaved changes. No day filtering.
- Identity limitation: the backend matches week rows by label (`planGroupSync`), so a saved rename deletes the old week row and inserts a new one (new group id); exercises are re-linked in the same save and assignments are stored by label. Anything keyed on the old week group id elsewhere is not carried over; unverified on a live DB; needs a payload/backend change to fix.
- Verification: new contract suite `9/9`, util suite `29/29`, a4/a5/a6 contract suites updated and pass, all 11 frontend test files pass (109 tests), Vite build passed, CRLF kept. No backend/DB/package change; PlanID 5 untouched.
- Still open: browser check (menu opens beside the dropdown and closes on outside click; Rename Week editor opens with the current name; Save/Enter renames, Cancel/Escape discards; empty and duplicate names including different case show an error; apostrophe, hyphen and space names work; the dropdown shows the new name and keeps the selection; assigned days and exercises are unchanged; unsaved edits kept; menu disabled when not editing; save and reopen shows the new name with its days intact); group-id behavior on a saved rename; no UI assigns days to weeks. STOP; await acceptance. Do not begin Stage 9.

## 0.85.313.a8 Week Filtering and Day Assignment closeout (Stage 9/10) - 2026-11-21

- a7 pushed first (`bf66ec03e`, branch `0.85.113`, browser acceptance pending, week ID limitation recorded). a8 committed and pushed as `a64c21cf0`.
- Frontend only: day cards show only the selected week's days (`visibleDayGroups`, `getDaysForWeek`); new days from the top and bottom Add Day controls are assigned to the selected week (`assignDayToWeek` in the shared handler); a new week is empty; switching weeks changes only the display and keeps unsaved edits; the save payload still carries every week; move up/down, first/last and the bottom controls follow the visible days; the Preview is unfiltered. Add Week validation and Rename Week unchanged; a7 edge case fixed (rename editor cancelled when the dropdown changes).
- BLOCKER (reported, not worked around): identical day names in separate weeks. A day is identified by name alone (day list, exercise `scheduleGroup`, assignment keys, backend label matching), so same-named days would merge. Needs a day id or week-qualified key in the payload and backend. Duplicates stay rejected across weeks with a message naming the other week.
- Verification: new contract suite `12/12`, util suite `35/35`, a5 week-dropdown and 0.85.312 preview-mobile contract tests updated and pass, all 12 frontend test files pass (127 tests), Vite build passed, CRLF kept. No backend/DB/package change; PlanID 5 untouched.
- Still open: browser check (cards show only the selected week; Add Day top and bottom puts the day in the selected week; a new week shows an empty schedule and the empty message; switching weeks keeps unsaved days, exercises, recording values and assignments; move up/down inside a week; Add Week and Rename Week still work; save and reopen preserves all weeks and their days); the identical-name blocker; week id not persisted on rename; no UI moves an existing day to another week. STOP; await acceptance. Do not begin Stage 10.

## 0.85.313.a8.1 Schedule Identity Correction closeout - 2026-11-21

- a8.1 was committed and pushed as `fe82ef325` on branch `0.85.113`. No migration, schema change, production data write or package change; PlanID 5 untouched.
- Resolves the a8 identical-day-name blocker with the existing schema: groups are identified by `workout_schedule_groups.id`, labels are display only. Backend: entries-aware planner save (id-only sync, rename keeps the id), `dayWeekAssignmentsById` in `settings_json` plus the legacy label map, planner `GET` entries and unique compatibility names for repeated labels (`utils/workoutScheduleGroupView.js`), `auth.js` remaps the id map on register-time copy, `workout-log.js` shows real labels. Frontend: per-key day identity with display labels, same-week-only duplicate check, saved ids adopted after save. 37 `users.js` routes preserved.
- Verification: backend focused suites `78/78`; frontend 13 files / 140 tests pass; Vite build passed; CRLF kept. The full backend run is covered by the a9 closeout below.
- Still open: browser check (same name in two weeks keeps separate exercises and recording values; rename keeps contents and week; save and reopen; copy plan; existing plans open unchanged; PlanID 5 intact); live DB index state of `workout_schedule_groups`; label-keyed readers (global preview, `PUT /workout-schedules/:id/groups`, conversion engine, session label fallback) see compatibility names. Stage 10 (a9) follows below.

## 0.85.313.a9 Final Regression and Acceptance closeout (Stage 10/10) - 2026-11-21

- a8.1 pushed first (`fe82ef325`, branch `0.85.113`, acceptance pending). a9 is verification and documentation only: no feature, schema, migration, package or deployment change; PlanID 5 untouched; no production database access.
- Results: backend deps restored with `npm ci` (lockfile, no package edits). Default backend run 178 tests / 165 pass / 13 fail, all `Missing database environment variables` at import (no `backend/.env`; environmental). With throwaway in-process DB variables at an unreachable address: 238/238 pass. Frontend 13 files / 140 pass; Vite build passed; `users.js` 37 routes in the same order.
- Audit findings (none fixed): conversion engine writes compatibility names as labels for repeated day names in the converted copy; `PUT /workout-schedules/:id/groups` is a dormant delete-and-reinsert route; session label fallback is id-first. Indexes in the repository schema and the 0.83 backup are non-unique; the live state is unverified.
- Still open: user browser acceptance (checklist in `docs/releases/RELEASE-READINESS.md`) and the live DB index check. STOP. Do not merge into BETA or declare 0.85.313 accepted without user approval.

## 0.85.313 BETA merge closeout - 2026-11-21

- Merge: `0.85.113` (HEAD `e7b6059e8`, "0.85.313 - Unified Multi-Week Schedule Planner - QA Checkpoint") merged into `BETA` with a true merge commit (`--no-ff`). The merge commit hash is the commit that contains this entry (see `git log --merges -1 BETA`). Rollback hash (BETA before merge): `df1f026d506c50456b477e0777a98bb55c2e1977` (0.85.312 recovery checkpoint).
- Conflicts resolved (10 files, nothing else changed): `WorkoutBuilder.vue` `showBottomScheduleGroupControls` keeps the 0.85.313 selected-week-aware logic (`visibleDayGroups` for the schedule check, exercises counted from the selected week's days). The 0.85.312 requirements remain in force within the selected week: the bottom Add Day control needs at least one visible schedule and at least two unique exercises. `WorkoutBuilder.preview-mobile-contract.test.mjs`: both the 0.85.312 and 0.85.313.a1/a3.2 tests retained, with added assertions that the exercise count derives from the visible day groups and that the control is gated by `showBottomScheduleGroupControls`. Eight documentation files: both histories kept (0.85.312 recovery entries and all 0.85.313 development entries); no entry removed.
- Note: the originally approved final regression commit `0d46d7703` was amended before push into `e7b6059e8` (identical tree; `git diff 0d46d7703 e7b6059e8` is empty).
- Verification (automated): frontend 13 test files, 140/140 pass; backend default run 178 tests (165 pass, 13 environmental failures: missing DB environment variables, none are code defects); backend with isolated throwaway in-process variables 238/238 pass; Vite production build passes; security gate `SECURITY_GATE_PASS`; all 37 `backend/api/users.js` routes present and in identical order to `0.85.113`, `BETA` before merge and baseline `bf66ec03e`.
- Safety: no database change, migration, package/version change, server restart or deployment; PlanID #5 untouched; all 13 Git stashes preserved; no force push or branch deletion.
- User acceptance: PENDING. Browser acceptance and the live-database index verification have not been performed. An automated pass is not user acceptance. Open audit items unchanged: conversion engine writes compatibility names as labels for repeated day names, dormant `PUT /workout-schedules/:id/groups`, session label fallback.
