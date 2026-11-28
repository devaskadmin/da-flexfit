# WorkoutAtlas Current State

**Purpose:** First detailed status document for AI agents.

## 0.85.325 status (2026-11-28): FINAL MAINTENANCE AUDIT AND RENDER READINESS REVIEW COMPLETE - PENDING OWNER ACCEPTANCE

- `0.85` remains officially complete. Branch `BETA` at `c5e1dd698`; all changes uncommitted; packages remain `0.85.308`; `0.86` not started.
- Static source audit of 0.85.321/322/323/324: one repair `0.85.321.a1` in `ExerciseSessionCard.vue` (set table now follows Recording Type first, matching `LogWorkout.vue` set building). 0.85.322 and 0.85.323 verified with no defect. Static Render Linux review: no code blocker; dashboard-level concerns only (no `render.yaml`, no backend `start` script, SPA rewrite not in repo). No build or runtime verification was run; owner acceptance pending.
- Owner authorization (2026-11-28): commit and push of 0.85.321, 0.85.321.a1, 0.85.322, 0.85.323, 0.85.324 and 0.85.325 to `BETA` (normal push; any existing Render auto-deploy it triggers is authorized). Static readiness: YES. Render build and runtime verification: PENDING. Manual acceptance testing: PENDING. Next development milestone: `0.86` (not started). Supersedes the uncommitted/"no push" statements above.
## 0.85.324 status (2026-11-28): FINAL MAINTENANCE CHECKPOINT PREPARED - PENDING OWNER ACCEPTANCE

- `0.85` remains officially complete. Branch `BETA` at `c5e1dd698`; all of the following are uncommitted; packages remain `0.85.308` (task labels only); `0.86` not started.
- 0.85.321 (Current Workout exercise cards): `ExerciseSessionCard.vue`. 0.85.322 (mobile profile dropdown vs More screen stacking): `HeaderComponent.vue`. 0.85.323 (mobile logout confirmation): `Logout.vue`, `useAuth.js`, `ProfileDropdown.vue`. All IMPLEMENTED, PENDING OWNER ACCEPTANCE.
- Bounded static review found no conflicts between the three corrections (no shared files; Sign Out closes the dropdown before routing). Diagnostics clean; no tests, builds or startup run. Open, non-blocking: owner manual acceptance; confirm desktop Sign Out confirmation is intended; `ExternalRegister.vue` logout unchanged. Not marked accepted.
## 0.85.322 status (2026-11-28): MOBILE PROFILE DROPDOWN FIX - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. Package versions remain `0.85.308` (task label only). The profile dropdown (`ProfileDropdown.vue`) renders inside the header stacking context (`z-index: 1052` in `HeaderComponent.vue`); on mobile the More screen (`z-index: 1410`) covered it when open. Fix: one unscoped rule in `HeaderComponent.vue` lifts the header to `z-index: 1430` at max-width 768px only while the dropdown is open. `ProfileDropdown.vue` logic unchanged.
- Static verification only; owner mobile acceptance pending. Not marked accepted. Preserves the 0.85.321 and 0.85.323 changes.
## 0.85.321 status (2026-11-28): ACTIVE WORKOUT EXERCISE CARDS RESTORED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. Package versions remain `0.85.308` (task label only). Current Workout exercise cards are rendered by `frontend/src/components/workout-session/ExerciseSessionCard.vue`; they failed to render because the component used `normalizeWorkoutTypeBadge` (not imported) and `completedSets`, `totalSets`, `allDone`, `hasPrefilledValues`, `prefillClass` (removed in commit `6dbf903b1`, 0.85.311). All six are restored in that one file; the set-table type falls back to the `isCardio` prop (default strength) when no explicit Workout Type exists. Hydration, filtering, timer, Add Exercise, Complete & End Workout, stored sessions, backend, database, dependencies and `.env*` untouched.
- Static verification only; owner acceptance (new and resumed workouts, desktop, tablet, mobile) pending. Not marked accepted.
## 0.85.323 status (2026-11-26): MOBILE LOGOUT CORRECTION - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. Package versions remain `0.85.308` (task label only). Logout confirmation is the `/logout` route page (`Logout.vue`); Confirm runs the shared `useAuth().logout()`; Cancel returns to the dashboard.
- Corrected: no silent redirect to login on a session-probe failure; failed logout shows an error and keeps the confirmation (`stayOnFailure`, default behavior of other callers unchanged); Profile dropdown Sign Out opens the confirmation. Files: `Logout.vue`, `useAuth.js`, `ProfileDropdown.vue`. Backend, database, dependencies, `.env*` untouched.
- Static verification only; owner mobile acceptance pending. `0.86` not started.
## 0.85.320 status (2026-11-25): 0.85 COMPLETE - OWNER ACCEPTED

- Milestone `0.85` is declared complete by the project owner (owner statement). Branch `BETA`. Package versions remain `0.85.308`. All eight initial Global Workout Plans are owner-verified and published: Maintain Health - Active Lifestyle & Mobility; Maintain Health - Total Body Wellness; At Home - Full Body - Light Dumbbells; At Home - Full Body (No Equipment); Build Muscle - Beginner Full Body; Build Muscle - 4 Day Hypertrophy; Weight Loss - Full Body; Weight Loss - Beginner Full Body.
- Milestone acceptance is an owner statement and does not retroactively mark individual task checks as passed; deferred items (live QA backlog WA-QA-309-01 to 04, WA-QA-299-01, WA-UI-TABLET-001, WA-CONTENT-003, 0.85.317 follow-ups) keep their recorded status. Documentation-only checkpoint; no tests, builds or startup run.
- Next milestone: `0.86` (Google OAuth, user registration and workflow improvements, public-facing frontend, Global Workout Plan presentation on the public website, registration to Global Plan selection integration). Not started; needs explicit task authorization. Then `0.87` iPhone and `0.88` Android.

## 0.85.318 status (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. Both Schedule Planner Add Day buttons (top and bottom, class `planner-group-add`) now use `#2563EB` with white text via one scoped CSS block at the end of the `<style>` in `frontend/src/views/Member/WorkoutBuilder.vue` (hover/active `#1D4ED8`, blue focus ring). Add Exercise stays green; Add Week, shape, size, alignment and responsive behavior unchanged. Static verification only; manual acceptance pending. `0.85.316.4` and `0.85.317` also pending.

## 0.85.317 status (2026-11-25): RECORDING TYPE CORRECTION IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. Saved plan exercises carry no Recording Type (the plan API neither stores nor returns it), so Edit/View blocks showed Sets & Reps fields for Cardio exercises. The builder now resolves a missing Recording Type from the loaded Exercise Database catalog by `exerciseId` (shared helpers in `frontend/src/utils/exerciseRecordingFields.js`, used by `WorkoutExerciseBlock.vue` and `WorkoutBuilder.vue` preview); explicit values win and Workout Type is still never used. Catalog values for Marching in Place, Step Jacks (No Jumping) and Standing Knee Raises are unverified (no database access; database not modified). Backend persistence of Recording Type is an unapproved alternative. Static verification only; manual acceptance pending. `0.85.316.4` also still pending.

## 0.85.316.4 status (2026-11-25): HORIZONTAL WEEK NAVIGATION IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. Owner stated `0.85.316.3.a4` (and `0.85.316.3`) accepted. Schedule Planner in `frontend/src/views/Member/WorkoutBuilder.vue`: the Week dropdown is replaced by horizontal week tabs (max 4 visible, arrows above 4 weeks shift the window and never change the selection). Header order: title + Add Week + More menu, then tabs, then Add Day. First Add Day (top or bottom) on a plan with no weeks creates and selects `Week 1`. `selectedWeek` stays name-keyed; tab keys use the identity id. Source-contract tests were updated but not run. Static verification only; manual acceptance pending. `0.85.316.5` not started.

## 0.85.316.3.a4 status (2026-11-25): OWNER ACCEPTED (owner-stated)

- Sub-fix of `0.85.316.3`, branch `BETA`, uncommitted. Owner stated `0.85.316.3.a3` accepted. Workout Plan Information accordions now allow one open at a time (single `openAccordion` state in `WorkoutMetadataForm.vue`; Plan Information open by default; clicking the open one collapses it; all may be collapsed; validation reveal opens the accordion of the first invalid field, order Plan Name, Category, Workout Type). Values retained; styling and layout unchanged. Static verification only; manual acceptance pending. `0.85.316.4` not started.

## 0.85.316.3.a3 status (2026-11-25): OWNER ACCEPTED (owner-stated)

- Sub-fix of `0.85.316.3`, branch `BETA`, uncommitted. `0.85.316.3.a2` failed owner acceptance (header buttons still pill-shaped). Cause: global `border-radius: 999px !important` on `button` in `frontend/src/styles/design-system.css`. Fix in `WorkoutMetadataForm.vue`: scoped `border-radius: 0 !important` on `.plan-accordion__header` (all states) and the open header. Global styles untouched. Static verification only, not visual; manual acceptance pending.

## 0.85.316.3.a2 status (2026-11-25): FAILED OWNER ACCEPTANCE (superseded by a3)

- Sub-fix of `0.85.316.3`, branch `BETA`, uncommitted. Accordion headers in `WorkoutMetadataForm.vue` are rectangular (`border-radius: 0`; wrapper radius also 0 so they sit flush). Colors, height, spacing, behavior and other controls' radii unchanged. CSS only; static verification only; manual acceptance pending.

## 0.85.316.3.a1 status (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Sub-fix of `0.85.316.3`, branch `BETA`, uncommitted. Accordion headers in `WorkoutMetadataForm.vue` now use `#203252` (collapsed) and `#24477E` (expanded) with white text and chevron. CSS only; nothing else changed. Static verification only; manual acceptance pending (as is `0.85.316.3`).

## 0.85.316.3 status (2026-11-25): VERTICAL ACCORDIONS IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. Task label only; package versions remain `0.85.308`. The owner stated that `0.85.316.2` and `0.85.316.2.a1` are accepted (supersedes the pending wording of the blocks below).
- Create and Edit Workout Plan: the accepted two-column layout is kept; the right panel now holds four vertical accordions (Plan Information expanded; Goal, Settings, Description collapsed). Objectives & Goals controls moved into Goal; Workout Plan Type label renamed Plan Type. 35/65 label/input rows, equal-height panels, stacked at 768px and below. Collapsed fields keep values and stay validated; `revealField()` opens the owning accordion on validation failure.
- Files: `WorkoutMetadataForm.vue`, `WorkoutBuilder.vue`. Verification: static only; no tests, build or server run. Pending: owner manual acceptance. `0.85.316.4` not started.

## 0.85.316.2.a1 status (2026-11-25): SUB-FIX IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted. The owner rejected `0.85.316.2` (panels stacked in the left ~33%). Root cause: legacy desktop rule `.metadata-section--plan-info, .metadata-section--goals { grid-column: 1; }` in `WorkoutMetadataForm.vue` forced the right panel into column 1. Fixed in that file's scoped CSS only (rule narrowed to goals; explicit column 1 / column 2 placement; mobile reset to one 100% track). Supersedes the 0.85.316.2 block below. Static verification only; manual acceptance pending. `0.85.316.3` not started.

## 0.85.316.2 status (2026-11-25): TWO-COLUMN LAYOUT IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted working tree. Task label only; package versions remain `0.85.308`. The owner stated that `0.85.316.1` and `0.85.316.1.a1` are accepted (owner-stated; supersedes the pending-acceptance wording of the 0.85.316.1 block below).
- `WorkoutMetadataForm.vue` and `WorkoutBuilder.vue` (cover CSS only): Create and Edit Workout Plan show Cover Image on the left (~33%) and Workout Plan Information on the right (~67%); Objectives & Goals unchanged below both columns; stacks at 768px and below; cover image keeps its aspect ratio.
- Verification: static only (diagnostics clean, CRLF kept); no tests, build or server run. Pending: owner manual acceptance.

## 0.85.316.1 status (2026-11-25): IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `BETA`, uncommitted working tree. Task label only; package versions remain `0.85.308`.
- `frontend/src/views/Member/WorkoutBuilder.vue` only: Create and Edit Workout Plan `Back to Plans` / `Save` now sit in the right of the section header (Save far right), and the View preview `Back to Plans` / `Use Plan` sit beside the preview title (Use Plan far right). Original action-button rows removed (View bottom row retained). Header wraps on mobile. Labels, icons, colors, handlers, permissions and validation unchanged.
- Verification: static only (diagnostics clean, CRLF kept); no tests, build or server run. Pending: owner manual acceptance at desktop/tablet/mobile widths.

## 0.85.cleanup final status (2026-11-25): MERGED INTO BETA - CLEANUP BRANCH RETIRED - POST-MERGE QA PENDING

- Supersedes the a1-a3 and earlier cleanup blocks below (kept for history). The cleanup checkpoint commit was merged into BETA with an explicit merge commit and BETA was pushed; the local `0.85.cleanup` branch was retired after ancestry verification. Baseline was BETA = `origin/BETA` = `6fdec96255110ce1588051bbf93afde2073a38b6`; exact SHAs are in Git history. Package versions remain `0.85.308`.
- Completed: five cleanup batches, 165 template files removed, routes 81 -> 37, mobile navigation repair, reduced debugging overhead, session request deduplication, parallel dashboard requests, application-shell optimisation. Owner confirmed noticeable performance improvement and authorised integration and branch retirement.
- Outstanding: full regression testing PENDING; authentication regression testing PENDING; no measured performance benchmark exists; Vue `parentNode` exception not conclusively resolved; responsive breakpoint improvements deferred. Untracked `APP-CLEANUP-INVENTORY.md` remains uncommitted. 13 stashes preserved.

## 0.85.cleanup.5.a3 status (2026-11-25): PERFORMANCE OPTIMIZATION IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`, uncommitted working tree. Task label only; package versions remain `0.85.308`. a2 repairs preserved. Final cleanup acceptance remains BLOCKED.
- Owner feedback after a2: works but slow. Source-level findings (not measured): up to 4-5 `/api/session` requests per dashboard load (each a role lookup plus a `users` SELECT), a sequential session -> profile -> dashboard waterfall in `HomeDashboard.vue`, per-navigation stylesheet/storage rewrites, duplicate shell sync, a never-removed click listener and an unused leaking resize listener.
- Applied to 7 source files: `composable/useAuth.js` (pending `/api/session` requests are shared for callers within 500 ms; nothing cached; stale responses ignored after logout or when a newer response was applied; `fetchSessionSnapshot` export), `router/index.js` (guard uses the shared request; still validates the server session on every protected navigation; redirect rules unchanged), `composable/primaryColorChangeSetting.js` (idempotent), `App.vue` (duplicate sync removed, click listener lifecycle fixed), `layouts/App.vue` (guarded `display` write), `components/HeaderComponent.vue` (dead resize logic removed, shared session request), `views/Member/HomeDashboard.vue` (concurrent loading).
- Verification: static only (checkpoint, 165 deletions, 37 route paths, 13 stashes, a2 diffs unchanged, CRLF, editor diagnostics). No tests, build or server run; no timing measured.
- Unresolved: Vue `parentNode` exception (not claimed fixed). Deferred: remaining direct session fetches (`Logout.vue`, `exercises.vue`, `LogWorkout.vue`, `WorkoutBuilder.vue`, `UpdatePassword.vue`, `router/Session.js`), the sidebar session request on each 768 px crossing, breakpoints, header offset, dead drawer CSS, AOS, nested overflow.
- Pending: owner manual performance and mobile/tablet acceptance.

## 0.85.cleanup.5.a2 status (2026-11-25): TARGETED REPAIR IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`, uncommitted working tree. Task label only; package versions remain `0.85.308`. Final cleanup acceptance remains BLOCKED.
- `0.85.cleanup.5` FAILED mobile/tablet acceptance (owner testing). Read-only investigation `0.85.cleanup.5.a1` (static only) found the defects predate cleanup (implicated files unchanged against baseline): unconditional `ProfileDropdown.vue` debug logging and `/api/debug/*` requests on every pointer event and route change, and self-referential custom properties in `AppBottomNav.vue`.
- Repair applied to exactly two source files: `frontend/src/components/ProfileDropdown.vue` (diagnostics off by default; opt-in via `localStorage` key `wa:debug:profile-dropdown` = `1`; closed-state early returns) and `frontend/src/components/navigation/AppBottomNav.vue` (cyclic `--wa-mobile-bottom-nav-height` / `-gap` removed; `70px` fallback on `height`). No router, auth, `App.vue`, `HeaderComponent.vue`, CSS/SCSS, backend or package change.
- Verification: static only (repository checkpoint, 165 deletions, 37 route paths, 13 stashes, BETA, diff scope, editor diagnostics). No tests, build or server run; no runtime result recorded.
- Unresolved: the Vue `parentNode` exception (likely secondary to an earlier failed patch; first error unknown; not claimed fixed). Deferred: per-navigation `/api/session` guard and duplicate session calls, fragmented breakpoints (767/768/769/991/1199; exact 768 mixed state), header height versus `.body-p-top`, dead drawer CSS, AOS, nested overflow containers.
- Pending: owner manual mobile/tablet acceptance and any further evidence (first console error with source-mapped stack, Performance recording, Network counts).

## 0.85.cleanup.5 status (2026-11-25): IMPLEMENTED - PENDING FINAL OWNER ACCEPTANCE (mobile/tablet acceptance subsequently FAILED; see the a2 block above)

- Branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`, uncommitted working tree. Task label only; package versions remain `0.85.308`.
- Acceptance of earlier batches: Batches 1, 2, 3 and 4 manual acceptance was not stated by the owner; all remain PENDING. Final cleanup acceptance PENDING.
- Batch 5 applied: 4 unused template composables deleted (`chartsDataManage.js`, `dashboardManage.js`, `nestableList.js`, `sweetalertManage.js`; 1,786 lines). No route or navigation change. Cumulative: 165 files, 44 routes removed, 81 -> 37 route paths, frontend diff 170 files / 17,470 deleted lines / 1 added. Exact lists: [APP-CLEANUP-INVENTORY.md](APP-CLEANUP-INVENTORY.md).
- Preserved: all protected reusable components (`PagePanelHeader`, `TextEditorComponent`, `DigiDataTable`, both `TableFilterOption`, `DropzoneComponent`, `FolderList`, `HeaderCalculator`, `DateRangePicker`, modal and navigation components), `sidebarMenu-TEMPLATE.js`, the unreachable `template/MainSidebarComponent.vue` (its missing `@/composable/sidebarMenu` import is pre-existing and not repaired), packages, assets, CSS/SCSS and backend.
- Verification: static only. No tests, build or server run.
- Pending: owner manual acceptance and final cleanup verification. No further batch authorised. BETA integration NOT AUTHORIZED.

## 0.85.cleanup.4 status (2026-11-25): BATCH 4 IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`, uncommitted working tree. Task label only; package versions remain `0.85.308`.
- Acceptance of earlier batches: Batch 1, 2 and 3 manual acceptance was not stated by the owner; all three remain PENDING (the owner authorised the next batch each time without acceptance wording).
- Batch 4 applied: 48 unused Digiboard UI demonstration files deleted (10 views: charts, form, icon, map, table, animation, nestable list, sweet alert, swiper slider, utility; 38 exclusively owned components: 16 charts, 11 tables, 4 dragable, 4 product, 2 slider, `ProductTableAction`); 10 routes removed (`/sweet-alert`, `/nestable-list`, `/animation`, `/swiper-slider`, `/form`, `/table`, `/charts`, `/icon`, `/map`, `/utility`); route paths 47 -> 37. No navigation file changed (no live reference existed). Cumulative: 161 files, 44 routes, 81 -> 37 paths. Exact lists: [APP-CLEANUP-INVENTORY.md](APP-CLEANUP-INVENTORY.md).
- Preserved (6 of the 54 inventory files): `PagePanelHeader.vue`, `TextEditorComponent.vue`, `datatable/DigiDataTable.vue`, `datatable/TableFilterOption.vue`, `form/DropzoneComponent.vue` (owner-protected) and `employee/TableFilterOption.vue` (same name as a protected file). Now unreferenced; Batch 5 candidates. Also preserved: composables `nestableList.js` and `chartsDataManage.js`, `filemanager/FolderList.vue`, `HeaderCalculator.vue`, `sidebarMenu-TEMPLATE.js`, packages, assets, CSS/SCSS.
- Verification: static only. No tests, build or server run. No backend, DB, package, lockfile, CSS/SCSS, asset or environment change.
- Pending: owner manual acceptance. Batch 5 not started and not authorised. BETA integration NOT AUTHORIZED.

## 0.85.cleanup.3 status (2026-11-25): BATCH 3 IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`, uncommitted working tree. Task label only; package versions remain `0.85.308`.
- Acceptance of earlier batches: Batch 1 and Batch 2 manual acceptance was not stated by the owner; both remain PENDING (the owner authorised the next batch each time without acceptance wording).
- Batch 3 applied: 19 unused template demonstration views deleted (authentication, registration, status, pricing, subscription, promotion and email-template mock-ups); 14 routes removed (`/registration-2`, `/login-status`, `/account-deactivated`, `/welcome`, `/email-verify`, `/two-factor`, `/multi-step-signup`, `/pricing-table`, `/pricing-table-2`, `/card-declined`, `/promotion`, `/subscription-confirm`, `/welcome-mail`, `/reset-password-mail`); route paths 61 -> 47. `layouts/Guest.vue` lost its stale `pricing_table` entry; `Blank.vue` preserved. Cumulative: 113 files, 34 routes, 81 -> 47 paths. Exact lists: [APP-CLEANUP-INVENTORY.md](APP-CLEANUP-INVENTORY.md).
- Preserved: real authentication (`views/Guest/*`, `/login`, `/register`, `/terms-policy`, `/reset-password`, `/update-password`, `/ext-register`, `/logout`), guards, session handling, backend and Google sign-in preparation; `ComingSoon`, `ComingSoon2`, `UnderConstruction` views and routes; `filemanager/FolderList.vue` (outside every approved inventory).
- Verification: static only. No tests, build or server run. No backend, DB, package, lockfile, CSS/SCSS, asset or environment change.
- Pending: owner manual acceptance. Batch 4 not started and not authorised. BETA integration NOT AUTHORIZED.

## 0.85.cleanup.2 status (2026-11-25): BATCH 2 IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`, uncommitted working tree. Task label only; package versions remain `0.85.308`.
- Batch 1 context: manual testing of a1 reported broken menu links; the read-only `0.85.cleanup.1.a2` investigation found no live link broken by Batch 1 and could not reproduce the symptom (unverified hypotheses: session-guard redirect while the DB credential blocker persists, stale dev server, runtime page errors). No formal Batch 1 acceptance statement was supplied; the owner authorised Batch 2.
- Batch 2 applied: 27 template files deleted (6 views, 21 components) for chat, standalone calendar, email, invoices, contacts and file manager; 6 routes removed (`/chat`, `/calendar`, `/email`, `/invoices`, `/contact`, `/file-manager`); route paths 81 -> 67 -> 61. Navigation edits: Trainer section and Administrator Scheduling/Chat removed from `sidebarMenu.js`; Message link removed from `ProfileRightSidebarComponent.vue`; Chat/Scheduling role actions removed from `HomeDashboard.vue`. Cumulative: 94 files, 20 routes. Exact lists: [APP-CLEANUP-INVENTORY.md](APP-CLEANUP-INVENTORY.md).
- Preserved: `/hrm-dashboard`, `/view-profile`, `/edit-profile`, `/settings`, profile dropdown, shared date-range picker, shared sidebar components, all packages (no dependency cleanup). Skipped: orphan `filemanager/FolderList.vue` (never in an approved batch; the inventory has 27 files, not 28).
- Verification: static only. No tests, build or server run. No backend, DB, package, lockfile, CSS/SCSS or environment change.
- Pending: owner manual acceptance. Batch 3 not started and not authorised. BETA integration NOT AUTHORIZED.

## 0.85.cleanup.1.a1 status (2026-11-25): BATCH 1 IMPLEMENTED - PENDING OWNER ACCEPTANCE

- Branch `0.85.cleanup` at `6fdec96255110ce1588051bbf93afde2073a38b6`, uncommitted working tree. Task label only; package versions remain `0.85.308`.
- Batch 1 (CRM, HRM, e-commerce demos) applied: 67 template files deleted (16 views, 51 components), 14 routes removed from `routing.js`, Taskboard link removed from `ProfileRightSidebarComponent.vue`. `/hrm-dashboard` retained. Exact lists: [APP-CLEANUP-INVENTORY.md](APP-CLEANUP-INVENTORY.md).
- Verification: static only (import, route, Git diff checks). No tests, build or server run. No backend, DB, package, lockfile, CSS/SCSS or environment change.
- Pending: owner manual acceptance. Batches 2-5 not started and not authorised. BETA integration NOT AUTHORIZED. The earlier failed `0.85.cleanup.1` and its rollback (below) remain recorded history.

## 0.85.cleanup.1 status (2026-11-24): FAILED ACCEPTANCE — ROLLBACK REQUESTED

- Rolled back: the 161 deleted files and 4 modified source files were restored from `6fdec962` (working tree only; frontend and backend identical to the base commit). The statements below describe the superseded implementation and are kept as history.
- Environment: `backend/.env` present and untouched by this task. `npm run dev` starts frontend (5173) and backend (5000), but the configured MySQL server rejects the connection (`ER_ACCESS_DENIED_ERROR`); DB-backed routes return 503. Owner must check the DB credential or remote-access allowlist. No further cleanup authorised; BETA integration NOT AUTHORIZED.
- (Superseded) Task `0.85.cleanup.1` (Controlled Legacy Template Feature Removal) was implemented in the working tree of `0.85.cleanup` (HEAD `6fdec962`, uncommitted). Owner decision recorded: both profile pages are retained.
- Removed: 44 template demo routes, 51 template views, 110 exclusively owned template components; nav and profile-sidebar links to removed features. 4 files modified; no backend, DB, package, lockfile or CSS/SCSS change.
- Automated verification: frontend tests 140/140, Vite build OK, backend tests 238/238, `users.js` unchanged, 13 stashes intact.
- Pending: manual browser acceptance; user acceptance PENDING; BETA integration NOT AUTHORIZED. Deferred items and risks: [APP-CLEANUP-INVENTORY.md](APP-CLEANUP-INVENTORY.md) (execution status section).

## 0.85.cleanup branch status (distinct from BETA status below)

- Branch: `0.85.cleanup`, created 2026-11-24 from verified `BETA` HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`. This supersedes the stale "Latest verified HEAD" value `b7a44817...` recorded in the BETA block below; the BETA block itself has not been rewritten.
- Task: Application and Legacy Template Inventory. Investigation only; no source, dependency, database or API change.
- Deliverable: [APP-CLEANUP-INVENTORY.md](APP-CLEANUP-INVENTORY.md).
- Verification: Git state checks and read-only static analysis; no build, test, server or browser run.
- Blockers: none. Open questions: section 14 of the inventory.
- Pending: every cleanup recommendation awaits user approval; no commit or push has been made on this branch.
- Protected: PlanID 5, personal workout history, auth/session/security, roles, plans, logging, nutrition, profiles, Global/Featured Plans, gateway/storage/DB integrations, production API.

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
- Tests (a8.1 checkpoint): backend focused suites `78/78`; frontend 13 files / 140 tests pass; Vite build passed. The full backend run is superseded by the a9 verification below.
- Open: no browser check; live DB index state unverified; label-keyed readers see compatibility names for repeated labels; `PUT /workout-schedules/:id/groups` and the conversion engine still use the label path; a8.1 committed and pushed as `fe82ef325`. Acceptance PENDING.

## 0.85.313.a9 Final Regression and Acceptance (Stage 10/10) - 2026-11-21

- Verification only; no code, schema, package or deployment change. a8.1 was reviewed, committed and pushed first (`fe82ef325`, branch `0.85.113`, acceptance pending). Package versions `0.85.308`. 0.85.313 is NOT declared accepted and is not merged into BETA.
- Backend: dependencies restored with `npm ci` (existing lockfile, no package file change). Default `node --test`: 178 tests, 165 pass, 13 fail, all `Missing database environment variables` at module load (no `backend/.env`; environmental). With throwaway in-process DB variables at an unreachable address: 238/238 pass. Frontend: 13 files / 140 tests pass; Vite build passed. `users.js`: 37 routes, same order. PlanID 5 untouched (no data access).
- Audit: no defect found on the paths the current frontend uses. Open items: conversion engine writes compatibility names (for example `Push (Week 2)`) as labels in a converted copy of a plan with repeated day names; `PUT /workout-schedules/:id/groups` deletes and re-inserts all groups (ids change, exercise links `SET NULL`) and has no frontend caller; session label fallback only applies when `workout_day_id` is missing or invalid. Indexes: repository schema and the 0.83 backup define only non-unique keys on `workout_schedule_groups`; the live state is unverified.
- Open: browser acceptance and live DB index check by the user. Acceptance PENDING.

## 0.85.313 merged into BETA - 2026-11-21

- Merge: `0.85.113` (HEAD `e7b6059e8`, "0.85.313 - Unified Multi-Week Schedule Planner - QA Checkpoint") merged into `BETA` with a true merge commit (`--no-ff`). The merge commit hash is the commit that contains this entry (see `git log --merges -1 BETA`). Rollback hash (BETA before merge): `df1f026d506c50456b477e0777a98bb55c2e1977` (0.85.312 recovery checkpoint).
- Conflicts resolved (10 files, nothing else changed): `WorkoutBuilder.vue` `showBottomScheduleGroupControls` keeps the 0.85.313 selected-week-aware logic (`visibleDayGroups` for the schedule check, exercises counted from the selected week's days). The 0.85.312 requirements remain in force within the selected week: the bottom Add Day control needs at least one visible schedule and at least two unique exercises. `WorkoutBuilder.preview-mobile-contract.test.mjs`: both the 0.85.312 and 0.85.313.a1/a3.2 tests retained, with added assertions that the exercise count derives from the visible day groups and that the control is gated by `showBottomScheduleGroupControls`. Eight documentation files: both histories kept (0.85.312 recovery entries and all 0.85.313 development entries); no entry removed.
- Note: the originally approved final regression commit `0d46d7703` was amended before push into `e7b6059e8` (identical tree; `git diff 0d46d7703 e7b6059e8` is empty).
- Verification (automated): frontend 13 test files, 140/140 pass; backend default run 178 tests (165 pass, 13 environmental failures: missing DB environment variables, none are code defects); backend with isolated throwaway in-process variables 238/238 pass; Vite production build passes; security gate `SECURITY_GATE_PASS`; all 37 `backend/api/users.js` routes present and in identical order to `0.85.113`, `BETA` before merge and baseline `bf66ec03e`.
- Safety: no database change, migration, package/version change, server restart or deployment; PlanID #5 untouched; all 13 Git stashes preserved; no force push or branch deletion.
- User acceptance: PENDING. Browser acceptance and the live-database index verification have not been performed. An automated pass is not user acceptance. Open audit items unchanged: conversion engine writes compatibility names as labels for repeated day names, dormant `PUT /workout-schedules/:id/groups`, session label fallback.
