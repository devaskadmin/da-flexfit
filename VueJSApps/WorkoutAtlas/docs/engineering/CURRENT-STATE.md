# WorkoutAtlas Current State

**Purpose:** First detailed status document for AI agents.

## Application status

- Product: WorkoutAtlas
- Package versions: frontend `0.85.308`; backend `0.85.308`
- Branch: `BETA`
- Latest verified HEAD: `b7a4481702201de0b6577591828d965cb418b4c4`
- Branch relationship: ahead of `origin/BETA` by 3 commits; exact upstream state is not a release acceptance claim.
- QA checkpoint: `0.85.309`
- Release phase: live acceptance pending
- Local development: frontend and backend have been observed reachable on ports 5173 and 5000
- Production status: UNVERIFIED in this repository documentation
- Last evidence update: 2026-11-18

## Current work

- Active workstream: `0.85.309` live acceptance closeout plus approved UI implementation follow-up.
- Last completed task: `DEVOPS-DOCS-002`, enterprise AI onboarding validation and backlog synchronization.
- Previously completed task: `DEVOPS-DOCS-001`, enterprise documentation and AI governance consolidation.
- Current blockers: publish/unpublish live persistence replay, Featured registration data, live role write mutations, ExerciseScope mutations, live two/third-session verification, and `WA-UI-TABLET-001` tablet Find Plans responsiveness remain blocked or acceptance-pending.
- User acceptance outstanding: 0.85.309 release acceptance.
- Next authorized action: complete the live 0.85.309 acceptance gates after explicit disposable scope; the next targeted UI implementation task is `WA-UI-TABLET-001 — Tablet Find Plans responsiveness` after implementation approval.

## Protected data and constraints

- Never modify PlanID `5` — Stephen K – Lean Muscle.
- Never modify existing personal workout history or existing paused sessions.
- Do not change non-disposable Global plans or production accounts.
- Database migrations, database writes, destructive cleanup, server restart, push, deployment, and infrastructure changes require explicit authorization.
- This repository currently has no authorized database or destructive-test scope for this documentation task.

## Release-state definitions

- **CODE IMPLEMENTED:** source behavior exists and is traceable to code.
- **AUTOMATED TESTS PASSED:** project-owned or targeted automated evidence passed; not user acceptance.
- **LIVE TESTED:** an authenticated browser/API environment performed the workflow.
- **USER ACCEPTED:** explicit user approval for a workflow or release state.
- **RELEASED:** deployment/release was separately authorized and verified.

Current evidence: implementation and automated coverage exist for many areas. Live evidence exists for planning discovery/copy, timer/start/completion, history correction/deletion, preview, and mobile layout. Several acceptance gates remain unresolved. 0.85.309 is **not user accepted**.

## Canonical references

- Backlog: [../backlog/BACKLOG.md](../backlog/BACKLOG.md)
- Session handoff: [SESSION-HANDOFF.md](SESSION-HANDOFF.md)
- QA checkpoint: [../qa/releases/0.85/0.85.309.md](../qa/releases/0.85/0.85.309.md)
- Architecture: [../architecture/SYSTEM-ARCHITECTURE.md](../architecture/SYSTEM-ARCHITECTURE.md)
- Database: [../database/SCHEMA.md](../database/SCHEMA.md)
- Product history: [../../CHANGELOG.md](../../CHANGELOG.md)

## UI corrective closeout

- `WA-UI-TABLET-001` implementation is code complete and automated/browser verification passed.
- Find Plans uses cards at 769–1024px and preserves the desktop table above 1024px.
- Automated and live read-only viewport evidence does not replace explicit user acceptance.

## Restored-code verification audit - 2026-11-21

- Verification HEAD: `6dbf903b1e7ae1dd4e25fc34b07a1508fe6ed043`.
- Scope: read-only source verification; no application code, versions, migrations, server/database state, or protected data changed.
- `0.85.309` top-right Save button: FAIL — Save remains in the bottom primary-actions footer.
- `0.85.309a` Save-button alignment: FAIL — no top-right Save implementation or alignment correction found.
- `0.85.311` recording type, field ordering, layout, More/Less, tags: PASS — source trace and focused tests passed `5/5`.
- `0.85.312` bottom Add Day/Add Week controls after one day/week and two exercises: MISSING — no matching implementation or commit found.
- No live user acceptance is inferred; no 0.85.313 implementation was started.

## 0.85.309a top Save alignment - 2026-11-21

- Implementation complete in `frontend/src/views/Member/WorkoutBuilder.vue`.
- Back to Plans is far left and Save is far right in one full-width row.
- Back and Save use identical `32px` height and `32px` line height for vertical alignment.
- Save retains `#15803D` background and `#FFFFFF` text.
- Create and Edit modes share the responsive row alignment; no backend or save-handler changes were made.
- Focused frontend contract tests passed `21/21`; Vite production build passed with `701` modules transformed.
- User acceptance remains pending. Do not begin 0.85.313 or any subsequent implementation.

## 0.85.312 bottom Add Day/Add Week controls - 2026-11-21

- Implementation complete in `frontend/src/views/Member/WorkoutBuilder.vue`.
- Bottom controls appear after at least one Day/Week and at least two exercises, remain outside accordion bodies, and reuse existing bottom/top handler validation and append behavior.
- Create and Edit modes share the implementation; the controls use `#15803D` with `#FFFFFF` text.
- Existing top controls, Add Exercise controls, Save behavior, recording-field layout, backend APIs, and database structures were unchanged.
- Focused contract suite passed `12/12`; touched Vue/test diagnostics passed; Vite production build passed `701` modules and generated `dist`.
- Live browser visual and interaction acceptance remains pending. Do not begin 0.85.313.

## 0.85.311 FIX - Consolidated recording implementation - 2026-11-21

- Shared utility now uses Recording Type exclusively for field ordering and preserves independent Workout Type badges.
- Builder/session components retain exactly three horizontal fields per row, LBS labels, and 44px More/Less controls.
- Empty workout tags are hidden; valid Strength/Cardio/Other values remain Workout-Type-derived.
- 0.85.309/309a Save controls and 0.85.312 bottom schedule controls were preserved.
- Focused recording/builder tests passed `19/19`; touched diagnostics passed; Vite build passed `701` modules.
- Live visual acceptance across Create/Edit/View/preview/log/active/resume/history/mobile remains NOT VERIFIED.
- User acceptance remains pending; do not begin 0.85.313 or 0.85.315.

## 0.85.312 recovery checkpoint - 2026-11-21

- 0.85.309 top Save: implementation complete; automated contract/build verification passed; live acceptance pending.
- 0.85.309a Save alignment: implementation complete; Back-left/Save-right 32px controls verified by source/contracts; live acceptance pending.
- 0.85.311 FIX: recording utility/component corrections complete; focused tests passed `19/19`; live surface/viewport acceptance NOT VERIFIED.
- 0.85.312 bottom Add Day/Add Week: implementation complete; focused 12/12 coverage and build passed; live create/edit/week/collapsed/mobile acceptance pending.
- 0.85.313: TODO; no implementation authorized or started.

## 0.85.313 baseline verification - 2026-11-21

- Verification scope: read-only baseline only; no application code, database, migration, server, package, or protected-data changes.
- Branch requested: `0.85.113.RESET`; actual checked-out branch: `0.85.113` tracking `origin/0.85.113`. HEAD: `0fbf3b293cc6fb6363cac2922894bfc098c81bed`, commit subject `0.85.113.RESET`. Branch-name verification is therefore **FAIL**.
- Restored baseline: **PASS**. The reset HEAD tree is identical to BETA HEAD `df1f026d506c50456b477e0777a98bb55c2e1977` (`0.85.312 - Recovery checkpoint for 0.85.309 through 0.85.312`); direct tree diff is empty.
- Package versions remain frontend/backend `0.85.308`.
- Working tree: clean, with no tracked or staged changes. Status was `## 0.85.113...origin/0.85.113`.
- `backend/api/users.js`: `4,768` lines; route inventory: `37` router definitions.
- API route inventory (corrected in Stage 1/10): 4 user/profile; 14 `workout-schedules`; 5 featured/global; 9 admin global/user plan; 4 `workout-planner`; 1 `has-saved-workout-list` = 37. Exact method/path inventory is preserved in the session handoff.
- Week/day assignment exists in normalized planner payloads and `workout_schedule_groups`: day/week labels, label validation, group order entries, active schedule mode, and each exercise `scheduleGroup`.
- Storage mechanism: MySQL `workout_schedules`, `workout_schedule_groups`, and `workout_schedule_exercises`; replacement logic deletes and re-inserts groups/exercises for schedule updates.
- Existing frontend assignment functions in `WorkoutBuilder.vue`: `normalizeGroupKey`, `getScheduleGroupId`, `resolveScheduleGroupNameFromId`, `toggleScheduleGroupAccordion`, `addScheduleGroupFromValue`, `addScheduleGroup`, `addScheduleGroupBottom`, `duplicateScheduleGroup`, `moveScheduleGroup`, and `removeScheduleGroup`.
- PlanID `5` protection remains enforced; no PlanID 5, personal history, paused session, database row, migration, or production data was changed.
- Baseline verdict: branch-name mismatch is confirmed; restored baseline, route/API inventory, assignment/storage findings, and working-tree state are verified; no implementation work starts until approval.

## 0.85.313 Stage 1/10 verification - 2026-11-21

- Branch `0.85.113.RESET`: **FAIL**. Checked-out branch is `0.85.113` (tracks `origin/0.85.113`); no local or remote branch named `0.85.113.RESET` exists. HEAD `0fbf3b293cc6fb6363cac2922894bfc098c81bed` has commit subject `0.85.113.RESET`.
- Baseline `0.85.312`: **PASS**. `git diff` between HEAD and BETA `df1f026d506c50456b477e0777a98bb55c2e1977` (`0.85.312 - Recovery checkpoint for 0.85.309 through 0.85.312`) is empty.
- `backend/api/users.js`: **4,768 lines**; **37 route definitions** (`router.get|post|put|patch|delete`).
- Working tree: no source changes; only documentation files modified by these verification records. Package versions remain `0.85.308`.
- No application, database, migration, server, or PlanID 5 change. STOP; Stage 2 requires approval, and the branch-name mismatch needs a user decision.

## 0.85.313.a1 Default Week Initialization - 2026-11-21

- Branch `0.85.113` accepted as the working branch by user direction; HEAD `0fbf3b293cc6fb6363cac2922894bfc098c81bed`; package versions remain `0.85.308`.
- Implemented in `frontend/src/views/Member/WorkoutBuilder.vue`: `createWorkoutPlan` initializes `weekGroups = ['Week 1']` (orders, identity map, and accordion synced). Day mode stays default; Day View stays empty.
- Existing/saved plans (`hydratePlanner`), `resetPlannerDraft`, week names, and assignments are unchanged.
- Focused contract suite passed `14/14`; Vite build passed; `users.js` retains `37` routes with no diff.
- No backend, database, migration, UI redesign, PlanID 5, or protected-data change. Live browser acceptance PENDING.

## 0.85.313.a2 Default Day Assignment (Stage 3/10) - 2026-11-21 - SUPERSEDED by 0.85.313.a2.1

- Stage 2 (0.85.313.a1) committed as `97397e075` and pushed to `origin/0.85.113`; Stage 3 changes are uncommitted.
- `hydratePlanner` in `WorkoutBuilder.vue` assigns exercises with no schedule group, in memory only, to `Week 1` (existing `Week 1`, else first existing week, else new `Week 1`) via `frontend/src/utils/workoutDefaultWeekAssignment.mjs`.
- Valid assignments, custom week names, exercises, and recording values preserved; duplicates prevented; no auto-save on load.
- Tests: helper suite `7/7`, builder contract suite `14/14`; Vite build passed (`702` modules); `users.js` `37` routes, no backend/package diff.
- Limitation: no day-to-week link exists in the data model; no live browser verification. User acceptance PENDING. Do not begin 0.85.313.a3.

## 0.85.313.a2.1 Correct Day Assignment - 2026-11-21

- Corrects Stage 3 (frontend only): whole workout days, not exercises, are assigned to weeks via an in-memory `dayWeekAssignments` mapping in `WorkoutBuilder.vue` (`frontend/src/utils/workoutDayWeekAssignment.mjs`).
- Unassigned days default to `Week 1` or the first existing week; valid assignments, day names, exercises, group labels, and recording values preserved; no `Week 1` day card or week is created by assignment.
- Not persisted, not in dirty state or save payload; no save on load. Backend persistence not begun.
- Tests: new suite `11/11`, builder contract `14/14`; Vite build passed (`702` modules); `users.js` `37` routes, no backend/package diff; Stage 3 changes uncommitted.
- Limitations: mapping invisible in UI and lost on reload until persistence exists; no live browser verification. User acceptance PENDING.

## 0.85.313.a3 Persist Day-to-Week Assignments - 2026-11-21

- Stage 3 pushed first (`71c1048a8`). Assignments persist in `workout_schedules.settings_json` (`dayWeekAssignments` key) via `PUT /api/workout-planner`; restored from `planner.settings.dayWeekAssignments` on load. Helper: `backend/utils/workoutPlanSettings.js`; `users.js` +23 lines, 37 routes unchanged and in the same order.
- Backend uses the column only if `information_schema` shows it; no `ALTER`/migration; other settings keys preserved; non-object stored JSON never overwritten.
- Frontend restores then reconciles (default Week 1 / first week), initializes `Week 1` if a loaded plan has no weeks, sends assignments in the payload, and tracks them in unsaved-change detection.
- Tests: frontend `28/28`, backend new suite `11/11` (fixture), syntax clean, Vite build passed (`702` modules).
- Limitations: needs `settings_json` in the target DB; unsaved custom week names are not persisted by the backend so such assignments fall back to the default week; global/clone paths do not write assignments; no live verification. Changes uncommitted; acceptance PENDING. Do not begin Stage 5.

## 0.85.313.a3.1 Database Verification - 2026-11-21

- `workout_schedules.settings_json` is VERIFIED in the `stephenk_flexfit` schema (user-run read-only query, phpMyAdmin): `longtext`, nullable (`YES`), default `NULL`. The agent had no direct DB access, so no query ran from the agent side.
- Indirect evidence: repository backups `0.76` and `0.83` define it as nullable `longtext utf8mb4_bin` with a `json_valid` check.
- a3 persistence can now activate against this schema. Browser save and reopen acceptance is still PENDING, and other environments (for example production) are unchecked. No code, schema, data, or package change. STOP; do not begin Stage 5.
- The first user run returned zero rows only because `information_schema` was the selected database (`DATABASE()` mismatch); the re-run without `DATABASE()` returned the column.

## 0.85.313.a3.2 Preserve Day and Week Groups - 2026-11-21

- Saving a plan now keeps both group sets. `backend/utils/workoutPlanGroups.js` syncs day (`day`/`any`/`section`) and week (`week`) groups in place, preserving group IDs, names and order; removals are limited to groups the client removed; legacy duplicates collapse. Sets the client did not send, and placeholder-only empty sets, are untouched. Wired in through `replaceScheduleGroupsAndExercises` in `users.js` (shared by convert, clone and global save). 37 routes unchanged and in the same order.
- Tests: backend `21/21` (groups) and `11/11` (settings), frontend `29/29`, Vite build passed. No schema change, migration, data write or package change; PlanID 5 untouched.
- Open: other readers count all groups regardless of type (`workout-log.js` day ordering, `dashboard.js` weekly target, plan list `group_count`); exercise row IDs still regenerate per save; no live or browser verification. Changes uncommitted (a3/a3.1 are pushed as `1e8fa6818`). Acceptance PENDING; do not begin Stage 5.

## 0.85.313.a3.3 Schedule Group Filtering - 2026-11-21

- Week containers are no longer counted as workout days. Shared rule in `backend/utils/workoutScheduleGroupFilter.js`: day-mode plans use every group type except `week`; legacy Week View plans (`schedule_mode = 'week'`) keep their week groups.
- Applied to Workout Log `GET`/`PUT /day-order` (`workout-log.js`), dashboard `weeklyTarget` (`dashboard.js`) and the global plan-list `day_count`/`group_count` subquery (`users.js`). Save logic, UI and routes unchanged (`users.js` 37, `workout-log.js` 14, `dashboard.js` 3, same order).
- Tests: new suite `24/24`, groups `21/21`, settings `11/11`, frontend `29/29`, Vite build passed. No schema change, migration, data write or package change; PlanID 5 untouched.
- Open: SQL not run on real MySQL locally; day-mode plans with only weeks now show 0 days; add-exercise default group and `workout-sessions.js` day lookups still unfiltered; no live or browser verification. a3.2 and a3.3 were accepted and pushed as `20fefbfff`. Acceptance PENDING; do not begin Stage 5.

## 0.85.313.a3.4 Global Plan Persistence - 2026-11-21

- Day-to-week assignments (`settings_json` -> `dayWeekAssignments`) now persist on global/featured/community create and edit (`PATCH /admin/global-workout-plans/:id/schedule`), global adopt (`/global-workout-plans/:id/use`), featured clone (`/featured-workout-plans/:id/clone`), plan-type conversion and the register-time featured copy (`auth.js`). All reuse `persistDayWeekAssignments`, run inside the existing transaction and are a no-op when the column is absent. Frontend unchanged. `users.js` 37 routes unchanged and in order.
- Tests: new `workout-plan-global-persistence` `11/11`, settings `11/11`, groups `21/21`, group filter `24/24`, frontend 7 files pass, Vite build passed. No schema change, migration, data write or package change; PlanID 5 untouched.
- Open: new calls not run on real MySQL; `settings_json` required in each target DB; register/conversion integration suites not runnable locally; no live or browser verification. a3.4 committed and pushed as `f34e9eab1`. Acceptance PENDING.

## 0.85.313.a4 Unified Schedule Planner (Stage 5/10) - 2026-11-21

- Create/Edit Workout Plan no longer has Day View / Week View tabs. `WorkoutBuilder.vue` shows one Schedule Planner of workout day cards. Frontend only; nothing above Workout Plan Information and no backend, DB or package change.
- Unchanged: Add Day, Add Exercise, bottom controls, Save. The builder already always ran in day mode, so the payload still carries both group sets, orders, `settings.dayWeekAssignments` and exercises. No week dropdown or Rename Week yet (later stage); weeks and assignments are saved but not editable in the UI meanwhile.
- Tests: new contract suite `8/8`, all 8 frontend test files pass (70 tests), Vite build passed. PlanID 5 untouched.
- Open: no browser check of layout; inert `.planner-mode-*` CSS remains; a4 committed and pushed as `5ffa3132b`. Acceptance PENDING.

## 0.85.313.a5 Week Selection Dropdown (Stage 6/10) - 2026-11-21

- The Schedule Planner has a Week dropdown above Add Day and the day cards (below Workout Plan Information). Options are the plan's existing weeks; `Week 1` is shown as `Week 1 (Default)` but stored as `Week 1`; default selection is Week 1, else the first week. Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`); no backend, DB or package change.
- The selection is UI state only: not saved, not in the dirty snapshot or draft, and it does not filter or edit days, weeks, assignments or exercises. No day filtering, Add Week or Rename Week yet.
- Tests: new contract suite `7/7`, util suite `18/18`, all 9 frontend test files pass (81 tests), Vite build passed. PlanID 5 untouched.
- Open: no browser check; selection has no visible effect until filtering is added; a5 committed and pushed as `317087e56`. Acceptance PENDING.

## 0.85.313.a6 Add Week (Stage 7/10) - 2026-11-21

- A `+ Add Week` button sits beside the Week dropdown. It is enabled only when the selected week has at least one workout day with at least one exercise (selected week's assignments only). It appends the next unused `Week N` (from Week 2), selects it, and the new week starts empty. Existing weeks, days, exercises, assignments and unsaved changes are untouched; switching weeks is never gated. Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`); no backend, DB or package change. No Rename Week or day filtering yet.
- Tests: new contract suite `8/8`, util suite `24/24`, all 10 frontend test files pass (95 tests), Vite build passed. PlanID 5 untouched.
- Open: no browser check; no UI assigns days to weeks, so a new week stays empty and Add Week is disabled while it is selected; empty-week persistence unverified on a live DB; a6 committed and pushed as `a222c3228`. Acceptance PENDING.

## 0.85.313.a7 Rename Week (Stage 8/10) - 2026-11-21

- A three-dot menu beside the Week dropdown has **Rename Week**, which opens an inline editor (same styling and validator as the day inline rename; there is no Rename Day modal). Names may contain spaces, apostrophes and hyphens (day character rules, max 60); empty and case-insensitive duplicate names are rejected. The renamed week keeps its position, assigned days, in-builder identity and selection; exercises and days are untouched; no duplicate is created. Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`); no backend, DB or package change. No day filtering yet.
- Identity limitation: week identity is not persisted. The backend matches week rows by label, so a saved rename replaces the week's group row with a new one (new group id); contents are re-linked in the same save. Unverified on a live DB.
- Tests: new contract suite `9/9`, util suite `29/29`, all 11 frontend test files pass (109 tests), Vite build passed. PlanID 5 untouched.
- Open: no browser check; group-id behavior on a saved rename unverified; no UI assigns days to weeks; a7 committed and pushed as `bf66ec03e`. Acceptance PENDING.

## 0.85.313.a8 Week Filtering and Day Assignment (Stage 9/10) - 2026-11-21

- The Schedule Planner shows only the day cards assigned to the selected week (days with no saved assignment count as the default week). New days from both the top and bottom Add Day controls are assigned to the selected week; a new week shows an empty schedule. Switching weeks only changes the display: unsaved days, exercises, recording values and assignments are untouched, and the save payload still carries every week. Move up/down, first/last checks and the bottom controls follow the visible days; the Preview still lists the whole plan. Frontend only (`WorkoutBuilder.vue`, `workoutDayWeekAssignment.mjs`); no backend, DB or package change.
- BLOCKER (reported, not worked around): identical day names in separate weeks are not supported. A day is identified by its name alone (day list, exercise `scheduleGroup`, assignment keys, backend label matching), so same-named days would merge. Needs a day id or week-qualified key in the payload and backend. Duplicates stay rejected across weeks, with a message naming the other week.
- Tests: new contract suite `12/12`, util suite `35/35`, all 12 frontend test files pass (127 tests), Vite build passed. PlanID 5 untouched.
- Open: no browser check; the identical-name blocker (resolved by a8.1); week id not persisted on rename; no UI moves an existing day to another week; a8 committed and pushed as `a64c21cf0`. Acceptance PENDING; do not begin Stage 10.

## 0.85.313.a8.1 Schedule Identity Correction - 2026-11-21

- Same day names now work in separate weeks. Groups are identified by their existing `workout_schedule_groups.id`; labels are display only. No migration, schema change, production data write or package change; PlanID 5 untouched.
- Backend: planner saves accept `dayGroupEntries` / `weekGroupEntries` and an exercise `scheduleGroupKey` and sync by id only (a rename keeps the id); a label-only payload keeps the old label path. `settings_json` also stores `dayWeekAssignmentsById` next to the legacy label map (unique labels only). The planner `GET` returns the entries plus unique compatibility names for repeated labels, so label-keyed readers are unchanged. 37 `users.js` routes and their order preserved.
- Frontend: `WorkoutBuilder.vue` keeps a unique key, a display label and the saved id per day; duplicates are rejected only inside the same week; renames keep id, week and exercises; the payload carries entries and the saved ids are adopted after saving.
- Tests: backend focused suites `78/78`; full backend 132 pass / 45 fail (all `Cannot find module 'express'/'mysql2'`, not installed here); frontend 13 files / 140 tests pass; Vite build passed.
- Open: no browser check; live DB index state unverified; label-keyed readers see compatibility names for repeated labels; `PUT /workout-schedules/:id/groups` and the conversion engine still use the label path; a8.1 uncommitted. Acceptance PENDING; do not begin Stage 10.
