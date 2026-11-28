# WorkoutAtlas Release Readiness

## 0.85.325 Final maintenance audit and Render readiness review (2026-11-28): PENDING OWNER ACCEPTANCE

Static source verification only. 0.85.321-0.85.324 audited; one frontend repair `0.85.321.a1` (`ExerciseSessionCard.vue`). Expected Render compatibility: no code blocker (case-exact imports/requires, tracked lockfiles, Node 22, `0.0.0.0`/`PORT` binding, `trust proxy`, secure cross-site cookies). Dashboard-level items to confirm before deploy: backend Start Command `node server.js` (no `start` script, no `render.yaml`), SPA rewrite `/*` -> `/index.html`, existing CORS/session environment values (not inspected). Actual build verification: NOT RUN. Actual runtime verification: NOT RUN. Owner acceptance: PENDING. No deployment, commit, push or merge. `0.86` not started.
Owner authorization (2026-11-28): commit and push to `BETA` of 0.85.321, 0.85.321.a1, 0.85.322, 0.85.323, 0.85.324 and 0.85.325 (normal push; any existing Render auto-deploy it triggers is authorized). Static readiness: YES. Render build verification: PENDING. Runtime verification: PENDING. Manual acceptance testing: PENDING. Next milestone: `0.86` (not started).
## 0.85.324 Final maintenance checkpoint (2026-11-28): PENDING OWNER ACCEPTANCE

`0.85` remains officially complete. Post-release corrections 0.85.321, 0.85.322 and 0.85.323 are implemented, uncommitted and unaccepted (task labels; packages remain `0.85.308`). Bounded static review found no conflicts between them; diagnostics clean; no tests, builds or startup run. Owner manual acceptance outstanding. No commit, push or merge. `0.86` not started.
## 0.85.322 Mobile profile dropdown fix (2026-11-28): PENDING OWNER ACCEPTANCE

Post-release maintenance correction in `HeaderComponent.vue` only (task label; packages remain `0.85.308`). Static verification only; mobile device acceptance outstanding (with and without the More menu open). No commit, push or merge.
## 0.85.321 Active workout exercise cards restored (2026-11-28): PENDING OWNER ACCEPTANCE

Post-release maintenance correction in `ExerciseSessionCard.vue` only (task label; packages remain `0.85.308`). Static verification only; desktop, tablet and mobile acceptance for new and resumed workouts outstanding. No commit, push or merge.
## 0.85.323 Mobile logout confirmation correction (2026-11-26): PENDING OWNER ACCEPTANCE

Frontend-only correction in `Logout.vue`, `useAuth.js` and `ProfileDropdown.vue` (task label; packages remain `0.85.308`). Backend `/api/logout` inspected read-only; not the cause. Static verification only; mobile device acceptance outstanding. No commit, push or merge.
## 0.85.320 Official 0.85 release closeout (2026-11-25): COMPLETE - OWNER ACCEPTED

The project owner declared the `0.85` milestone complete (owner statement). All eight initial Global Workout Plans are owner-verified and published (8 of 8). This checkpoint is documentation only: no tests, builds or runtime checks were run and none are claimed. The earlier checkpoint sections below are preserved as history; their unverified live items (WA-QA-309-01 to 04, WA-QA-299-01, WA-UI-TABLET-001) and open content item WA-CONTENT-003 are carried forward as deferred, not marked passed. Package versions remain `0.85.308`. Next milestone `0.86` (not started), then `0.87` iPhone and `0.88` Android. See [../../CHANGELOG.md](../../CHANGELOG.md).

## Current checkpoint (historical, superseded by 0.85.320 owner acceptance)

`0.85.312` is **not user accepted** and has unresolved live acceptance items.

## State

- Local runtime: previously reachable and live-tested.
- Automated evidence: passed subsets are preserved in changelog/batch evidence.
- Live evidence: plan/copy/preview/session/history/mobile/media subsets passed.
- Pending: publish/unpublish, Featured registration, role write authorization, ExerciseScope mutation, and two/third-session live replay.
- Content: remaining manual Global plans and exercises are separate content work.

No release should be marked released or accepted merely because automated tests pass.

## 0.85.318 Add Day button color (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Cosmetic, frontend-only: top and bottom Schedule Planner Add Day buttons use `#2563EB` with white text via scoped CSS in `WorkoutBuilder.vue`; Add Exercise and Add Week unchanged. Uncommitted; no package version change; no tests, build or runtime check run; not visually verified; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.317 Recording Type correction (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Frontend-only: saved plan exercises (which carry no Recording Type) resolve it from the Exercise Database catalog by id so Cardio exercises with `Time & Distance` show Target Time / Target Calories / Distance primary. Catalog values for the three reported exercises are unverified; database and backend not modified. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.4 Schedule Planner horizontal week navigation (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Week dropdown replaced by horizontal week tabs (max four visible, arrows above four weeks), Add Week and More menu moved into the planner header row, and the first Add Day creates `Week 1` when the plan has no week; all in `WorkoutBuilder.vue`. Owner-stated acceptance of 0.85.316.3.a4 recorded. Four source-contract tests updated, not run. Uncommitted; no package version change; no tests, build or runtime check run; not visually verified; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.3.a4 single accordion expansion (2026-11-25): OWNER ACCEPTED (owner-stated)

Sub-fix of 0.85.316.3 (owner-stated acceptance of a3): one Workout Plan Information accordion open at a time via a single state in `WorkoutMetadataForm.vue`; Publish validation reveal order aligned to accordion order in `WorkoutBuilder.vue`. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.3.a3 accordion header border-radius override (2026-11-25): OWNER ACCEPTED (owner-stated)

Sub-fix of 0.85.316.3 after 0.85.316.3.a2 failed owner acceptance: scoped `border-radius: 0 !important` on accordion header buttons in `WorkoutMetadataForm.vue` to beat the global `design-system.css` `button` rule. Uncommitted; no package version change; no tests, build or runtime check run; not visually verified; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.3.a2 accordion header corners (2026-11-25): FAILED OWNER ACCEPTANCE (superseded by a3)

Sub-fix of 0.85.316.3: CSS-only square header corners (`border-radius: 0`) in `WorkoutMetadataForm.vue`. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.3.a1 accordion header colors (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Sub-fix of 0.85.316.3: CSS-only header colors (`#203252` collapsed, `#24477E` expanded) in `WorkoutMetadataForm.vue`. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.3 Plan Information vertical accordions (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Layout reorganization of Create and Edit Workout Plan (`WorkoutMetadataForm.vue`, small hook and cover CSS in `WorkoutBuilder.vue`). 0.85.316.2 and 0.85.316.2.a1 are owner-stated accepted. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.2.a1 two-column layout correction (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

The owner rejected 0.85.316.2 (panels stacked in the left 33%). Root cause: legacy desktop `grid-column: 1` rule matched the information panel; fixed in `WorkoutMetadataForm.vue` scoped CSS. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.2 two-column Plan Information layout (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Layout-only change to Create and Edit Workout Plan (`WorkoutMetadataForm.vue`, cover CSS in `WorkoutBuilder.vue`). 0.85.316.1 and 0.85.316.1.a1 are owner-stated accepted. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.316.1 header action buttons (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Layout-only relocation of Back to Plans / Save (Create, Edit) and Back to Plans / Use Plan (View preview) into section headers in `WorkoutBuilder.vue`. Uncommitted; no package version change; no tests, build or runtime check run; owner manual acceptance pending. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.cleanup final BETA integration (2026-11-25): MERGED INTO BETA - CLEANUP BRANCH RETIRED - POST-MERGE QA PENDING

Supersedes the earlier cleanup sections below (kept for history, including their "BETA integration NOT AUTHORIZED" statements, which applied at the time). The owner confirmed noticeable performance improvement after a3 and authorised committing the cleanup, merging it into BETA, pushing BETA and retiring the local cleanup branch. This is an integration, not a release or user acceptance: full regression testing and authentication regression testing are PENDING, no measured performance benchmark exists, the Vue `parentNode` exception is not conclusively resolved, and responsive breakpoint improvements are deferred. No package version change; no deployment; main untouched. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.cleanup.5.a3 navigation performance optimization (2026-11-25): PERFORMANCE OPTIMIZATION IMPLEMENTED - PENDING OWNER ACCEPTANCE

Owner feedback after a2: the application works but is slow. Task `0.85.cleanup.5.a3` changed seven source files in the uncommitted working tree of `0.85.cleanup` (`useAuth.js`, `router/index.js`, `primaryColorChangeSetting.js`, `App.vue`, `layouts/App.vue`, `HeaderComponent.vue`, `HomeDashboard.vue`): near-simultaneous `/api/session` requests are shared (no caching; the router guard still validates the server session on every protected navigation), dashboard requests run concurrently, and redundant per-navigation writes and listeners were removed. Verification was static only; no tests, build, browser run or timing measurement, so no improvement is claimed as measured. The Vue `parentNode` exception is unresolved. Manual acceptance pending; final cleanup acceptance blocked. No package version change. Nothing here advances release readiness. BETA integration NOT AUTHORIZED. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.cleanup.5.a2 mobile navigation targeted repair (2026-11-25): TARGETED REPAIR IMPLEMENTED - PENDING OWNER ACCEPTANCE

Owner testing of `0.85.cleanup.5` FAILED mobile/tablet acceptance. Read-only investigation `0.85.cleanup.5.a1` found the defects predate cleanup. Task `0.85.cleanup.5.a2` changed two files in the uncommitted working tree of `0.85.cleanup`: `ProfileDropdown.vue` (diagnostics opt-in, closed-state early returns) and `AppBottomNav.vue` (cyclic custom properties removed). Verification was static only; no tests, build or browser run. The Vue `parentNode` exception is unresolved and not claimed fixed. Deferred: session-request pattern, breakpoint alignment, header offset. Manual acceptance pending; final cleanup acceptance blocked. No package version change. Nothing here advances release readiness. BETA integration NOT AUTHORIZED. See [../../CHANGELOG.md](../../CHANGELOG.md).

## 0.85.cleanup.5 Batch 5 composable cleanup (2026-11-25): IMPLEMENTED - PENDING FINAL OWNER ACCEPTANCE (mobile/tablet acceptance subsequently FAILED; see the a2 section above)

Batch 5 (four unused template composables: `chartsDataManage.js`, `dashboardManage.js`, `nestableList.js`, `sweetalertManage.js`; 4 files, 0 routes, no navigation edit) is applied to the uncommitted working tree of `0.85.cleanup` on top of Batches 1-4 (cumulative 165 files, 44 routes, 37 route paths). Acceptance of Batches 1-4 was not stated by the owner and remains pending. Verification was static only; no tests, build or browser run. No package version change. Nothing here advances release readiness. BETA integration NOT AUTHORIZED. See [../engineering/APP-CLEANUP-INVENTORY.md](../engineering/APP-CLEANUP-INVENTORY.md).

## 0.85.cleanup.4 Batch 4 template removal (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Batch 4 (unused Digiboard UI demonstrations: charts, tables, form, icon, map, utility, animation, nestable list, sweet alert and swiper slider; 48 files, 10 routes, no navigation edit) is applied to the uncommitted working tree of `0.85.cleanup` on top of Batches 1-3 (cumulative 161 files, 44 routes, 37 route paths). Six owner-protected or same-name inventory files were preserved. Acceptance of Batches 1, 2 and 3 was not stated by the owner and remains pending. Verification was static only; no tests, build or browser run. No package version change. Nothing here advances release readiness. Batch 5 not started; BETA integration NOT AUTHORIZED. See [../engineering/APP-CLEANUP-INVENTORY.md](../engineering/APP-CLEANUP-INVENTORY.md).

## 0.85.cleanup.3 Batch 3 template removal (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Batch 3 (unused Digiboard authentication, registration, status, pricing, subscription, promotion and email-template demonstration pages: 19 files, 14 routes, one stale `Guest.vue` entry) is applied to the uncommitted working tree of `0.85.cleanup` on top of Batches 1 and 2 (cumulative 113 files, 34 routes, 47 route paths). Acceptance of Batches 1 and 2 was not stated by the owner and remains pending. Real WorkoutAtlas authentication, guards and backend were not touched. Verification was static only; no tests, build or browser run. No package version change. Nothing here advances release readiness. Batch 4 not started; BETA integration NOT AUTHORIZED. See [../engineering/APP-CLEANUP-INVENTORY.md](../engineering/APP-CLEANUP-INVENTORY.md).

## 0.85.cleanup.2 Batch 2 template removal (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Batch 2 (chat, standalone calendar, email, invoices, contacts and file manager demos: 27 files, 6 routes, related navigation entries) is applied to the uncommitted working tree of `0.85.cleanup` on top of Batch 1 (cumulative 94 files, 20 routes, 61 route paths). Batch 1 manual testing had reported broken menu links; the read-only `0.85.cleanup.1.a2` investigation could not attribute them to Batch 1. Verification was static only; no tests, build or browser run. No package version change. Nothing here advances release readiness. Batch 3 not started; BETA integration NOT AUTHORIZED. See [../engineering/APP-CLEANUP-INVENTORY.md](../engineering/APP-CLEANUP-INVENTORY.md).

## 0.85.cleanup.1.a1 Batch 1 template removal (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

Batch 1 only (CRM, HRM and e-commerce demos: 67 files, 14 routes, Taskboard link) is applied to the uncommitted working tree of `0.85.cleanup`. Verification was static only; no tests, build or browser run. No package version change. Nothing here advances release readiness. Batches 2-5 not started; BETA integration NOT AUTHORIZED. See [../engineering/APP-CLEANUP-INVENTORY.md](../engineering/APP-CLEANUP-INVENTORY.md).

## 0.85.cleanup.1 template feature removal (2026-11-24): FAILED ACCEPTANCE — ROLLBACK REQUESTED

The removal was rolled back (source restored to `6fdec962`, uncommitted). Nothing here advances release readiness. Open blocker: the backend cannot authenticate to its configured MySQL server (`ER_ACCESS_DENIED_ERROR`); owner action required. BETA integration NOT AUTHORIZED. Superseded text follows as history: owner-approved removal of standalone template demo features was implemented but uncommitted; automated checks had passed (frontend 140/140, Vite build, backend 238/238). See [../engineering/APP-CLEANUP-INVENTORY.md](../engineering/APP-CLEANUP-INVENTORY.md).

## 0.85.cleanup inventory (2026-11-24)

Investigation-only branch `0.85.cleanup` (base `6fdec962`). No release content, no package version change, no tests run. Nothing here advances release readiness; see [../engineering/APP-CLEANUP-INVENTORY.md](../engineering/APP-CLEANUP-INVENTORY.md).

## 0.85.309a top Save alignment

- 0.85.309a is implementation-complete and automated-verification-passed.
- Focused contract tests passed `21/21`; Vite production build passed.
- Desktop, tablet, and mobile live geometry and save workflow acceptance remain pending user verification.

## 0.85.312 bottom Add Day/Add Week controls

- 0.85.312 is implementation-complete and automated-verification-passed.
- Focused contract tests passed `12/12`; Vite production build passed.
- Live Create/Edit, Day/Week, collapsed-accordion, and desktop/tablet/mobile browser acceptance remains pending.

## 0.85.311 FIX

- 0.85.311 FIX is implementation-complete and automated-verification-passed.
- Recording fields, labels, layout, More/Less, and tags passed focused source/test verification `19/19` and production build.
- Live Create/Edit/View/Preview/Log/Active/Resume/History and desktop/tablet/mobile visual acceptance remains NOT VERIFIED and pending user verification.

## 0.85.312 recovery checkpoint

- 0.85.309, 0.85.309a, 0.85.311 FIX, and 0.85.312 source implementations are present.
- Focused contract suites passed 19/19; Vite production build passed 701 modules.
- Live visual/user acceptance remains pending for Save, bottom schedule controls, recording layouts, and responsive surfaces.
- 0.85.313 is reset to TODO and not started.

## 0.85.313 Stage 1/10 baseline verification

- Baseline 0.85.312 verified (empty diff against BETA `df1f026d506c50456b477e0777a98bb55c2e1977`); branch name `0.85.113.RESET` not checked out (`0.85.113`) — FAIL.
- `users.js`: 4,768 lines, 37 routes. Verification only; no acceptance or release state changed.

## 0.85.313.a1 Default Week Initialization

- Code complete on branch `0.85.113`; contract suite `14/14` and Vite build passed; `users.js` 37 routes unchanged; package versions `0.85.308` unchanged.
- Not committed, pushed, or deployed. User acceptance PENDING; not release-ready until accepted.

## 0.85.313.a2 Default Day Assignment (Stage 3/10) - SUPERSEDED by 0.85.313.a2.1

- Stage 2 checkpoint committed as `97397e075` and pushed to `origin/0.85.113`. Stage 3 is code complete but uncommitted; helper suite `7/7`, builder contract `14/14`, Vite build passed (`702` modules), `users.js` 37 routes unchanged, package versions `0.85.308` unchanged.
- No deploy. User acceptance PENDING; not release-ready until accepted.

## 0.85.313.a2.1 Correct Day Assignment

- Frontend-only correction of Stage 3: in-memory day-to-week mapping replaces exercise-level assignment. Mapping suite `11/11`, builder contract `14/14`, Vite build passed (`702` modules), `users.js` 37 routes unchanged, package versions `0.85.308` unchanged. Uncommitted; not pushed or deployed.
- Mapping is not persisted. User acceptance PENDING; not release-ready until accepted.

## 0.85.313.a3 Persist Day-to-Week Assignments

- Frontend plus backend (`users.js` +23 lines, new `backend/utils/workoutPlanSettings.js`): assignments saved to the existing `settings_json` column. No migration, deploy, or package change; routes unchanged (37).
- Release gate: confirm `settings_json` exists in each target database (persistence is a no-op otherwise). Uncommitted; acceptance PENDING; not release-ready until accepted.

## 0.85.313.a3.1 Database Verification

- `settings_json` is VERIFIED present in the `stephenk_flexfit` schema (user-run read-only query, `longtext`, nullable). Before release, run the same query (`docs/database/SCHEMA.md`) on every other target schema, such as production; zero rows there means persistence is a no-op and a DBA-approved migration is needed. Documentation-only update; no code, schema, data, or package change.

## 0.85.313.a3.2 Preserve Day and Week Groups

- Backend save path now keeps both group sets (`backend/utils/workoutPlanGroups.js`, `users.js` wiring). No migration, deploy or package change; 37 routes unchanged.
- Release gates: user acceptance of browser save and reopen in day and week modes; decide whether `workout-log.js` day ordering, `dashboard.js` weekly target and plan list `group_count` must filter groups by mode before release (they currently count all groups). Uncommitted; not release-ready until accepted.

## 0.85.313.a3.3 Schedule Group Filtering

- Backend only: shared filter util plus edits in `workout-log.js`, `dashboard.js` and `users.js` (plan-list subquery). Closes the a3.2 gate on readers that counted every group. No migration, deploy or package change; routes unchanged.
- Release gates: user acceptance in the browser (Workout Log order, dashboard weekly target, Find Plans day counts for day and week plans); verify the new SQL on a real MySQL server before release (not executable locally); decide whether the add-exercise default group and `workout-sessions.js` day lookups need the same filter. a3.2 and a3.3 accepted and pushed as `20fefbfff`.

## 0.85.313.a3.4 Global Plan Persistence

- Backend only (`users.js`, `auth.js`): day-to-week assignments persist on global create/edit, clone, adoption, conversion and register-time featured copy via the existing helper. No migration, deploy or package change; routes unchanged.
- Release gates: user acceptance in the browser (create/edit a global plan with week assignments, clone a plan, adopt a global and a featured plan, reopen each); confirm `settings_json` exists in every target database (checked only in `stephenk_flexfit`; otherwise assignments are silently not copied); run the new calls on a real MySQL server (not executable locally). a3.4 committed and pushed as `f34e9eab1`; not release-ready until accepted.

## 0.85.313.a4 Unified Schedule Planner (Stage 5/10)

- Frontend only (`WorkoutBuilder.vue`): Day View / Week View tabs removed; one Schedule Planner of day cards. No backend, migration, deploy or package change; save payload unchanged.
- Release gates: user acceptance in the browser (planner layout after the tab removal, Add Day / Add Exercise / Save, reopen a plan with weeks and a legacy week-mode plan); week assignments are not editable in the UI until the dropdown stage, so confirm that is acceptable for any interim release. a4 committed and pushed as `5ffa3132b`; not release-ready until accepted.

## 0.85.313.a5 Week Selection Dropdown (Stage 6/10)

- Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`): Week dropdown above the day cards. No backend, migration, deploy or package change; save payload unchanged.
- Release gates: user acceptance in the browser (dropdown label and layout, default selection, switching weeks keeps unsaved edits, save and reopen unchanged). The dropdown has no visible effect until day filtering lands, so confirm that is acceptable for any interim release. a5 committed and pushed as `317087e56`; not release-ready until accepted.

## 0.85.313.a6 Add Week (Stage 7/10)

- Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`): `+ Add Week` beside the Week dropdown. No backend, migration, deploy or package change; save payload unchanged.
- Release gates: user acceptance in the browser (button disabled/enabled rule, Week 2/Week 3 naming and auto-selection, new week empty, switching weeks keeps unsaved edits, save and reopen keeps the new week). No UI assigns days to weeks yet, so a new week stays empty; confirm that is acceptable for any interim release, and verify empty-week persistence on a non-production database. a6 committed and pushed as `a222c3228`; not release-ready until accepted.

## 0.85.313.a7 Rename Week (Stage 8/10)

- Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`): Rename Week in a three-dot menu beside the Week dropdown. No backend, migration, deploy or package change; save payload unchanged.
- Release gates: user acceptance in the browser (menu and editor layout, valid and invalid names, dropdown and selection update, assigned days and exercises intact, save and reopen shows the new name). Because persistence matches weeks by label, a saved rename recreates the week's group row with a new id; verify on a non-production database that nothing keyed on the old week group id is lost before any release that relies on week renames. a7 committed and pushed as `bf66ec03e`; not release-ready until accepted.

## 0.85.313.a8 Week Filtering and Day Assignment (Stage 9/10)

- Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`): day cards filtered by the selected week; new days assigned to the selected week. No backend, migration, deploy or package change; save payload unchanged.
- Release gates: user acceptance in the browser (cards per week, Add Day top and bottom, empty new week, switching weeks keeps unsaved edits, save and reopen preserves all weeks and their days). Identical day names in separate weeks were NOT supported at a8 (resolved in a8.1 below). The week id is still not persisted on rename in the legacy label path (a7). a8 committed and pushed as `a64c21cf0`; not release-ready until accepted.

## 0.85.313.a8.1 Schedule Identity Correction

- Backend and frontend (`api/users.js`, `api/auth.js`, `api/workout-log.js`, `utils/workoutPlanGroups.js`, `utils/workoutPlanSettings.js`, new `utils/workoutScheduleGroupView.js`, `WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`): groups are identified by `workout_schedule_groups.id`, labels are display only. No migration, schema change, deploy or package change; the API stays backward compatible (entries are optional; label-only payloads and old clients use the compatibility names).
- Release gates: user acceptance in the browser (same day name in two weeks keeps separate exercises and recording values; rename keeps contents and week; save and reopen; copy plan; existing plans open unchanged). Verify on a non-production database that `workout_schedule_groups` has no unique `(workout_schedule_id, label)` index (the repository schema sources define none; the live state is unverified) and that `dayWeekAssignmentsById` round-trips. The backend must be deployed together with the frontend, because the new frontend sends entries. The full backend suite was re-run in a9 (below). a8.1 committed and pushed as `fe82ef325`; not release-ready until accepted.

## 0.85.313.a9 Final Regression and Acceptance (Stage 10/10)

- Verification and documentation only; no code, schema, migration, package or deployment change. Automated checks PASS; release readiness: NOT release-ready until the user accepts. 0.85.313 is not declared accepted and is not merged into BETA.
- Results: default backend run 178 tests / 165 pass / 13 fail (all `Missing database environment variables` at module load, no `backend/.env`; environmental); with throwaway in-process DB variables 238/238 pass; frontend 13 files / 140 tests pass; Vite build passed; 37 `users.js` routes in the same order.
- Release gates: (1) browser acceptance of the checklist below; (2) on a non-production copy of the live database run `SHOW INDEX FROM workout_schedule_groups` and confirm there is no unique `(workout_schedule_id, label)` index (repository schema and the 0.83 backup define none); (3) deploy backend and frontend together; (4) decide whether the conversion engine should keep the real labels for repeated day names (currently the compatibility names, for example `Push (Week 2)`, are stored in the converted copy); (5) the dormant `PUT /workout-schedules/:id/groups` delete-and-reinsert route has no frontend caller.
- Manual browser checklist: open a new plan (Week 1 selected); open an existing and a legacy plan (all days under Week 1, exercises and values intact); Add Week (valid, invalid and duplicate names); Rename Week and save and reopen; select a week and check only its days show; Add Day top and bottom lands in the selected week; add the same day name to two weeks and confirm separate exercises and recording values; rename a day and confirm contents and week stay; save, reload and confirm persistence; copy and convert plans (Global, Featured, Community) and confirm days, weeks and exercises; Workout Log: start, resume and finish a session and see it in dashboard and history; run the 0.85.309-0.85.312 areas (preview, mobile layout, history) and confirm PlanID 5 is unchanged.

## 0.85.313 merged into BETA - 2026-11-21

- Merge: `0.85.113` (HEAD `e7b6059e8`, "0.85.313 - Unified Multi-Week Schedule Planner - QA Checkpoint") merged into `BETA` with a true merge commit (`--no-ff`). The merge commit hash is the commit that contains this entry (see `git log --merges -1 BETA`). Rollback hash (BETA before merge): `df1f026d506c50456b477e0777a98bb55c2e1977` (0.85.312 recovery checkpoint).
- Conflicts resolved (10 files, nothing else changed): `WorkoutBuilder.vue` `showBottomScheduleGroupControls` keeps the 0.85.313 selected-week-aware logic (`visibleDayGroups` for the schedule check, exercises counted from the selected week's days). The 0.85.312 requirements remain in force within the selected week: the bottom Add Day control needs at least one visible schedule and at least two unique exercises. `WorkoutBuilder.preview-mobile-contract.test.mjs`: both the 0.85.312 and 0.85.313.a1/a3.2 tests retained, with added assertions that the exercise count derives from the visible day groups and that the control is gated by `showBottomScheduleGroupControls`. Eight documentation files: both histories kept (0.85.312 recovery entries and all 0.85.313 development entries); no entry removed.
- Note: the originally approved final regression commit `0d46d7703` was amended before push into `e7b6059e8` (identical tree; `git diff 0d46d7703 e7b6059e8` is empty).
- Verification (automated): frontend 13 test files, 140/140 pass; backend default run 178 tests (165 pass, 13 environmental failures: missing DB environment variables, none are code defects); backend with isolated throwaway in-process variables 238/238 pass; Vite production build passes; security gate `SECURITY_GATE_PASS`; all 37 `backend/api/users.js` routes present and in identical order to `0.85.113`, `BETA` before merge and baseline `bf66ec03e`.
- Safety: no database change, migration, package/version change, server restart or deployment; PlanID #5 untouched; all 13 Git stashes preserved; no force push or branch deletion.
- User acceptance: PENDING. Browser acceptance and the live-database index verification have not been performed. An automated pass is not user acceptance. Open audit items unchanged: conversion engine writes compatibility names as labels for repeated day names, dormant `PUT /workout-schedules/:id/groups`, session label fallback.
