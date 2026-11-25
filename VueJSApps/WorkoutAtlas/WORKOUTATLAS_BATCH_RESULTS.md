# WorkoutAtlas Batch Results

## 0.85.cleanup - Final Cleanup Commit and BETA Integration - 2026-11-25
- Status: MERGED INTO BETA - CLEANUP BRANCH RETIRED - POST-MERGE QA PENDING. Branch/task label, not a package version (packages remain `0.85.308`). Baseline BETA = `origin/BETA` = `6fdec96255110ce1588051bbf93afde2073a38b6`; exact checkpoint and merge SHAs are in Git history and the owner report.
- Owner: confirmed noticeable performance improvement after a3; authorised commit, merge into BETA, push of BETA and cleanup branch retirement.
- Completed: five cleanup batches; 165 template files removed; routes 81 -> 37 (44 removed); mobile navigation repair (a2); debugging overhead reduced; session request deduplication; dashboard requests parallelised; application-shell optimisation (a3).
- Outstanding (not performed, not claimed as passed): full regression testing; authentication regression testing; no measured performance benchmark (owner observation only); Vue `parentNode` exception not conclusively resolved; responsive breakpoint improvements deferred. No test, build, server start or DB check was run for the integration.
- Safety: `.env*` files 0 accessed; environment variables 0 changed; 13 stashes preserved; `APP-CLEANUP-INVENTORY.md` untouched and uncommitted; no force push; no main or other branch changed.

## 0.85.cleanup.5.a3 - Mobile and Tablet Navigation Performance Optimization - 2026-11-25
- Status: PERFORMANCE OPTIMIZATION IMPLEMENTED - PENDING OWNER ACCEPTANCE. Task label, not a package version (packages remain `0.85.308`). Working tree only; no staging, commit, push or merge. a2 repairs preserved. Final cleanup acceptance remains BLOCKED.
- Trigger: owner feedback after a2: "the application works, but it's slow".
- Confirmed (source level, not measured): up to 4 (mobile) / 5 (tablet, desktop) `/api/session` requests per dashboard load, each doing a role lookup and a `users` SELECT on the backend; a sequential session -> profile -> dashboard request waterfall in `HomeDashboard.vue`; unconditional stylesheet `href` and `localStorage` rewrite per protected navigation; triple shell sync and a never-removed document click listener in `App.vue`; an unused, leaking resize listener in `HeaderComponent.vue`; an unguarded `#app` style write per layout update.
- Changes (7 files): `useAuth.js` (+65/-6; pending-request sharing within 500 ms, epoch/sequence stale-response guards, invalidation at logout, no caching, `fetchSessionSnapshot` export); `router/index.js` (+9/-3; guard uses the shared request, rules and per-navigation server validation unchanged); `primaryColorChangeSetting.js` (+10/-3); `App.vue` (+6/-6); `layouts/App.vue` (+10/-2); `HeaderComponent.vue` (+8/-31); `HomeDashboard.vue` (+12/-16; concurrent loading).
- Expected (not measured): about 2 session requests on an initial protected load instead of 4-5; dashboard data loads in one request round instead of three; fewer redundant DOM/storage writes.
- Static verification (actual): branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA and 13 stashes unchanged; nothing staged; 165 deletions; 37 route paths; a2 diffs unchanged; no backend, CSS/SCSS, package or env diff; CRLF kept; editor diagnostics clean. Not run: tests, builds, installs, server start, DB checks. Environment files: 0 accessed; environment variables: 0 changed.
- Unresolved / deferred: Vue `parentNode` exception (not claimed fixed); per-navigation session validation (kept for security); sidebar session request on each 768 px crossing; direct session fetches in `Logout.vue`, `exercises.vue`, `LogWorkout.vue`, `WorkoutBuilder.vue`, `UpdatePassword.vue`, `router/Session.js`; breakpoint fragmentation; header/body offset; dead drawer CSS; AOS; nested overflow containers. Pending: owner manual performance and mobile/tablet acceptance.

## 0.85.cleanup.5.a2 - Mobile Navigation Performance Targeted Repair - 2026-11-25
- Status: TARGETED REPAIR IMPLEMENTED - PENDING OWNER ACCEPTANCE. Task label, not a package version (packages remain `0.85.308`). Working tree only; no staging, commit, push or merge. Final cleanup acceptance remains BLOCKED.
- Trigger: owner testing of `0.85.cleanup.5` FAILED mobile/tablet acceptance (menu/sidebar behaviour near 700px, unresponsive mobile menu buttons, slow/frozen views, Vue `RouterView` update warning with `Cannot read properties of null (reading 'parentNode')`, repeated `ProfileDropdown` debug logs). Read-only investigation `0.85.cleanup.5.a1` (static, no runtime measurement) found the defects predate cleanup: all implicated files are unchanged against `6fdec962`.
- Confirmed (source level): unconditional `ProfileDropdown.vue` console logging and `/api/debug/mobile-menu` / `/api/debug/profile-menu` requests on every `pointerdown` (even closed) and route change; `AppBottomNav.vue` self-referential custom properties (height computed `auto`); Vue 3.5.17 `runtime-core.cjs.js` L5373-5382 makes the `parentNode` error likely a secondary failure after an earlier failed patch (first error unknown); fragmented breakpoints (767/768/769/991/1199, no 700px rule); no dangling routes.
- Changes (2 files only): `ProfileDropdown.vue` (+51/-32): diagnostics (console and `/api/debug/*`) disabled by default behind opt-in `localStorage` key `wa:debug:profile-dropdown`=`1`; closed-state early returns in outside-pointer, route-change and `closeDropdown`; diagnostic watchers registered only when opted in; legitimate fallback logging kept; functionality and listener cleanup unchanged. `AppBottomNav.vue` (+2/-3): cyclic `--wa-mobile-bottom-nav-height` / `-gap` removed; `height` has a valid `70px` fallback.
- Static verification (actual): branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA and 13 stashes unchanged; 165 deletions intact; 37 route paths unchanged; no other source modified beyond the 5 earlier cleanup files; no backend, CSS/SCSS, `App.vue`, `HeaderComponent.vue`, router, `useAuth.js`, package or env diff; editor diagnostics clean for both files.
- Not run (not authorised): tests, builds, installs, server start, DB checks. Environment files: 0 accessed, 0 modified; environment variables: 0 changed.
- Unresolved / deferred: the Vue `parentNode` exception (not claimed fixed; needs runtime evidence), per-navigation `/api/session` and duplicate session requests, breakpoint fragmentation, header/body offset, dead drawer CSS, AOS, nested overflow containers. Pending: owner manual mobile/tablet acceptance.

## 0.85.cleanup.5 - Batch 5 Final Unused Template Composable Cleanup - 2026-11-25
- Status: IMPLEMENTED - PENDING FINAL OWNER ACCEPTANCE. Task label, not a package version (packages remain `0.85.308`). Working tree only; no staging, commit, push or merge.
- Repository: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA unchanged, 13 stashes unchanged. Batches 1-4 (161 files, 44 routes) verified intact before and after. Acceptance of Batches 1, 2, 3 and 4 was not stated by the owner and all remain PENDING.
- Changes: 4 composables deleted (1,786 lines): `chartsDataManage.js`, `dashboardManage.js`, `nestableList.js`, `sweetalertManage.js` (original inventory row T10). Routes removed: 0 (37 paths unchanged). Navigation files modified: 0. Protected components removed: 0.
- Cumulative (Batches 1-5): 165 files deleted, 44 routes removed, 81 -> 37 route paths, 5 source files modified; frontend diff 170 files, 17,470 lines deleted, 1 added.
- Static verification (actual): all four files tracked; zero importers by path, relative path, dynamic import or glob; none of the exported names (`initCalendar`, `use*ChartData`, `list`/`listThree`/`folderTeamData`, the 14 SweetAlert demo exports) used in retained source; only unresolved import is the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu` (not repaired by instruction); protected components all present; backend, CSS/SCSS, package manifest, lockfile, asset and env diffs empty.
- Not run (not authorised): tests, builds, installs, server start, DB checks. Environment files: 0 accessed, 0 modified; environment variables: 0 changed.
- Skipped / left: demo-only packages, orphaned images and styles, `frontend/dist`, `sidebarMenu-TEMPLATE.js`, six Batch 4 protected components and other protected shared components. No blockers. Pending: owner manual acceptance and final cleanup verification.

## 0.85.cleanup.4 - Batch 4 Template Removal (unused Digiboard UI demonstrations) - 2026-11-25
- Status: BATCH 4 IMPLEMENTED - PENDING OWNER ACCEPTANCE. Task label, not a package version (packages remain `0.85.308`). Working tree only; no staging, commit, push or merge.
- Repository: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA unchanged, 13 stashes unchanged. Batches 1-3 (113 files, 34 routes) verified intact before and after. Acceptance of Batches 1, 2 and 3 was not stated by the owner and all remain PENDING.
- Changes: 48 files deleted (10 `views/template/components/*` and `views/template/pages/Utility.vue`; 38 `components/template/*`: 16 charts, 11 tables, 4 dragable, 4 product, 2 slider, `DatatableAction/ProductTableAction.vue`; exact list in `docs/engineering/APP-CLEANUP-INVENTORY.md`); 10 routes removed (`/sweet-alert`, `/nestable-list`, `/animation`, `/swiper-slider`, `/form`, `/table`, `/charts`, `/icon`, `/map`, `/utility`); route paths 47 -> 37. No navigation file edited (no live reference existed).
- Preserved from the 54-file approved inventory (6): `PagePanelHeader.vue`, `TextEditorComponent.vue`, `datatable/DigiDataTable.vue`, `datatable/TableFilterOption.vue`, `form/DropzoneComponent.vue` (owner-protected shared components) and `employee/TableFilterOption.vue` (name matches the protected file; preserved conservatively). All six are now unreferenced; Batch 5 candidates.
- Cumulative (Batches 1-4): 161 files deleted, 44 routes removed, 81 -> 37 route paths, 5 source files modified; frontend diff 166 files, 15,684 lines deleted, 1 added. Batch 4 increment: 4,766 lines in deleted files plus `routing.js` -60.
- Static verification (actual): 48/48 deleted files tracked and in the approved inventory; zero retained imports, names or links to deleted files or removed routes (except unreachable `sidebarMenu-TEMPLATE.js`); all 37 route component imports resolve; only unresolved import is the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu`; protected routes present; backend, CSS/SCSS, package manifest, lockfile, composable and asset diffs empty. Resolved side effect: the dangling `/add-product` link (Batch 1 leftover in `ProductTableHeaderComponent.vue`) no longer exists.
- Not run (not authorised): tests, builds, installs, server start, DB checks. Environment files: 0 accessed, 0 modified; environment variables: 0 changed.
- Skipped candidates / blockers: composables `nestableList.js` and `chartsDataManage.js`, `filemanager/FolderList.vue`, `HeaderCalculator.vue`, `sidebarMenu-TEMPLATE.js`, demo-only npm packages and orphaned CSS/images preserved. No blockers. Pending: owner manual acceptance; Batch 5 not started.

## 0.85.cleanup.3 - Batch 3 Template Removal (unused authentication, pricing and email demonstration pages) - 2026-11-25
- Status: BATCH 3 IMPLEMENTED - PENDING OWNER ACCEPTANCE. Task label, not a package version (packages remain `0.85.308`). Working tree only; no staging, commit, push or merge.
- Repository: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA unchanged, 13 stashes unchanged. Batches 1 and 2 (94 files, 20 routes) verified intact before and after. Acceptance of Batches 1 and 2 was not stated by the owner and both remain PENDING.
- Changes: 19 files deleted (17 `views/template/pages/authentication/*`, 2 `views/template/pages/additional/PricingTable*.vue`; exact list in `docs/engineering/APP-CLEANUP-INVENTORY.md`); 14 routes removed (`/registration-2`, `/login-status`, `/account-deactivated`, `/welcome`, `/email-verify`, `/two-factor`, `/multi-step-signup`, `/pricing-table`, `/pricing-table-2`, `/card-declined`, `/promotion`, `/subscription-confirm`, `/welcome-mail`, `/reset-password-mail`); route paths 61 -> 47. `layouts/Guest.vue`: stale `'pricing_table'` removed from `errorRoutes`. `Blank.vue` preserved.
- Authentication protection: real WorkoutAtlas authentication (`views/Guest/*`, routes `/login`, `/register`, `/terms-policy`, `/reset-password`, `/update-password`, `/ext-register`, `/logout`), guards, services and backend untouched; none of the 19 deleted views used an API, store or composable. Authentication functionality removed: 0.
- Cumulative (Batches 1-3): 113 files deleted, 34 routes removed, 81 -> 47 route paths, 5 source files modified; frontend diff 118 files, 10,858 lines deleted, 1 added.
- Static verification (actual): deleted set equals the approved Batch 3 allowlist (19/19, all tracked); zero retained imports, names or links to deleted files or removed routes (except unreachable `sidebarMenu-TEMPLATE.js`); all 44 remaining route component imports resolve; backend, CSS/SCSS, package manifest, lockfile and asset diffs empty.
- Not run (not authorised): tests, builds, installs, server start, DB checks, `node --check`. Environment files: 0 accessed, 0 modified; environment variables: 0 changed.
- Skipped candidates / blockers: `filemanager/FolderList.vue` preserved (not in any approved inventory); `ComingSoon`, `ComingSoon2` and `UnderConstruction` views and routes kept (not in Batch 3); orphaned images and CSS/SCSS left untouched. No blockers. Pending: owner manual acceptance; Batch 4 not started.

## 0.85.cleanup.2 - Batch 2 Template Removal (chat, calendar, email, invoices, contacts, file manager) - 2026-11-25
- Status: BATCH 2 IMPLEMENTED - PENDING OWNER ACCEPTANCE. Task label, not a package version (packages remain `0.85.308`). Working tree only; no staging, commit, push or merge.
- Repository: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA unchanged, 13 stashes unchanged (SHAs compared with the earlier snapshot). Batch 1 (67 files, 14 routes) verified intact before and after.
- Prior context: manual testing of a1 reported broken menu links; the read-only `0.85.cleanup.1.a2` investigation found no live link broken by Batch 1 (symptom not reproduced; unverified hypotheses recorded in `CHANGELOG.md`). Owner then authorised Batch 2; no formal Batch 1 acceptance statement was supplied.
- Changes: 27 files deleted (6 views, 21 components; exact list in `docs/engineering/APP-CLEANUP-INVENTORY.md`); 6 routes removed (`/chat`, `/calendar`, `/email`, `/invoices`, `/contact`, `/file-manager`; names `chat`, `calendar`, `email`, `invoices`, `contact`, `file_manager`); route paths 67 -> 61. Navigation edits in `sidebarMenu.js` (Trainer section and Administrator Scheduling/Chat removed), `ProfileRightSidebarComponent.vue` (Message link removed) and `HomeDashboard.vue` (Chat/Scheduling role actions and dead `allMenuLinks` entries removed).
- Cumulative (Batch 1 + 2): 94 files deleted, 20 routes removed, 81 -> 61 route paths, 4 source files modified; frontend diff 98 files, 9,249 lines deleted, 0 added.
- Static verification (actual): deleted set equals the approved inventory (27/27, nothing extra); zero retained imports of deleted files; only unresolved import is the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu`; six removed paths and names absent from retained source (except unreachable `sidebarMenu-TEMPLATE.js`); protected routes present; `routing.js` and `sidebarMenu.js` pass `node --check` on Temp copies; backend, CSS/SCSS, package manifest and lockfile diffs empty.
- Not run (not authorised): tests, builds, installs, server start, DB checks. Environment files: 0 accessed, 0 modified; environment variables: 0 changed.
- Skipped candidates / blockers: inventory has 27 files (28 expected); orphan `components/template/filemanager/FolderList.vue` was never in any approved batch and was preserved. Pending: owner manual acceptance; Batch 3 not started.

## 0.85.cleanup.1.a1 - Batch 1 Template Removal (CRM, HRM, e-commerce) - 2026-11-25
- Status: BATCH 1 IMPLEMENTED - PENDING OWNER ACCEPTANCE. Task label, not a package version. Working tree only; no staging, commit, push or merge.
- Repository: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, BETA unchanged, 13 stashes unchanged (SHAs compared with the pre-change list).
- Changes: 67 files deleted (16 views, 51 components; exact list in `docs/engineering/APP-CLEANUP-INVENTORY.md`); 14 routes removed from `routing.js`; Taskboard (`/task`) link removed from `ProfileRightSidebarComponent.vue`. `/hrm-dashboard` and the Message link retained.
- Git diff: 69 files, 6,186 deletions, no additions in frontend source (67 deleted + 2 edited).
- Static verification (actual): deleted set equals the approved allowlist; all tracked; zero retained imports or path mentions of deleted files; zero unresolved imports other than the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu`; route table 81 -> 67 paths with all protected routes present; backend, CSS/SCSS, package manifest and lockfile diffs empty.
- Not run (not authorised): tests, builds, installs, server start, DB checks. Environment files: 0 accessed, 0 modified; environment variables: 0 changed.
- Skipped candidates / blockers: none. Pending: owner manual acceptance; Batches 2-5 not started.

## 0.85.cleanup.1 - ROLLBACK - FAILED ACCEPTANCE — ROLLBACK REQUESTED - 2026-11-24
- Owner reported the app no longer started; acceptance FAILED; rollback authorised.
- Restored (working tree only, from `6fdec96255110ce1588051bbf93afde2073a38b6`): 161 deleted files and 4 modified source files. `git diff 6fdec962 -- frontend backend` is empty; nothing staged; 13 stashes and BETA untouched; no reset, clean, commit, push or merge.
- Environment: `backend/.env` present, not touched by this task; no `.env` backup found; no environment variable changed; no credentials printed or invented.
- Startup check: `npm run dev` starts frontend (5173, serves app) and backend (5000, `/api/debug/ping` 200). Backend DB connection rejected by the configured MySQL server (`ER_ACCESS_DENIED_ERROR`); DB-backed routes return 503. Blocker is the DB credential or remote-access setting, not source code.
- No further cleanup authorised. BETA integration NOT AUTHORIZED. The original 0.85.cleanup.1 entry below is kept as history.

## 0.85.cleanup.1 - Controlled Legacy Template Feature Removal - 2026-11-24
- Scope: owner-approved removal of standalone Digiboard demo features only (chat, Calendar, CRM, HRM, e-commerce, email, invoices/contacts, file manager, authentication, pricing/subscription and UI demo pages). Owner decision: both profile pages, `/settings`, profile dropdown and right sidebar retained. No backend, database, migration, auth, API, dependency or CSS/SCSS change. No commit, push, merge, rebase, reset or branch switch.
- Repository: branch `0.85.cleanup`, HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`, 13 stashes intact, nothing staged.
- Changes: 44 routes removed; 161 files deleted (51 views, 110 exclusively owned template components); 4 files modified (`routing.js`, `sidebarMenu.js`, `HomeDashboard.vue`, `ProfileRightSidebarComponent.vue`). Full lists: `docs/engineering/APP-CLEANUP-INVENTORY.md`.
- Automated verification (actually run): frontend `node --test` 140/140 (baseline 140/140); Vite production build succeeded, 154 files, 19,422,800 bytes (baseline 255 files, 23,126,576 bytes); backend `node --test` 238/238 (baseline 238/238); `backend/api/users.js` has no Git changes and 37 routes; static import/route check after each group: no new findings.
- Deferred: coming-soon/under-construction routes and views, unreferenced shared components and composables, `sidebarMenu-TEMPLATE.js`, all other inventory candidates.
- Pending: manual browser acceptance. User acceptance: PENDING. BETA integration: NOT AUTHORIZED.

## 0.85.cleanup - Application and Legacy Template Inventory - 2026-11-24
- Scope: inventory and analysis only. No functionality, source, CSS/SCSS, dependency, database or API change; no commit, push, merge, rebase, reset or branch deletion.
- Repository baseline:
	- Branch: `0.85.cleanup`, created from `BETA`
	- Base commit: `6fdec96255110ce1588051bbf93afde2073a38b6`
	- Package versions: frontend `0.85.308`, backend `0.85.308`
	- Working tree before and after the code analysis: clean; 13 stashes preserved
- Files changed (documentation only): `docs/engineering/APP-CLEANUP-INVENTORY.md` (new), `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`, `docs/engineering/CURRENT-STATE.md`, `docs/engineering/SESSION-HANDOFF.md`, `docs/engineering/DEVLOG.md`, `docs/qa/QA-INDEX.md`, `docs/INDEX.md`, `docs/governance/DOCUMENTATION-INVENTORY.md`.
- Inventory totals (static analysis): 7,829 tracked files; 387 frontend code files analysed, 261 reachable from `main.js`, 113 non-test files unreachable by static import; 63 template views and 124 template components; 81 routes (16 custom app, 7 custom guest, 56 template-component, 2 redirects), 39 template routes with no live reference; about 144 backend route declarations in 18 locations.
- Major findings: template couplings that block a naive delete (sidebar menu, `DateRangePicker`, error pages, theme composables, global CSS, demo links); runtime-loaded `blue-color.css`; unmounted `food-items.js`; stray `tmp-*` artifacts; two large unreferenced exercise datasets (95 MB and 96 MB); 25 unreferenced images (6.05 MB); template and Font Awesome Pro licensing to verify; live debug endpoints.
- Automated verification: none run (not authorized for this task). Static import, route, dependency, CSS-class, asset and API-caller scans only; results are labeled confirmed (static) or suspected in the report.
- Blockers: none.
- User acceptance: PENDING. All cleanup recommendations await explicit approval; each proposed batch needs separate approval.

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

## 0.85.313 - 2026-11-21 - Baseline verification only
- Scope: documentation of read-only baseline verification; no application code, database, migration, server, package, or protected-data change.
- Branch: FAIL. Checked-out branch is `0.85.113` tracking `origin/0.85.113`; HEAD is `0fbf3b293cc6fb6363cac2922894bfc098c81bed`, with commit subject `0.85.113.RESET`. The branch name `0.85.113.RESET` is not currently checked out.
- Restored baseline: PASS. HEAD tree exactly matches BETA HEAD `df1f026d506c50456b477e0777a98bb55c2e1977`, commit `0.85.312 - Recovery checkpoint for 0.85.309 through 0.85.312`; direct tree diff is empty.
- Working tree: CLEAN. Status is `## 0.85.113...origin/0.85.113`; no tracked or staged modifications were present before documentation evidence was appended.
- Backend API file: `backend/api/users.js` is 4,768 lines and contains 37 route definitions.
- Route inventory:
	- User/profile/list: `GET /user-id`, `GET /users`, `GET /user-profile-settings`, `PUT /user-profile-settings`, `GET /has-saved-workout-list`.
	- Workout schedules: `POST /workout-schedules`, `GET /workout-schedules`, `GET /workout-schedules/:id`, conversion preview/conversion routes, cover routes, schedule patch/delete routes, group replacement route, exercise add/patch/delete routes, and delete-impact route.
	- Featured/global plans: featured list/clone, global list/detail/use, and admin global/user-plan list/create/patch/schedule/exercise/delete routes.
	- Workout planner: `GET /workout-planner`, `GET /workout-planner/provenance`, `PUT /workout-planner`, `DELETE /workout-planner/:planId`.
- Week/day assignment: `normalizePlannerPayload` normalizes day/week arrays and exercise schedule labels; `buildPlannerFromSchedule` reconstructs active mode, labels, order arrays, and exercise assignments; `replaceScheduleGroupsAndExercises` persists groups and exercises.
- Storage: MySQL `workout_schedules`, `workout_schedule_groups`, and `workout_schedule_exercises`; group/exercise replacement deletes old rows and inserts the normalized plan structure.
- Frontend assignment functions: `normalizeGroupKey`, `getScheduleGroupId`, `resolveScheduleGroupNameFromId`, `toggleScheduleGroupAccordion`, `addScheduleGroupFromValue`, `addScheduleGroup`, `addScheduleGroupBottom`, `duplicateScheduleGroup`, `moveScheduleGroup`, and `removeScheduleGroup` in `WorkoutBuilder.vue`.
- Protected data: PlanID 5, personal history, paused sessions, and non-disposable plans were not queried or changed.
- Applicable documentation logs updated: `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`, `docs/engineering/CURRENT-STATE.md`, `docs/engineering/SESSION-HANDOFF.md`, `docs/engineering/DEVLOG.md`, QA/release readiness and acceptance records.
- Verdict: Baseline evidence verified; branch-name mismatch remains. STOP and await approval. No implementation is authorized.
- Stage 1/10 re-verification: branch `0.85.113.RESET` FAIL (checked out `0.85.113`, no such branch exists); baseline 0.85.312 PASS (HEAD `0fbf3b293cc6fb6363cac2922894bfc098c81bed` vs BETA `df1f026d506c50456b477e0777a98bb55c2e1977`, empty diff); `users.js` 4,768 lines, 37 routes (4 user/profile, 14 workout-schedules, 5 featured/global, 9 admin, 4 workout-planner, 1 has-saved-workout-list); source clean, documentation-only modifications. STOP.

## 0.85.313.a1 - Default Week Initialization (2026-11-21)

- Branch: `0.85.113` (HEAD `0fbf3b293cc6fb6363cac2922894bfc098c81bed`); package versions unchanged at `0.85.308`.
- Change: `createWorkoutPlan` in `frontend/src/views/Member/WorkoutBuilder.vue` seeds `weekGroups` with `Week 1` (`DEFAULT_NEW_PLAN_WEEK_NAME`), synced to order entries, identity map, and accordion selection. Day mode remains the default and Day View starts empty.
- Preserved: `hydratePlanner`/existing saved plans, `resetPlannerDraft`, week names and assignments are untouched. No UI redesign, backend change, database write/migration, server restart, push, or deploy.
- Tests: `WorkoutBuilder.preview-mobile-contract.test.mjs` passed `14/14` (2 new); Vite production build passed.
- API: `backend/api/users.js` retains `37` route definitions and has no diff.
- Protected data: PlanID 5, personal history, paused sessions, and non-disposable Global plans were not touched.
- User acceptance: PENDING. STOP; no commit made.

## 0.85.313.a2 - Stage 3/10 Default Day Assignment (2026-11-21) - SUPERSEDED by 0.85.313.a2.1

- Checkpoint: Stage 2 (0.85.313.a1) committed as `97397e075` and pushed to `origin/0.85.113` after staged-file/secret/exclusion review (`SECURITY_GATE_PASS`).
- Change (frontend only): `hydratePlanner` in `WorkoutBuilder.vue` now calls `assignUnassignedExercisesToDefaultWeek` (new `frontend/src/utils/workoutDefaultWeekAssignment.mjs`). Exercises with no schedule group are assigned in memory to `Week 1` (or the plan's first existing week, or a newly created `Week 1`).
- Safeguards: case-insensitive de-duplication, matching day label reuse, idempotent, valid assignments/custom week names/exercises/recording values preserved, no save call during load.
- Tests: new helper suite `7/7`; WorkoutBuilder contract suite `14/14`; Vite production build passed (`702` modules).
- API: `backend/api/users.js` retains `37` route definitions (4,768 non-empty lines); no backend or package diff.
- Limitations: no day-to-week link exists in the data model, so "unassigned days" = exercises without a schedule group; no live browser verification; PlanID 5 not loaded or modified.
- User acceptance: PENDING. STOP; 0.85.313.a3 not started. Stage 3 changes are uncommitted.

## 0.85.313.a2.1 - Correct Day Assignment (2026-11-21)

- Correction of Stage 3: a2 wrongly assigned exercises (and could create a `Week 1` day card); that logic is removed and exercises/group labels load exactly as saved.
- Change (frontend only): in-memory `dayWeekAssignments` mapping (day name -> week) in `WorkoutBuilder.vue`, backed by new `frontend/src/utils/workoutDayWeekAssignment.mjs`. Unassigned days default to `Week 1` or the first existing week; valid assignments, day names, exercises, and recording values preserved; each day assigned once; no day card or week is created by assignment.
- Mapping is reconciled on load/create/add/remove, carried on rename/duplicate, cleared on reset; excluded from dirty state and save payload; no save or network call on load.
- Tests: new suite `11/11`; WorkoutBuilder contract `14/14` (25/25 combined); Vite production build passed (`702` modules).
- API: `backend/api/users.js` retains `37` route definitions (4,768 non-empty lines); no backend, package, or database change; PlanID 5 not loaded or modified.
- Limitations: mapping is not visible in the UI and not persisted (lost on reload); no live browser verification. Backend persistence was not begun.
- User acceptance: PENDING. STOP; Stage 3 changes are uncommitted.

## 0.85.313.a3 - Persist Day-to-Week Assignments (2026-11-21)

- Stage 3 checkpoint committed and pushed first as `71c1048a8` (`SECURITY_GATE_PASS`).
- `dayWeekAssignments` now persists in the existing `workout_schedules.settings_json` column (key `dayWeekAssignments`): saved by `PUT /api/workout-planner` (merged, other settings preserved), restored via `planner.settings.dayWeekAssignments` on `GET /api/workout-planner` and `GET /api/workout-schedules/:id`.
- Backend: new `backend/utils/workoutPlanSettings.js` plus 23 surgical lines in `users.js`; column presence detected read-only via `information_schema`; no schema change, migration, or production data write.
- Frontend: restore + reconcile on load, `Week 1` initialized when a loaded plan has no weeks, payload includes settings, assignments included in unsaved-change detection.
- Tests: frontend `28/28`; new backend suite `11/11` (in-memory fixture); `node --check` clean; Vite build passed (`702` modules).
- Routes: `users.js` has `37` route definitions, identical order to HEAD; no package change; PlanID 5 untouched.
- Limitations: requires `settings_json` to exist in the target DB (else stays in memory); unsaved custom week names are not persisted by the backend; global/clone paths do not write assignments; `mysql2` missing locally so 2 existing backend tests could not run; no live verification.
- User acceptance: PENDING. STOP; Stage 5 not started. Stage 4 changes are uncommitted.

## 0.85.313.a3.1 - Database Verification (2026-11-21)

- Goal: read-only check that `workout_schedules.settings_json` exists in the target database.
- Agent-side: BLOCKED. No `backend/.env`/`.env.local`, no `DB_*` variables, no `mysql2` driver, no `mysql` client; no query was run and no credentials were sought or guessed. The agent could not query directly; the user ran the read-only query instead (below).
- Indirect evidence only: repository backups `0.76` and `0.83` define `settings_json longtext utf8mb4_bin DEFAULT NULL` (nullable, `json_valid` check). Not proof of the live schema.
- User action: completed (see result below).
- No application code, schema, data, or package change; no database writes; PlanID 5 untouched.
- Result (user-run, phpMyAdmin, 2026-11-21): VERIFIED, COLUMN EXISTS. First run was inconclusive (`information_schema` selected, so `DATABASE()` mismatch); the re-run without `DATABASE()` returned 1 row: schema `stephenk_flexfit`, `workout_schedules.settings_json`, `DATA_TYPE` `longtext`, `IS_NULLABLE` `YES`, `COLUMN_DEFAULT` `NULL`. Other environments not checked.
- User acceptance: PENDING. STOP.

## 0.85.313.a3.2 - Preserve Day and Week Groups (2026-11-21)

- Checkpoint: a3/a3.1 committed and pushed first (`1e8fa6818`). a3.2 changes are uncommitted.
- Fix: the shared save helper deleted all groups and re-inserted only the active mode's groups, dropping the other set and regenerating IDs. New `backend/utils/workoutPlanGroups.js` syncs day and week sets in place (match by family plus case-insensitive label; update, insert, delete only within the schedule). Unsent sets and placeholder-only empty sets are left alone. `users.js` wiring is surgical; frontend unchanged apart from one contract test.
- Tests: backend `workout-plan-groups` `21/21`, `workout-plan-settings` `11/11` (in-memory fixtures, PlanID 5 rows snapshot-checked); frontend `29/29`; `node --check` clean; CRLF kept; Vite build passed. Other backend tests needing `express`/`mysql2` cannot run locally.
- Routes: `37`, identical order to HEAD. No schema change, migration, package change or production data write; PlanID 5 untouched.
- Limitations: other readers (`workout-log.js` day order, `dashboard.js` weekly target, plan list `group_count`) count all groups regardless of type; exercise IDs still regenerate per save; renaming a group changes its ID; no live DB or browser verification.
- User acceptance: PENDING. STOP; Stage 5 not started.

## 0.85.313.a3.3 - Schedule Group Filtering (2026-11-21)

- Goal: after a3.2 stores both day and week groups, stop week containers being treated as workout days. a3.2 and a3.3 are both uncommitted.
- Rule: new `backend/utils/workoutScheduleGroupFilter.js`. Day-mode plans use every group type except `week`; legacy Week View plans (`schedule_mode = 'week'`) keep their week groups.
- Applied to: Workout Log `GET`/`PUT /day-order` (`workout-log.js`), dashboard `weeklyTarget` (`dashboard.js`), and the plan-list `day_count` / `group_count` subquery (`users.js`, 3 lines plus import). Save logic untouched.
- Tests: new `workout-schedule-group-filter` `24/24` (real route modules with stubbed express and an in-memory pool; SQL predicate checked against the JS helper; PlanID 5 snapshot unchanged); `workout-plan-groups` `21/21`; `workout-plan-settings` `11/11`; other runnable backend suites pass; frontend `29/29`; Vite build passed; `node --check` clean; CRLF kept.
- Routes: `users.js` 37, `workout-log.js` 14, `dashboard.js` 3, identical to HEAD. No schema change, migration, package change or production data write; PlanID 5 untouched.
- Limitations: SQL not run on a real MySQL server (no `mysql2`/`express` locally); day-mode plans with only weeks show 0 days and miss the publish gate until a day exists; add-exercise default group and `workout-sessions.js` day lookups were left alone; no live DB or browser verification.
- User acceptance: PENDING. STOP; Stage 5 not started.

## 0.85.313.a3.4 - Global Plan Persistence (2026-11-21)

- Checkpoint: the accepted a3.2/a3.3 work was committed and pushed first (`20fefbfff`, branch `0.85.113`). a3.4 is uncommitted.
- Goal: keep the day-to-week assignments (`workout_schedules.settings_json` -> `dayWeekAssignments`) when Global/Featured/Community plans are created or edited, and when plans are cloned or adopted. Before a3.4 only `PUT /workout-planner` wrote them.
- Change: reused `persistDayWeekAssignments` (no new persistence code), called after `replaceScheduleGroupsAndExercises` inside the existing transaction in `PATCH /admin/global-workout-plans/:id/schedule`, `POST /global-workout-plans/:id/use`, `POST /featured-workout-plans/:id/clone` and `POST /workout-schedules/:id/plan-type-conversion` (`users.js`), and in the register-time featured copy (`auth.js`, `settings_json` added to its schema probe; no-op when the column is absent). The frontend already sends `settings`; no frontend change.
- Preserved: week names and order (a3.2 group copy), exercises and recording values, permissions and plan types (code untouched), other keys already in the destination `settings_json`; the source plan is never written.
- Tests: new `workout-plan-global-persistence` `11/11` (in-memory table fixture; source contract for the five wired paths; PlanID 5 snapshot unchanged; statements scoped to the destination id; no DDL); `workout-plan-settings` `11/11` (wiring count assertion 1 -> 5); `workout-plan-groups` `21/21`; `workout-schedule-group-filter` `24/24`; other runnable backend suites unchanged; frontend: all 7 test files pass; Vite build passed; `node --check` clean for `users.js` and `auth.js`; CRLF kept; `users.js` 37 routes identical to HEAD.
- Not runnable locally (pre-existing, `express`/`mysql2` missing): the register, session and conversion integration suites.
- Safety: no schema change, migration, package change or production data write; PlanID 5 untouched.
- Limitations: new calls not executed on real MySQL; `settings_json` must exist in each target DB (verified only in `stephenk_flexfit`), otherwise assignments are silently not copied; clones of plans without assignments store an empty `dayWeekAssignments`; assignments rely on week names being copied unchanged; no live DB or browser verification.
- User acceptance: PENDING. STOP; Stage 5 not started.

## 0.85.313.a4 - Unified Schedule Planner, Stage 5/10 (2026-11-21)

- Checkpoint: a3.4 reviewed, committed and pushed first (`f34e9eab1`, branch `0.85.113`; live acceptance recorded as pending). a4 was committed and pushed as `5ffa3132b`.
- Goal: remove the separate Day View / Week View tabs from Create/Edit Workout Plan and show one Schedule Planner of workout day cards. Frontend only.
- Change (`frontend/src/views/Member/WorkoutBuilder.vue`): removed the tab pair and its wrapper in the planner section and the unused `changeScheduleMode`. Nothing above Workout Plan Information, no backend, DB, schema or package change.
- Preserved: Add Day (top and bottom), Add Exercise, Add Exercise to End, day rename/duplicate/move/delete, Save/Publish. The builder already always ran in day mode, so the save payload is unchanged (both group sets, orders, `settings.dayWeekAssignments`, all exercises); week names, assignments and workout content round-trip. Legacy week-mode plans load as before.
- Not added: week dropdown, Rename Week.
- Tests: new `WorkoutBuilder.unified-planner-contract.test.mjs` `8/8`; all 8 frontend test files pass (70 tests); Vite build passed; CRLF kept. Backend not re-run (no backend change since the a3.4 run).
- Safety: PlanID 5 untouched (no data access).
- Limitations: source-contract tests only, no browser check of layout; inert `.planner-mode-*` CSS left in place; weeks and assignments are saved but not editable in the UI until the dropdown stage.
- User acceptance: PENDING. STOP; Stage 6 not started.

## 0.85.313.a5 - Week Selection Dropdown, Stage 6/10 (2026-11-21)

- Checkpoint: a4 reviewed (staged-file and secret review clean, no `.local-only`/`.artifacts`/`.env`), committed and pushed first (`5ffa3132b`, branch `0.85.113`; browser acceptance recorded as pending). a5 was committed and pushed as `317087e56` (browser acceptance pending).
- Goal: add a Week selection dropdown in the Schedule Planner above the workout day cards. Frontend only.
- Change: `WorkoutBuilder.vue` (dropdown below Workout Plan Information, above Add Day and the day cards; `selectedWeek` UI state, `weekOptions`, watcher) and `workoutDayWeekAssignment.mjs` (`buildWeekOptions`, `resolveSelectedWeek`). Options come from existing weeks; `Week 1` is displayed as `Week 1 (Default)` while stored as `Week 1`; default selection is Week 1, else the first week.
- Behavior: switching weeks only changes the selection. It is not in the payload, dirty snapshot or draft, and edits no days, weeks, assignments or exercises, so unsaved changes are kept. No day filtering, Add Week or Rename Week.
- Tests: new `WorkoutBuilder.week-dropdown-contract.test.mjs` `7/7`; `workoutDayWeekAssignment.test.mjs` `18/18` (+4); a4 contract `8/8` (one assertion updated); all 9 frontend test files pass (81 tests); Vite build passed; CRLF kept. Backend not re-run (no backend change).
- Safety: PlanID 5 untouched (no data access); no backend, DB, schema, package or above-Workout-Plan-Information change.
- Limitations: source-contract and pure-function tests only, no browser check of the rendered dropdown; selecting a week has no visible effect yet (filtering is a later stage); selection not remembered across reloads.
- User acceptance: PENDING. STOP; Stage 7 not started.

## 0.85.313.a6 - Add Week, Stage 7/10 (2026-11-21)

- Checkpoint: a5 reviewed, committed and pushed first (`317087e56`, branch `0.85.113`; browser acceptance recorded as pending). a6 was committed and pushed as `a222c3228`.
- Goal: add an Add Week button beside the Week dropdown. Frontend only.
- Change: `WorkoutBuilder.vue` (`+ Add Week` button, `canAddWeek`, `addWeek`, CSS) and `workoutDayWeekAssignment.mjs` (`weekHasDayWithExercise`, `buildNextWeekName`). Enabled only when the selected week has a day with at least one exercise (selected week's assignments only). Creates the next unused `Week N` (from Week 2, smallest free number), appends it to the weeks, and selects it. The new week is empty. Switching existing weeks is never gated.
- Behavior: existing weeks, days, exercises, assignments and unsaved changes are preserved. No Rename Week, no day filtering.
- Tests: new `WorkoutBuilder.add-week-contract.test.mjs` `8/8`; `workoutDayWeekAssignment.test.mjs` `24/24` (+6); a4 and a5 contract tests relaxed to assert only that Rename Week is absent (both previously asserted Add Week absent) and pass; all 10 frontend test files pass (95 tests); Vite build passed; CRLF kept. Backend not re-run (no backend change).
- Safety: PlanID 5 untouched (no data access); no backend, DB, schema, package or above-Workout-Plan-Information change.
- Limitations: source-contract and pure-function tests only, no browser check; no UI yet assigns days to weeks, so a new week stays empty and Add Week is disabled while it is selected; days added while a new week is selected default to the default week; saving an empty added week relies on the existing group-row save and is not verified on a live DB; day cards are not filtered; selection not remembered across reloads.
- User acceptance: PENDING. STOP; Stage 8 not started.

## 0.85.313.a7 - Rename Week, Stage 8/10 (2026-11-21)

- Checkpoint: a6 reviewed (staged-file and secret review clean), committed and pushed first (`a222c3228`, branch `0.85.113`; browser acceptance recorded as pending). a7 was committed and pushed as `bf66ec03e`.
- Goal: a three-dot menu with Rename Week beside the Week dropdown. Frontend only.
- Change: `WorkoutBuilder.vue` (menu, inline rename editor, `saveWeekRename` and related handlers, CSS; `validateWorkoutDayName` gained an optional noun) and `workoutDayWeekAssignment.mjs` (`renameWeekInPlan`). There is no Rename Day modal in this builder (it is an inline title editor), so Rename Week reuses that editor's styling and the same name validator.
- Behavior: custom names with spaces, apostrophes and hyphens are accepted (same character rules as days, max 60); empty names and case-insensitive duplicates of another week are rejected with a message; the week keeps its position, its assigned days (assignments rewritten to the new name), its identity entry in the builder and the selection; exercises and days are untouched; no duplicate week is created. No day filtering.
- Identity limitation: the save payload has no stable week id and the backend matches week rows by case-insensitive label, so a saved rename replaces the old week group row with a new one (new group id). Exercises are re-linked in the same save and assignments are stored by label; anything keyed on the old week group id elsewhere is not carried over. Not changed (frontend only) and not verified on a live DB.
- Tests: new `WorkoutBuilder.rename-week-contract.test.mjs` `9/9`; `workoutDayWeekAssignment.test.mjs` `29/29` (+5); a4/a5/a6 contract tests updated (Rename Week now exists, only below the metadata form) and pass; all 11 frontend test files pass (109 tests); Vite build passed; CRLF kept. Backend not re-run (no backend change).
- Safety: PlanID 5 untouched (no data access); no backend, DB, schema, package or above-Workout-Plan-Information change.
- Limitations: source-contract and pure-function tests only, no browser check of the menu/editor layout; the group-id behavior above; no UI assigns days to weeks; day cards are not filtered; selection not remembered across reloads.
- User acceptance: PENDING. Stage 9 (a8) follows below.

## 0.85.313.a8 - Week Filtering and Day Assignment, Stage 9/10 (2026-11-21)

- Checkpoint: a7 reviewed (staged-file and secret review clean), committed and pushed first (`bf66ec03e`, branch `0.85.113`; browser acceptance recorded as pending, and the persistent week ID limitation recorded). a8 was committed and pushed as `a64c21cf0`.
- Goal: show only the selected week's day cards and assign new days to the selected week. Frontend only.
- Change: `WorkoutBuilder.vue` (`visibleDayGroups`, cards built from visible days, `assignDayToWeek` in the shared Add Day handler, visible-aware expanded/selected day, week-switch watcher, move/first/last/bottom controls on visible days, empty-week message, duplicate-name message naming the other week) and `workoutDayWeekAssignment.mjs` (`getDaysForWeek`, `assignDayToWeek`, `buildDuplicateDayMessage`, `moveDayAmongVisible`). Also fixed an a7 edge case: the rename editor is cancelled if the dropdown changes, and a rename only moves the selection when it renamed the selected week.
- Behavior: only days assigned to the selected week are shown; a new day (top or bottom Add Day) joins the selected week; a new week is empty; switching weeks keeps all unsaved days, exercises, recording values and assignments; saving still sends every week, day, assignment and exercise (payload unchanged); Add Week validation and Rename Week unchanged; day-card actions and exercise controls preserved. The Preview still lists the whole plan.
- BLOCKER (reported, not worked around): identical day names in separate weeks are not supported. A day is identified by its name alone (day list, `scheduleGroup` on exercises, assignment keys, backend label matching), so same-named days in two weeks would merge. Fixing it needs a day id or week-qualified key in the payload and backend. Duplicate names remain rejected across weeks, with a message naming the week that holds the name.
- Tests: new `WorkoutBuilder.week-filter-contract.test.mjs` `12/12`; `workoutDayWeekAssignment.test.mjs` `35/35` (+6); the a5 week-dropdown and 0.85.312 preview-mobile contract tests were updated; all 12 frontend test files pass (127 tests); Vite build passed; CRLF kept. Backend not re-run (no backend change).
- Safety: PlanID 5 untouched (no data access); no backend, DB, schema, package or above-Workout-Plan-Information change.
- Limitations: source-contract and pure-function tests only, no browser check; the identical-name blocker (resolved in a8.1); week identity not persisted on rename (a7); no UI moves an existing day to another week; Preview unfiltered; expanded day not remembered per week.
- User acceptance: PENDING. STOP; Stage 10 not started.

## 0.85.313.a8.1 - Schedule Identity Correction (2026-11-21)

- Checkpoint: a8 was committed and pushed as `a64c21cf0` (branch `0.85.113`). a8.1 was committed and pushed as `fe82ef325`.
- Goal: support identical day names in separate weeks without merging exercises or recording values, using stable group identities independent of display names. No migration, production data write or unrelated refactoring.
- Mapping result (read-only): the schema defines no unique `(workout_schedule_id, label)` constraint, exercises link to groups by `workout_schedule_group_id`, sessions resolve by `workout_day_id` before label. PROCEED; no blocker.
- Backend change: `utils/workoutPlanGroups.js` (id-only sync path, entry helpers; label path unchanged), `utils/workoutPlanSettings.js` (`dayWeekAssignmentsById` plus the legacy label map), new `utils/workoutScheduleGroupView.js` (entries and unique compatibility names), `api/users.js` (entries-aware `normalizePlannerPayload`, `buildPlannerFromSchedule`, `replaceScheduleGroupsAndExercises`; 37 routes and their order preserved), `api/auth.js` (id map remap on register-time copy), `api/workout-log.js` (real labels).
- Frontend change: `WorkoutBuilder.vue` (unique internal key, display label overrides, saved ids, same-week duplicate check, entries and `scheduleGroupKey` in the payload, ids adopted after save, draft/dirty state) and `workoutDayWeekAssignment.mjs` (`findDayWithLabelInWeek`, `buildUniqueDayKey`, override helpers, `buildGroupEntries`, `readGroupEntries`, `matchSavedGroupIds`).
- Preserved: workout history, active sessions, legacy plans, existing day-to-week assignments; PlanID 5 untouched (no data access).
- Tests (actual): backend focused suites `78/78` pass (10 new identity tests; four source-contract suites updated); full backend `node --test` was 132 pass / 45 fail at this checkpoint (all missing `express`/`mysql2`, no `node_modules`); re-run with dependencies in a9 below. Frontend 13 files, 140 tests pass (util suite 41, new builder contract suite 7, a8 contract tests updated); Vite build passed; CRLF kept.
- Limitations: no browser, component mount or live DB check; live index state of `workout_schedule_groups` unverified; label-keyed readers (global preview, session label fallback) see compatibility names for repeated labels; `PUT /workout-schedules/:id/groups` and the conversion engine still use the label path; no UI moves an existing day to another week.
- User acceptance: PENDING. Stage 10 (a9) follows below.

## 0.85.313.a9 - Final Regression and Acceptance, Stage 10/10 (2026-11-21)

- Checkpoint: a8.1 reviewed (staged-file and secret review clean), committed and pushed first as `fe82ef325` (branch `0.85.113`) with acceptance pending.
- Goal: final regression across items 1-10 (default Week 1, legacy plans, Add Week, Rename Week and persistent ids, week filtering and Add Day, identical names across weeks, save/reload/persistence, global/featured/conversion/adoption, Workout Log/sessions/dashboard/history, 0.85.309-312 behavior), audit of remaining label-based paths and index compatibility. No new features, no speculative fixes.
- Environment: `backend/node_modules` was missing; restored with `npm ci` from the existing lockfile (335 packages; `package.json` and `package-lock.json` unchanged).
- Tests (actual): default backend `node --test` 178 tests, 165 pass, 13 fail; all 13 are `Missing database environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE` at module load (`auth-avatar-session-compat` 3, `auth-register-featured-plan` 7, `exercise-storage-marker` 1, `workout-plan-conversion-engine` 1, `workout-session-recovery` 1; no `backend/.env`, environmental). With throwaway in-process DB variables at an unreachable address (no real DB, nothing persisted): 238 tests, 238 pass, 0 fail. Frontend: 13 files, 140 tests, 0 fail. Vite production build passed. `users.js`: 37 routes, same order as before a8.
- Audit findings (reported, not fixed): conversion engine writes compatibility names as labels in a converted copy of a plan with repeated day names (source untouched); `PUT /workout-schedules/:id/groups` deletes and re-inserts all groups (ids change, exercise links `SET NULL`), no frontend caller found; `workout-sessions.js` label fallback only when `workout_day_id` is missing or invalid; `workout-log.js` label match is scoped to one session. Index compatibility: repository schema and the 0.83 backup define only the primary key, `idx_wsg_schedule` and `idx_wsg_schedule_order` (non-unique); live DB state unverified.
- Safety: no production database write, schema migration, deployment, package change or server restart; PlanID 5 untouched (no data access).
- Blockers: none in code. Environmental: backend suite needs DB variables to load some modules; live index check and browser acceptance are with the user.
- User acceptance: PENDING. STOP; 0.85.313 is not declared accepted and is not merged into BETA.

## 0.85.313 - 2026-11-21 - Merge into BETA (conflict resolution)

- Merge: `0.85.113` (HEAD `e7b6059e8`, "0.85.313 - Unified Multi-Week Schedule Planner - QA Checkpoint") merged into `BETA` with a true merge commit (`--no-ff`). The merge commit hash is the commit that contains this entry (see `git log --merges -1 BETA`). Rollback hash (BETA before merge): `df1f026d506c50456b477e0777a98bb55c2e1977` (0.85.312 recovery checkpoint).
- Conflicts resolved (10 files, nothing else changed): `WorkoutBuilder.vue` `showBottomScheduleGroupControls` keeps the 0.85.313 selected-week-aware logic (`visibleDayGroups` for the schedule check, exercises counted from the selected week's days). The 0.85.312 requirements remain in force within the selected week: the bottom Add Day control needs at least one visible schedule and at least two unique exercises. `WorkoutBuilder.preview-mobile-contract.test.mjs`: both the 0.85.312 and 0.85.313.a1/a3.2 tests retained, with added assertions that the exercise count derives from the visible day groups and that the control is gated by `showBottomScheduleGroupControls`. Eight documentation files: both histories kept (0.85.312 recovery entries and all 0.85.313 development entries); no entry removed.
- Note: the originally approved final regression commit `0d46d7703` was amended before push into `e7b6059e8` (identical tree; `git diff 0d46d7703 e7b6059e8` is empty).
- Verification (automated): frontend 13 test files, 140/140 pass; backend default run 178 tests (165 pass, 13 environmental failures: missing DB environment variables, none are code defects); backend with isolated throwaway in-process variables 238/238 pass; Vite production build passes; security gate `SECURITY_GATE_PASS`; all 37 `backend/api/users.js` routes present and in identical order to `0.85.113`, `BETA` before merge and baseline `bf66ec03e`.
- Safety: no database change, migration, package/version change, server restart or deployment; PlanID #5 untouched; all 13 Git stashes preserved; no force push or branch deletion.
- User acceptance: PENDING. Browser acceptance and the live-database index verification have not been performed. An automated pass is not user acceptance. Open audit items unchanged: conversion engine writes compatibility names as labels for repeated day names, dormant `PUT /workout-schedules/:id/groups`, session label fallback.
