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
