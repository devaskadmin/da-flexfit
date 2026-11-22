# WorkoutAtlas Batch Results

## 0.85.309 - Top Save button implementation - 2026-11-21
- Scope: add one additional Save control above Workout Plan Information in Create and Edit Plan modes only.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`; `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`; `CHANGELOG.md`; `docs/qa/releases/0.85/0.85.309.md`.
- Implemented behavior:
	- Back to Plans remains on the left and Save is right in a full-width, same-row control strip.
	- Save uses `#15803D` background and `#FFFFFF` text.
	- Both controls call the existing `handlePrimarySave` handler and share existing duplicate-submission disabling.
	- Existing bottom Save controls and all save/publish validation paths remain intact.
- Automated verification: focused contract suite passed `20/20`.
- Production build: PASSED after dependency restoration; Vite `4.5.9` transformed `701` modules and generated `dist` successfully.
- User acceptance: PENDING. Live browser verification of Create Plan, Edit Plan, responsive row alignment, validation, and publishing behavior remains required.

## 0.85.309 - Final functional QA and release-readiness investigation
- Scope: verification-first 0.85 final acceptance audit without feature changes, server restarts, migrations, production mutations, deployment, or protected-data changes.
- Repository baseline:
	- Branch: `BETA`
	- HEAD: `ecb2b654ec40d1211bcec53f79fb61ac33bc1ada`
	- Backend version: `0.85.308`
	- Frontend version: `0.85.308`
	- Branch relationship: ahead 2 commits from `origin/BETA`
	- Tracked working-tree changes: none
	- Preserved untracked `.artifacts/` QA screenshots and existing unrelated untracked state.
- Runtime availability:
	- Existing backend listener on port `5000`: not reachable
	- Existing frontend listener on port `5173`: not reachable
	- Existing API probe on `http://localhost:3000/api/config`: HTTP unavailable
	- No server restart was performed and no database migration or production-data mutation was executed.
	- Browser pages were not shared, so live authenticated browser replay was not possible in this audit.
- Automated regression evidence:
	- Backend full suite: `160/160` passed, `0` failed.
	- Project-owned frontend Node tests: `29/29` passed, `0` failed.
	- A broad recursive frontend command accidentally discovered third-party `node_modules/html-to-md` tests and reported `46` dependency failures due to missing package source-module resolution; this was excluded from the project result and not treated as an application defect.
	- Frontend production build: passed.
	- Vue diagnostics: no errors found.
- Existing implementation evidence retained in repository records:
	- Featured-registration tests cover selected-plan copy, source preservation, no-selection registration, invalid/ineligible plans, and rollback.
	- Session recovery tests cover two simultaneous unfinished sessions, third-session blocking, paused-session counting, independent pause/resume/completion, and orphan-plan recovery.
	- History tests cover completed editing/deletion/date correction, strict HTTP validation, and local date-only formatting.
	- Plan conversion tests cover source preservation, authorization, and blocked draft conversion.
	- ExerciseScope tests cover CUSTOM defaulting, scope visibility, role authorization, and image/media safety.
	- Prior live authenticated evidence covers mobile preview and multiple responsive breakpoints, but several live workflows remain environment-dependent.
- Pending live verification:
	- Disposable Plan Builder create/edit/publish/unpublish/convert/copy actions.
	- Live featured-plan registration, retry duplicate prevention, and owner/PlanID confirmation.
	- Live role/authorization matrix for trainer/admin/member Global and ExerciseScope operations.
	- Real authenticated start/pause/resume/complete/session-limit/orphan cleanup flows.
	- Live 320–1366 mobile matrices for all critical screens.
	- Gateway exercise/plan cover delivery and missing-image fallbacks with a live authenticated runtime.
- Protected data:
	- PlanID `5` — `Stephen K – Lean Muscle` was not modified.
	- The existing paused Monday Cardio session was not mutated or ended.
- Manual content checklist remains separately outstanding: finish At-Home Full Body no-equipment and dumbbell variants, add missing exercises, add/approve Assisted Pull-Up Machine SYSTEM exercise and image, finish and publish approved remaining Global plans.
- Classification:
	- Confirmed software BLOCKER: none confirmed in this audit.
	- PENDING VERIFICATION: live authenticated workflows and Gateway browser verification due unavailable runtime/browser context.
	- CONTENT: workout-plan/exercise content checklist items.
	- NON-BLOCKING: none newly confirmed; existing i18n missing-key warnings are already recorded in prior release entries.
- Release verdict: `PENDING`; 0.85 is not claimed ready or user accepted until the live authenticated acceptance matrix is completed in an authorized runtime.
- Exact next action: start or expose an authorized local/staging runtime and authenticated disposable test identities/browser context, without resetting services or modifying production data; then rerun the live acceptance matrix. If no blocker is found, perform final acceptance and document 0.85.309 before any later commit or deployment decision.

## 0.85.308 - Mobile workout plan preview compaction and readability polish
- Scope: deliver mobile UX improvements for read-only Workout Plan preview without changing planner management workflows or backend contracts.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`, `frontend/src/utils/workoutPreviewDescription.mjs`, `frontend/src/utils/workoutPreviewDescription.test.mjs`, `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Description toggle behavior:
	- Mobile (`<=800px`): description collapses to approx. 140 chars with word-boundary truncation and ellipsis.
	- Toggle is an accessible text-link button (`Show Details` / `Show Less`) with `aria-expanded` and `aria-controls`.
	- Desktop (`>800px`): full description shown, no toggle.
	- Empty description: description section omitted.
	- Toggle reset: on plan switch, preview open/close transition, and viewport transition back to desktop.
- Mobile metadata behavior:
	- Compact `Label: Value` layout rendered in `.global-library-inline-preview__meta-grid--compact`.
	- Two-column compact grid on typical mobile/tablet widths with adaptive single-column fallback at very narrow widths.
	- Empty optional fields (for example Difficulty) are omitted from compact rendering.
- Schedule/readability behavior:
	- Exercise image + name alignment preserved.
	- No page-level horizontal overflow in tested viewports.
	- No internal exercise-list or exercise-row horizontal scrolling in tested viewports.
	- Added mobile-safe preview bottom padding so fixed bottom navigation does not overlap bottom preview actions after deep scrolling.
- Authenticated browser verification:
	- Viewports validated: `320, 375, 390, 430, 600, 650, 768, 800, 1024, 1366`.
	- Browser scale telemetry during validation: `devicePixelRatio=1`, `visualViewport.scale=1` (100% scale).
	- Long-description plan (`Maintain Health – Total Body Wellness`) validated for collapsed and expanded states.
	- Empty-description plan (`Muscle Building - Beginner Full Body`) validated to render no description section and no toggle.
	- Entry points validated: My Plans view action and Find Plans global preview action both open the same read-only preview surface.
- Screenshot evidence:
	- `.artifacts/0.85.308-preview-collapsed-320.png`
	- `.artifacts/0.85.308-preview-collapsed-390.png`
	- `.artifacts/0.85.308-preview-collapsed-600.png`
	- `.artifacts/0.85.308-preview-collapsed-800.png`
	- `.artifacts/0.85.308-preview-collapsed-1366.png`
	- `.artifacts/0.85.308-preview-expanded-390.png`
- Automated checks:
	- Frontend targeted tests: `29/29` pass.
	- Frontend production build: pass.
	- Backend plan-management regressions: `38/38` pass (`workout-plan-template`, `workout-plan-conversion-engine`, `workout-plan-cover-service`, `workout-plan-cover-storage`).
- Caveats:
	- Current dataset did not expose a non-empty short-description plan or a visible community/personal-published preview entry in this session; short-description no-toggle behavior is covered by utility tests.
	- Existing non-blocking i18n missing-key warnings remain unchanged.

## 0.85.307.a1 - Workout Log HTTP 400 corrective repair
- Scope: complete corrective follow-up for Workout Log history-path `HTTP 400` failures while preserving strict backend contract validation and protected paused-session integrity.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `frontend/src/views/Member/LogWorkout.history-contract.test.mjs`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Root-cause evidence:
	- History-tab transition previously invoked write path (`openHistoryTab -> flushWorkoutSetProgressPersistence -> persistWorkoutSetProgress -> POST /api/workout-log/session`) in a read-only interaction.
	- Backend correctly rejected malformed write payloads missing `exercises` with `400 { "error": "exercises array is required." }`.
- Corrective behavior changes:
	- Removed history-tab write flush side effect; opening Workout Log now stays read-only (`activeTab` switch + `loadWorkoutHistory`).
	- Normalized selected workout date state to `YYYY-MM-DD` during session activation/completion to avoid ISO timestamp drift in history query date parameters.
	- Added source-contract regression guard (`LogWorkout.history-contract.test.mjs`) asserting history-tab logic does not call persistence flush.
- Live authenticated verification outcomes:
	- Disposable Tuesday cardio session completed and immediately rendered in Workout Log for selected date.
	- Date correction edit moved a completed entry from `2026-11-18` to `2026-11-17` with no duplicate remaining on the original date.
	- Cancel edit path reverted to view state without save modal or unintended data mutation.
	- Delete flow showed confirmation modal, executed delete, showed success modal, and recalculated date summary/history to zero records for `2026-11-18`.
	- Protected paused Monday session remained `In Progress` with `Resume Workout` entry intact after corrective replay.
- Network evidence after clean log reset:
	- Workout-log API calls: `total=13`, statuses `200=8`, `201=5`, `400=0`.
	- Endpoint mix observed: `POST /api/workout-log/session` (5), `GET /api/workout-log/history` (6), `PUT /api/workout-log/history/session/:id` (1), `DELETE /api/workout-log/history/session/:id` (1).
- Responsive matrix verification:
	- Widths checked: `320, 375, 390, 430, 650, 768, 800, 1024, 1366`.
	- Programmatic viewport checks reported no horizontal overflow at all required widths; tablist/date/start controls remained discoverable.
- Automated checks:
	- Frontend corrective regression test: `1/1` pass (`node --test src/views/Member/LogWorkout.history-contract.test.mjs`).
	- Previously completed batch checks retained in session context: frontend targeted tests `19/19`, backend targeted suites `32/32`, backend full suite `160/160`, frontend build passed.
- Caveats: Existing i18n missing-key console warnings remain non-blocking and unchanged by this corrective patch.

## 0.85.307 - Historical workout management and date integrity
- Scope: finalize Workout Log history management hardening for view/edit/delete/date-correction integrity while preserving completed-only mutation policy and existing history/session architecture.
- Files changed: `backend/api/workout-log.js`, `frontend/src/views/Member/LogWorkout.vue`, `backend/tests/workout-log-history-management.test.js`, `frontend/src/utils/workoutLogDateFormat.mjs`, `frontend/src/utils/workoutLogDateFormat.test.mjs`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Backend integrity changes:
	- History query now uses corrected session date when present: `COALESCE(wls.workout_date, wl.WorkoutDate)` for both filter and returned `workoutDate`.
	- History update date-correction path now updates by explicit edited `WorkoutLogID` set and retains session-id fallback update for legacy rows.
	- Completed-only edit/delete policy remains enforced.
- Authenticated browser workflow outcomes (A-H matrix):
	- A View history: PASS (completed session card and set tables render under Workout Log).
	- B Edit strength: BLOCKED (no completed strength session in this runtime dataset during replay window).
	- C Edit cardio: PASS (set value updated `15 -> 16` and persisted in rendered history).
	- D Correct date: BLOCKED in live browser replay due stale long-running backend process behavior; backend regression test path validates date-correction logic after patch.
	- E Delete completed history: PASS (delete confirmation modal, success modal, and history/stat recalculation to zero rows for date).
	- F Cancel edit: PASS (unsaved-changes confirmation shown; discard restored original values).
	- G Security unauthorized attempt: PASS (`curl http://localhost:5000/api/workout-log/history?date=...` without session returned `401 Unauthorized`).
	- H Date formatting/time-zone behavior: PASS in automated coverage (`workoutLogDateFormat` tests) and browser labels show readable weekday/date formatting.
- Responsive matrix verification:
	- Widths: `320, 375, 390, 430, 650, 768, 800, 1024, 1366`.
	- Programmatic viewport checks reported `horizontalOverflowPx: 0` at all required widths.
	- Tablist/action regions remained visible and no blocking modal overlays were present during probe.
- Automated checks:
	- Backend targeted history suite: `17/17` pass (`node --test tests/workout-log-history-management.test.js tests/workout-log-history-visibility.test.js tests/workout-history-daily-summary.test.js`).
	- Previously completed batch gates retained: backend full suite `160/160`, frontend targeted date/timer tests `18/18`, frontend production build passed.
- Caveats:
	- Live browser date-correction verification remained environment-limited by stale process state in this session; patched backend logic is verified by regression tests and source-level update/query alignment.

## 0.85.306 - Workout plan preview responsive redesign and planner action cleanup
- Scope: redesign Workout Plan Preview for responsive readability and clean up duplicate schedule-planner actions without changing existing save/publish back-end semantics or protected plan data.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Behavioral outcomes:
	- Replaced preview table/card split with unified responsive exercise rows (`global-library-inline-preview__exercise-row` family) to eliminate clipping and horizontal overflow at narrow widths.
	- Objective/Goal preview blocks now render only when populated.
	- Planner actions consolidated: removed header duplicate Save Changes, removed planner quick-save duplicates, removed bottom duplicate add-day editor, and removed bottom duplicate kebab action menu.
	- Bottom day-level add exercise is now contextual (`day.exercises.length > 1`) and relabeled `Add Exercise to End`.
- Responsive/browser verification (authenticated session):
	- Width matrix verified: 320, 375, 390, 430, 650, 768, 800, 1024, 1366.
	- Programmatic geometry checks reported preview and schedule containers with `scrollWidth == clientWidth` and page overflow `0` at all tested widths.
	- Required screenshots captured for 320, 390, 800, 1366 during live validation.
	- Planner cleanup checks confirmed: `plannerQuickSaveActions=0`, `plannerBottomGroupActions=0`, single visible add-day control, single primary Save Changes action, and no bottom kebab anchor duplication.
- Automated checks:
	- Frontend timer/session tests: 11/11 passing (`node --test src/utils/workoutSessionTimer.test.mjs`).
	- Frontend production build: passed (`npm run build`).
	- Backend full suite: 155/155 passing (`npm test`).
	- Vue diagnostics on touched file: no errors.
- Caveats: Existing i18n missing-key warnings appeared in console and are pre-existing/non-blocking for this release scope.

## 0.85.305.a1 - Add Set solid blue corrective attempt #1
- Scope: corrective subversion for 0.85.305 to fix user-reported Add Set visual mismatch (dark interior + blue outline) without changing placement or workout behavior.
- Root cause (verified in live browser): Workout Log deep scope selector in `frontend/src/views/Member/LogWorkout.vue` overrode Add Set fill from `ExerciseSessionCard.vue` with `background: var(--wl-surface-2)`.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Browser computed evidence (before -> after):
	- `background-color`: `rgb(45, 54, 82)` -> `rgb(37, 99, 235)`.
	- `background-image`: `none` -> `none`.
	- `border-color`: `color(srgb 0.271257 0.466628 0.951205 / 0.581569)` -> `rgb(29, 78, 216)`.
	- `color`: `rgb(255, 255, 255)` -> `rgb(255, 255, 255)`.
	- `opacity`: `1` -> `1`.
	- `box-shadow`: `rgba(37, 99, 235, 0.28) 0px 1px 3px 0px` (preserved).
- Responsive verification (authenticated browser, Current Workout):
	- Widths checked: 320, 375, 390, 430, 650, 768, 800, 1024, 1366.
	- Computed Add Set background at all widths: `rgb(37, 99, 235)`.
	- Text color at all widths: white (`rgb(255, 255, 255)`).
	- No horizontal overflow, no Add/Complete overlap, no bottom-nav interference.
	- Alignment: Add Set and Complete Exercise are side-by-side at 375+; existing <=360 fallback stacks at 320 by prior-design mobile rule.
- Screenshot evidence:
	- `.artifacts/0.85.305.a1-add-set-320.png`
	- `.artifacts/0.85.305.a1-add-set-390.png`
	- `.artifacts/0.85.305.a1-add-set-800.png`
	- `.artifacts/0.85.305.a1-add-set-1366.png`
- Functional verification:
	- Current Workout: Add Set increased first exercise set total (`0/3` -> `0/4`), rendered new inputs, and retained editable weight/reps input behavior.
	- Preview state: Add Set did not mutate set rows in preview-only mode during this run (`delta: 0` in click probes), and no preview editing enablement changes were introduced.
	- Pause/resume controls remained functional and unchanged (`Pause/Play` state transitions preserved).
- Automated checks:
	- Frontend build: passed (`BUILD_OK`).
	- Frontend timer/session tests: 11/11 passing.
	- Backend full suite: 155/155 passing.
	- Vue diagnostics on touched frontend files: no errors.
- Caveats: This corrective patch intentionally avoids changing button placement/layout rules and does not modify backend/business logic, plan schema, or protected plan identifiers.

## 0.85.305 - Exercise scope ordering, plan preview action, and Add Set button styling
- Scope: complete targeted 0.85.305 fixes for Exercise Scope ordering/default behavior, My Plans preview action responsiveness, and Add Set blue styling while preserving 0.85.302-0.85.304 behavior and avoiding migrations/restarts.
- Files changed: `frontend/src/views/Member/exercises.vue`, `frontend/src/views/Member/WorkoutBuilder.vue`, `frontend/src/components/workout-session/ExerciseSessionCard.vue`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification:
	- Full backend suite passed (`npm test` in backend): 155/155 passing.
	- Frontend timer utility tests passed (`node --test src/utils/workoutSessionTimer.test.mjs`): 11/11 passing.
	- Frontend production build passed (`npm run build`).
	- Authenticated browser checks passed for Exercise Scope behavior on `/exercises`:
		- Create Exercise scope options order: Custom -> Shared -> System.
		- Create default selected scope: Custom.
		- Edit System exercise preserved selected scope: System.
- Behavioral outcomes:
	- Role-aware scope option ordering now matches expected hierarchy with Custom first.
	- My Plans blue-eye action now routes through existing read-only preview flow with preview context metadata and proper source-tab restoration behavior.
	- Add Set button now renders as a solid blue primary action while keeping the previously corrected mobile position and sizing behavior.
- Caveats: this authenticated admin dataset had no saved My Plans rows visible in the live table during verification, so direct row-level blue-eye click evidence in that tab is data-dependent in this run.

## 0.85.304 - Edit save/publish and conversion repair
- Scope: resolve P1 edit-flow regressions where Save Changes could silently no-op for personal draft-to-published transitions and Convert & Copy could appear non-responsive.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`, `backend/api/users.js`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification:
	- Targeted backend conversion engine tests passed (`node --test tests/workout-plan-conversion-engine.test.js`): 11/11 passing.
	- Frontend production build passed (`npm run build`).
	- Authenticated browser evidence captured:
		- Edit draft plan -> set Published -> Save Changes now issues `PUT /api/workout-planner` (200) and persisted status reads `active` via `GET /api/workout-schedules/:id`.
		- Convert modal `Convert & Copy Plan` is actionable without mandatory pre-preview and creates converted copy for active source.
		- Draft source conversion now opens required warning modal (`Workout Plan Must Be Published`) and network log confirms no conversion POST (`postConvertCalls: 0`).
- Behavioral outcomes:
	- Personal/community edit publish path now persists instead of dead-ending in global-only confirmation logic.
	- Save/transition failures are visible via warning modals instead of silent inline-only text.
	- Conversion path enforces published prerequisite in both frontend preflight and backend endpoint guardrail (`SOURCE_PLAN_NOT_PUBLISHED`).
- Caveats: full breakpoint matrix (320/390/430/768/800/1024/1366) was not fully replayed in this cycle; repaired save/publish and conversion behaviors were validated in live authenticated flow.

## 0.85.303 - Plan save, publish, and status reliability
- Scope: close Workout Builder reliability gaps for Save as Draft / Publish / Save Changes flows by confirming persisted status before success feedback, aligning transition options with backend behavior, and preventing first-save global publish downgrades.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification:
	- Full backend suite passed (`npm test`): 155/155 passing.
	- Frontend production build passed (`npm run build`).
- Behavioral outcomes:
	- Global workflow no longer forces first-save publish intent to draft.
	- Publication status options now respect plan type (global workflow vs personal workflow transitions).
	- Success/notice feedback now reflects backend-persisted status and displays via standardized result modal.
- Caveats: authenticated end-to-end browser replay for the full save/publish UX across all required breakpoints remains session-environment dependent in this run.

## 0.85.302 - Mobile-only button placement corrections
- Scope: apply mobile-only placement corrections for Current Workout and exercise-card action buttons at <=800px, preserving desktop layout and all workout behavior.
- Files changed: `frontend/src/views/Member/LogWorkout.vue`, `frontend/src/components/workout-session/ExerciseSessionCard.vue`, `frontend/package.json`, `backend/package.json`, `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`.
- Verification:
	- Frontend production build passed (`npm run build`).
	- Authenticated browser geometry checks passed with no horizontal overflow and no action overlap at 320/375/390/430/768/800/1024/1366 widths.
	- Mobile bottom action bar remained above fixed bottom navigation (not obscured) on 320/375/390/430 widths.
- Browser evidence: before/after 320 screenshots captured for Current Workout action areas; Start My Workout day-card footer actions verified at 320 with no overlap.
- Caveats: Add Exercise modal footer clipping could not be reproduced because the modal did not open from the current scripted session state in this run; modal CSS remained unchanged.

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

## 0.85.309 Live Acceptance Continuation - 2026-11-18
- Runtime: frontend listener `http://localhost:5173` and backend listener `http://localhost:5000` were reachable. Frontend configured API base was `http://localhost:5000`; demo member, trainer, and admin browser sessions authenticated successfully.
- PASS - disposable Plan Builder create: created `QA309 Disposable Plan` as PlanID `135`, added `QA Monday`, added `3/4 Sit-Up`, configured 3 sets and 10 reps, saved, and received the success modal. Refresh returned to the same Draft plan and preserved data.
- PASS - Plan Builder exercise and day controls: live browser verified adding a named day, adding an exercise, Sets/Reps editing, and consolidated save behavior.
- PASS - live Global discovery: Find Plans showed 5 published Global plans. All 5 were labeled Published and Source Global/Plan Type Global in the live 390px and 800px layouts.
- PASS - live Plan Preview: `Maintain Health – Total Body Wellness` opened read-only at 390px. It showed full schedule exercise names and compact metadata, `Show Details`/`Show Less` worked, and `documentElement.scrollWidth === clientWidth` was 390/390.
- PASS - live Global copy: authorized member copied `Maintain Health – Total Body Wellness` and received PlanID `136` plus `Workout Plan Added!`; the copy remained independently editable and appeared in My Plans.
- PASS - 390px/800px mobile geometry: no horizontal overflow was observed in Workout Planner Find Plans, Plan Preview, Workout Log, Exercise search, and bottom-navigation surfaces.
- PASS - workout lifecycle start: PlanID `135` started successfully and loaded `QA Monday`, `3/4 Sit-Up`, and set controls. The live timer displayed `00:00:00`/running values and increased during verification.
- PASS - pause/resume: live `/workouts` and `/workouts/135` surfaces exposed Pause and Play controls; Pause changed to Play, resume restored Pause, and timer progressed without duplicate timer rendering.
- PASS - set/exercise/completion: completing the disposable set/exercise/workout created a completed session. History displayed the completed session, `00:01:07`, one exercise, status Completed, and readable `Wednesday, November 18, 2026` date text.
- PASS - historical date correction: edited disposable workout date from `2026-11-18` to `2026-11-17`; save moved the record to the corrected date with no duplicate and recalculated the summary.
- PASS - historical deletion: confirmed deletion removed only the disposable QA309 record. The 11/17 summary became 0 completed sessions and `00:00:00`.
- PASS - HTTP 400 history regression: opening and switching Workout Log tabs generated no POST `/api/workout-log/session`; no `exercises array is required.` response appeared.
- PASS - ExerciseScope search visibility: member `/exercises` at 390px and 800px rendered System Exercise results with complete names and no overflow. Existing exercise card/preview images displayed in browser surfaces.
- PASS - role visibility: member Create Plan did not expose Global Plan; trainer and admin Create Plan views displayed `Global Plan (Shown to All)`.
- PASS - Gateway media fallback: `GET /api/media/default-workout-plan-image` returned HTTP 200 and valid JPEG content. Live `/api/media/workout-plans/135/cover` returned HTTP 401 without an authenticated media session, as required for protected access.
- BLOCKED - publish/unpublish live replay: controls loaded for the disposable plan but stale-loading/navigation behavior prevented a reliable live persisted status transition in this run. This is not treated as a confirmed defect and no live user acceptance is claimed.
- BLOCKED - two-session limit: only one independent disposable live session was created and completed. A separate second session and subsequent third-start rejection could not be safely exercised with available disposable records.
- BLOCKED - Featured registration: live `/api/featured-workout-plans` returned an empty `workoutLists` array. No safe uncontrolled registration account or Featured source was available, so live selected-plan copy/ownership/retry verification remains blocked.
- BLOCKED - trainer/admin live mutation: trainer and admin UI visibility passed, but no disposable server mutation or Featured mark/unmark mutation was performed.
- BLOCKED - ExerciseScope mutation: no shared-data disposable create/edit mutation was performed. Live search visibility and role UI visibility passed.
- NON-BLOCKING - localhost Google sign-in: origin/client-ID 403 warning; demo login remained functional.
- NON-BLOCKING - nutrition unrelated API failures: unrelated nutrition calls returned HTTP 500 during browser navigation; outside requested acceptance scope and not repaired.
- Protected data: PlanID 5 — Stephen K – Lean Muscle and the existing paused Monday Cardio session were not modified. Existing personal history was not edited or deleted except for the disposable QA309 record.

## 2026-11-21 - Restored-code verification-only audit
- Scope: verification only at restored `BETA` HEAD `6dbf903b1e7ae1dd4e25fc34b07a1508fe6ed043`; no application code or version changes.
- 0.85.309 top-right Save button: FAIL; Save remains in the bottom planner action footer.
- 0.85.309a Save alignment: FAIL; no top-right Save control/alignment implementation found.
- 0.85.311 recording type, field ordering, layout, More/Less, and tags: PASS; source trace and focused recording-field tests (`5/5`) confirm field normalization/order and controls, and Goal Tags source is present.
- 0.85.312 bottom Add Day/Add Week after one day/week and two exercises: MISSING; no matching implementation or commit exists. Existing bottom `Add Exercise to End` behavior does not satisfy the requirement.
- Live acceptance remains separate and unclaimed. 0.85.313 was not started.

## 0.85.309a - Top Save button alignment - 2026-11-21
- Scope: align the existing 0.85.309 top Save and Back to Plans controls for Create/Edit Plan without changing save behavior or backend code.
- Implemented:
	- Both controls share one full-width, vertically centered row.
	- Back to Plans remains far left; Save remains far right.
	- Back and Save use identical `32px` height and `32px` line height with centered content.
	- Save retains `#15803D` background and `#FFFFFF` text.
	- Create/Edit modes share the same CSS and remain single-line on desktop, tablet, and mobile.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`; `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`; `CHANGELOG.md`; `WORKOUTATLAS_BATCH_RESULTS.md`; `docs/engineering/CURRENT-STATE.md`; `docs/engineering/SESSION-HANDOFF.md`; `docs/qa/releases/0.85/0.85.309.md`; `docs/releases/RELEASE-READINESS.md`; `docs/engineering/DEVLOG.md`.
- Automated verification: focused frontend contract suite passed `21/21`.
- Production build: passed with Vite `4.5.9`; `701` modules transformed and `dist` generated successfully.
- Live browser acceptance: PENDING. Save functionality, validation, publishing behavior, and responsive geometry still require user verification.

## 0.85.312 - Restore bottom Add Day/Add Week controls - 2026-11-21
- Root cause: existing bottom state/handler code lacked a rendered bottom schedule editor and 0.85.312 visibility condition.
- Implemented: bottom Add Workout Day/Week controls now render after at least one active schedule and at least two unique exercises, outside accordion content, for Create and Edit modes.
- Functionality: reuses existing labels, validation, duplicate prevention, append behavior, Enter submission, and `addScheduleGroupBottom` handler. Top controls and Add Exercise controls remain unchanged.
- Styling: bottom button uses `#15803D` background and `#FFFFFF` text, with existing responsive editor layout.
- Files changed: `frontend/src/views/Member/WorkoutBuilder.vue`; `frontend/src/views/Member/WorkoutBuilder.preview-mobile-contract.test.mjs`; `CHANGELOG.md`; `WORKOUTATLAS_BATCH_RESULTS.md`; `docs/engineering/CURRENT-STATE.md`; `docs/engineering/SESSION-HANDOFF.md`; `docs/engineering/DEVLOG.md`; `docs/qa/releases/0.85/0.85.309.md`; `docs/releases/RELEASE-READINESS.md`; `docs/qa/ACCEPTANCE-MATRIX.md`.
- Automated verification: focused contract suite passed `12/12`; touched Vue/test diagnostics passed with no errors.
- Production build: passed with Vite `4.5.9`, `701` modules transformed, and `dist` generated.
- Live browser verification: PENDING for Create/Edit, Day/Week, collapsed accordions, and desktop/tablet/mobile layouts.
- User acceptance: PENDING. 0.85.313 was not started.

## 0.85.311 FIX - Consolidated recording field, layout, button, and tag correction - 2026-11-21
- Scope: targeted frontend consolidation of recording field ordering, universal layout, More/Less behavior, LBS labels, and exercise tags.
- Recording behavior: Recording Type exclusively determines primary/additional field order. Workout Type determines displayed badge/classification only.
- Layout: exactly three fields in primary and additional rows, labels left of inputs, More/Less fourth in primary row, and 44px blue chevron control.
- Tags: empty tags are omitted; valid Strength/Cardio/Other badges remain Workout-Type-derived and independent of Recording Type.
- Shared components: `WorkoutExerciseBlock.vue`, `ExerciseSessionCard.vue`, and `exerciseRecordingFields.js` were corrected/reused.
- Preserved: Save controls, bottom 0.85.312 controls, backend APIs, database structures, and PlanID 5.
- Files changed: utility/test/components and canonical 0.85.311 FIX logs/release evidence.
- Automated verification: focused recording/builder suite passed `19/19`; touched diagnostics reported no errors.
- Production build: passed Vite `4.5.9`, `701` modules transformed, `dist` generated.
- NOT VERIFIED: live Create/Edit/View/preview/log/history/active/resume and viewport visual acceptance requires browser verification.
- User acceptance: PENDING.

## 0.85.312 Recovery checkpoint - 2026-11-21
- Consolidated status: 0.85.309 top Save, 0.85.309a alignment, 0.85.311 FIX, and 0.85.312 bottom schedule controls are implemented in restored source.
- Automated evidence: focused recording/builder suites passed `19/19`; touched diagnostics reported no errors; Vite build passed `701` modules and generated `dist`.
- Live acceptance: Save alignment, bottom Day/Week behavior, recording surfaces, desktop/tablet/mobile geometry, and create/edit/save workflows remain pending visual/browser verification.
- 0.85.313: reset to TODO; no implementation authorized or started.
- Historical 0.85.309 verification FAIL/MISSING entries remain preserved above and are not removed.
