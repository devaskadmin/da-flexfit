# WorkoutAtlas 0.85.cleanup - Application and Legacy Template Inventory

**Task type:** inventory and analysis only. No application source, CSS/SCSS, dependency, database, API or configuration change was made.
**Date:** 2026-11-24
**Branch:** `0.85.cleanup` (created from verified `BETA`)
**Base commit:** `6fdec96255110ce1588051bbf93afde2073a38b6` ("Merge branch '0.85.113' into BETA", 2026-11-21)
**Package versions:** frontend `0.85.308`, backend `0.85.308`
**Status of every recommendation in this document:** PENDING USER APPROVAL. Nothing here is authorized for removal.

## How to read this document

- **Confirmed (static)** means the finding comes from a read-only static analysis of the repository at the base commit (import graph, route table, `grep`, file sizes). It has not been confirmed by running the application, a build, a test suite or a browser. No build or test was run for this task.
- **Suspected** means the evidence is a lexical or heuristic match and may contain false positives or false negatives.
- **UNKNOWN** means the repository does not contain enough evidence to decide.
- Recommendation labels: `KEEP`, `REVIEW`, `REMOVAL CANDIDATE`, `UNKNOWN`. `REMOVAL CANDIDATE` means "worth proposing in a later approved batch", not "safe to delete now".
- Nothing is classified as unused merely because it is absent from the navigation menu. Dynamic imports, runtime-built URLs, localStorage-driven behavior and environment variables were checked where the analysis could see them (see Appendix A for what the analysis cannot see).
- No performance, load-time or bundle-size improvement is claimed. Byte counts below are repository file sizes, not shipped bundle sizes.

---

## 1. Executive summary

WorkoutAtlas is a Vue 3 / Vite 4 single-page frontend plus a Node 22 / Express 4 / MySQL backend. The frontend was built on a purchased ThemeForest admin template, **"Digiboard - Admin & Dashboard HTML Template" by Codebasket** (named in the header of `frontend/src/assets/css/style.css` and `frontend/src/assets/scss/style.scss`). The template's demo pages, components and stylesheets are still in the repository next to the custom WorkoutAtlas code.

Key numbers (static analysis, base commit):

| Measure | Value |
|---|---|
| Tracked files in `VueJSApps/WorkoutAtlas` | 7,829 (backend 4,545; frontend 3,207; docs 51) |
| Frontend code files analysed (excluding `assets/Excerises-OLD`) | 387, of which 261 are reachable from `main.js` by static import |
| Frontend code files not reachable by static import (non-test) | 113 (50 stylesheet files, 17 template components, 7 template views, 25 Widgets/ui/design-system components, 14 other) |
| Template views / template components | 63 files / 124 files (about 0.4 MB and 0.3 MB of source) |
| Routes declared in `router/routing.js` | 81 (16 custom app, 7 custom guest, 56 using template components, 2 redirects) |
| Template-component routes with no live reference outside the demo menu | 39 |
| Backend route declarations (static) | 144 by line-start count in 18 locations (a second scan counted 142); 1 is in an unmounted module |
| Large tracked data sets | `backend/workoutatlas-s3-data` 94 MB (live), `frontend/src/assets/Excerises-OLD` 95 MB (no code reference found), `backend/free-exercise-db-main` 96 MB (no code reference found) |

Major findings:

1. **The template is mostly isolated but not removable in one step.** It is reachable only through about 56 template routes plus a small set of live couplings: the live sidebar renders through `components/template/menu/SidebarMenuComponent.vue`; two live pages use `components/template/DateRangePicker.vue`; the router guard and guest layout use the template error pages; and the live sidebar and profile menus link to template demo pages (Chat, Calendar, View Profile, Edit Profile, Task). Those couplings must be resolved before any template deletion.
2. **The template demo routes have no backend and no route-level role guard.** Any logged-in user can open the demo pages by URL (static review of `router/routing.js` and `router/index.js`). The demo data is static.
3. **The sidebar's Trainer/Administrator entries "Chat with Trainer", "Chat" and "Scheduling" point to static template demos** (`chat`, `calendar`), not to a backend-backed feature. This needs a product decision before cleanup.
4. **Several unreachable legacy files exist** (`views/HomeDashboard.vue`, `views/LogWorkout.vue`, `views/Member/nutrition.vue`, `components/sidebarMenu-TEMPLATE.js`, `components/template/MainSidebarComponent.vue`, unused `ui/` and `design-system/` component sets, unused Widgets). `nutrition.vue` calls `POST /api/food-items`, whose backend module is never mounted.
5. **The color-theme stylesheets are loaded at runtime, not by static import.** `App.vue` calls `setStyleSheet(VITE_DEFAULT_COLOR || 'blue-color')`, which sets a `<link id="primaryColor">` href to `/src/assets/css/<color>.css`. `blue-color.css` is therefore live. The other nine color files are used only if `VITE_DEFAULT_COLOR` is set to them; the production value is not in the repository (UNKNOWN). A naive "unreachable" scan would wrongly flag `blue-color.css`.
6. **Licensing risk to verify:** the vendored `all.min.css` header reads "Font Awesome Pro 6.3.0", and the repository contains Pro-only font assets. No license document for Font Awesome Pro or for the ThemeForest template is present in the repository.
7. **Repository hygiene:** 16 `frontend/tmp-0852*.png` screenshots, `tmp_backend_full_test_085285.txt`, `backend/__diag_individual_summary.txt`, a stray test upload under `public/assets/Excerises/`, a WordPress plugin file (`frontend/plugins/simple-admin-page.php`), and two large duplicated third-party exercise datasets.
8. **Debug and diagnostic endpoints are called from live UI** (`/api/debug/mobile-menu` from `ProfileDropdown.vue`, `/api/debug/login-diagnostics` from `Login.vue`, `/api/bootstrap/promote-self-admin` from `AdminUsers.vue`). They need an explicit keep/remove decision before any backend cleanup.

Highest-priority removal candidates (all pending approval): stray `tmp-*` artifacts and screenshots, unreachable legacy views, `sidebarMenu-TEMPLATE.js`, the dead `components/template/MainSidebarComponent.vue`, unused `ui/` and `design-system/` components, unused npm dependencies, and (after decisions) the template demo routes. See section 11.

Blockers: none for the inventory. Open decisions are listed in section 14.

---

## 2. Repository and architecture overview

### 2.1 Layout (`VueJSApps/WorkoutAtlas`)

| Area | Tracked files | Notes |
|---|---|---|
| `backend/` | 4,545 | 1,738 + 12 + 1 under `workoutatlas-s3-data` (local media root), 2,619+ under `free-exercise-db-main` (third-party dataset), the rest is application code |
| `backend/api`, `services`, `utils`, `middleware`, `Components`, `src/routes`, `data`, `migrations` (37), `schema` (6), `scripts` (6), `tests` (26), `docs` (4) | ~150 | Express application |
| `frontend/` | 3,207 | `src` 3,148 (assets 2,818, components 174, views 96, composable 19, utils 17, i18n 5, config 4, layouts 3, router 3, stores 2, styles 2, services 1) |
| `docs/` | 51 | Engineering, QA, governance, product, operations, architecture |
| root files | - | `README.md`, `AGENTS.md`, `CHANGELOG.md` (4,383 lines), `WORKOUTATLAS_BATCH_RESULTS.md`, `DATABASE_SCHEMA.md`, `tmp_backend_full_test_085285.txt`, `.github/`, `.gitlab/`, `scripts/security/` |

### 2.2 Stack (from `package.json`, `vite.config.js`, `server.js`)

- Frontend: Vue 3.5, Vite 4, Vue Router 4, Pinia, vue-i18n 9, Bootstrap 5 (vendored CSS), ApexCharts (`vue3-apexcharts`), FullCalendar, CKEditor 5, AOS, Swiper, SweetAlert2, vuedraggable. Scripts: `dev`, `build`, `preview`.
- Backend: Express 4, `mysql2`, `express-session` with `connect-mysql2` store, `multer`, `google-auth-library`, `nodemailer`, `bcryptjs`, `cors`, `dotenv`, `axios`. Scripts: `test` (`node --test`), `dev`, `dev:backend`.
- Frontend entry: `frontend/src/main.js` imports `styles/design-system.css`, vendored `all.min.css` (Font Awesome Pro 6.3.0), `bootstrap.min.css`, `assets/css/style.css`, `assets/css/mobile.css` and `assets/scss/default-dark.scss`. The line importing `assets/scss/style.scss` is commented out; `style.css` is the compiled template stylesheet.
- Layouts: `layouts/App.vue` (authenticated shell with sidebar/header), `layouts/Guest.vue`, `layouts/Blank.vue`.

### 2.3 Architecture and template lineage

```mermaid
flowchart LR
  main[main.js] --> App[App.vue]
  App --> Router[router/index.js + routing.js]
  Router --> Custom[Custom views: Guest, Member, ToolsView]
  Router --> Tmpl[views/template: 63 demo views]
  Custom --> LiveComp[Custom components]
  Tmpl --> TmplComp[components/template: 124 files]
  LiveComp -. 3 live couplings .-> TmplComp
  App --> Composables[theme / navbar / preloader composables]
  Composables -. runtime href .-> ColorCSS[assets/css/*-color.css]
  Custom --> API[/api/* Express backend]
  Tmpl -. no backend .-> X[(static demo data)]
```

The dotted "live couplings" are enumerated in section 9.

---

## 3. Complete application feature inventory

Origin legend: **Custom** (WorkoutAtlas-specific, with matching backend), **Template** (inherited from Digiboard), **Hybrid** (custom page built on template shell/classes), **Unknown**.
Status legend: **Active** (reachable route and/or live caller), **Potentially unused**, **Uncertain**.

### 3.1 Custom features (all KEEP; protected)

| # | Feature | Purpose | Main files | Routes / nav | Origin | Status | Rec. | Evidence |
|---|---|---|---|---|---|---|---|---|
| F1 | Login, logout, Google OAuth, registration, password reset | Authentication and account creation | `views/Guest/Login.vue`, `register.vue`, `ForgotPassword.vue`, `UpdatePassword.vue`, `ExternalRegister.vue`, `TermsPolicy.vue`, `Member/Logout.vue`; `backend/api/auth.js`, `services/googleIdTokenVerificationService.js` | `/login`, `/register`, `/reset-password`, `/update-password`, `/ext-register`, `/terms-policy`, `/logout` | Custom (Hybrid styling) | Active | KEEP | Routed; `auth.js` mounted; many callers |
| F2 | Sessions, security, authorization | Server sessions (`connect-mysql2`), route guard, trusted-origin checks, admin middleware | `router/index.js`, `router/Session.js` (unreachable, see RC-05), `backend/server.js`, `middleware/requireAdmin.js`, `composable/useAuth.js` | n/a | Custom | Active | KEEP | `server.js` mounts session middleware and `requireAdmin` |
| F3 | User / Trainer / Admin roles | Role-based nav and admin pages | `Member/AdminUsers.vue`, `AdminRoles.vue`, `AdminRoleTester.vue`, `ToolsView.vue`; `backend/api/admin.js` | `/admin/users`, `/admin/roles`, `/admin/test-roles`, `/tools` | Custom | Active | KEEP | Nav entries in `components/sidebarMenu.js`; `admin.js` mounted |
| F4 | Exercise library and favorites | Browse, create, edit, favorite exercises; media | `Member/exercises.vue`, `components/workout-builder/ExercisePickerModal.vue`, `composable/exerciseFilters.js`, `utils/exerciseImage.js`; `backend/api/excerises.js`, `api/media.js`, `Components/ImageUpload/ImageUpload.js`, `services/mediaResolver.js` | `/exercises` | Custom | Active | KEEP | Routed; 13 routes in `excerises.js` |
| F5 | Workout plans and Schedule Planner | Create/edit plans, weeks, days, exercises; templates; covers | `Member/WorkoutBuilder.vue` (about 436 KB), `components/workout-builder/*`, `utils/workoutDayWeekAssignment.mjs`, `workoutPlan*.js`; `backend/api/users.js` (37 routes), `services/workoutPlan*.js`, `utils/workoutPlan*.js` | `/workout-builder`, `/workouts/:planId` | Custom | Active | KEEP | Routed; 13 frontend test files cover builder contracts |
| F6 | Find Plans, Global and Featured Plans | Marketplace, adopt/clone, Featured plan at registration | `Member/FindPlans.vue`, `WorkoutDetail.vue`; `users.js`, `auth.js` | `/find-plans`, `/workouts/:planId` | Custom | Active | KEEP | Routed; protected PlanID #5 concerns |
| F7 | Workout logging, timers, sessions, history | Log workouts, pause/resume/end sessions, history edit | `Member/LogWorkout.vue` (about 275 KB), `components/workout-session/ExerciseSessionCard.vue`, `composable/useWorkoutSessionDraft.js`, `workoutStatusManager.js`, `utils/workoutSession*.mjs`; `backend/api/workout-log.js` (14), `workout-sessions.js` (11) | `/workouts`, `/workout-log` (redirect) | Custom | Active | KEEP | Routed; nav "Exercise Log" |
| F8 | Nutrition and food logging | Food search (OpenFoodFacts proxy), logs, images | `Member/NutritionWorkspace.vue`, `components/nutrition-workspace/NutritionFoodCard.vue`, `NutritionLogList.vue`; `backend/api/nutrition.js`, `api/OpenFoodFactsAPI/main-api.js` (5) | `/Nutrition` | Custom | Active | KEEP | Routed; mounted |
| F9 | Progress statistics and goals | Charts, goals, streaks | `Member/ProgressStats.vue`, `components/Widgets/ProgressChart.vue`, `NutritionLogChart.vue`, `components/fitness/FitnessMetricCard.vue`; `backend/api/progress.js`, `goals.js`, `dashboard.js` | `/progress` | Custom | Active | KEEP | Routed; mounted |
| F10 | Member dashboard | Landing page, uses template `DateRangePicker` | `Member/HomeDashboard.vue` (route component `HomeView`) | `/dashboard`, alias `/hrm-dashboard` | Hybrid | Active | KEEP | Routed; imports `components/template/DateRangePicker.vue` |
| F11 | Profiles, settings, avatar, notifications, help | User settings, avatar upload, notifications | `Member/UserSettings.vue`, `Notifications.vue`, `Help.vue`, `components/AvatarModal.vue`, `ProfileDropdown.vue`, `ProfileRightSidebarComponent.vue`; `backend/src/routes/avatar.js`, `api/notifications.js`, `api/users.js` | `/settings`, `/notifications`, `/help` | Custom | Active | KEEP | Routed; mounted |
| F12 | Gateway, storage, AI gateway proxy | Gateway integration, S3-style local media root, AI proxy | `backend/api/ai-gateway.js`, `services/aiGatewayService.js`, `services/mediaResolver.js`, `services/userMediaService.js`, `backend/workoutatlas-s3-data/` | `/api/*` | Custom | Active | KEEP | `mediaResolver` `CONTENT_ROOT` points at `backend/workoutatlas-s3-data` |
| F13 | Admin tools and diagnostics | Admin tool page with gateway test image | `ToolsView.vue`; `backend/api/tools.js` (4) | `/tools` | Custom | Active | KEEP | Nav entry; caller `ToolsView.vue` |
| F14 | Responsive navigation | Bottom nav and "More" screen on mobile | `components/navigation/AppBottomNav.vue`, `MobileMoreScreen.vue`, `MobileSearchModal.vue`, `HeaderComponent.vue` | - | Custom | Active | KEEP | Imported by live layout |
| F15 | i18n (en, bn, ru) | Translation resources | `i18n/index.js`, `i18n/locales/*.json` | - | Template origin, extended | Active | KEEP | `main.js` imports `i18n/index.js`; `i18n/translation.js` is unreachable |

### 3.2 Template-origin features

| # | Feature | Files | Routes / nav | Origin | Status | Rec. | Evidence |
|---|---|---|---|---|---|---|---|
| T1 | Sidebar rendering (menu and dropdown components) | `components/template/menu/SidebarMenuComponent.vue`, `DropdownMenuComponent.vue`; used by `components/MainSidebarComponent.vue`; data from `components/sidebarMenu.js` | Live sidebar | Template (live) | Active | KEEP | `MainSidebarComponent.vue` imports `SidebarMenuComponent.vue` |
| T2 | Date range picker | `components/template/DateRangePicker.vue` | Dashboard, Progress | Template (live) | Active | KEEP | Imported by `Member/HomeDashboard.vue`, `ProgressStats.vue` |
| T3 | Error pages 400/403/404/408/500/503/504 | `views/template/pages/error/Error*.vue`; images `error-*.png` | `/error-*` | Template (live) | Active | KEEP | Router guard and `layouts/Guest.vue` reference `error_*` names |
| T4 | Chat demo | `views/template/apps/Chat.vue`, modals | `/chat`; sidebar "Chat with Trainer", "Chat"; dashboard and profile sidebar links | Template (demo, nav-linked) | Active as demo | REVIEW | Static demo; no backend chat API |
| T5 | Calendar demo (FullCalendar) | `views/template/apps/Calendar.vue`, event modals | `/calendar`; sidebar "Scheduling" | Template (demo, nav-linked) | Active as demo | REVIEW | Static demo; separate from the real Schedule Planner |
| T6 | Profile pages | `views/template/pages/user/ViewProfile.vue`, `EditProfile.vue` | `/view-profile`, `/edit-profile`; links in `ProfileDropdown.vue`, `ProfileRightSidebarComponent.vue` | Template (demo, link-referenced) | Active as demo | REVIEW | Real profile editing lives in `UserSettings.vue` |
| T7 | CRM Task page | `views/template/apps/crm/Task.vue`, task modals | `/task`; link in `ProfileRightSidebarComponent.vue` | Template (demo, link-referenced) | Active as demo | REVIEW | Static demo |
| T8 | CRM, HRM, e-commerce, email, invoices, contact, file manager, forms, tables, charts, icon, map, utility, pricing, coming-soon, auth demo, advanced UI demos | `views/template/**` (about 40 views), `components/template/**` | About 39 routes with no live reference | Template | Potentially unused (reachable only by typing the URL or the unused `sidebarMenu-TEMPLATE.js`) | REMOVAL CANDIDATE (after decisions) | Section 5 and Appendix C |
| T9 | Template theme switcher machinery | `composable/manageThemeSetting.js`, `navbarSizeSetting.js`, `navPositionSetting.js`, `disableEnablePreloaderSetting.js`, `mainContentBackgroundSetting.js`, `mainSidebarBackgroundSetting.js`, `primaryColorChangeSetting.js`, `themeDirectionSetting.js`, `outsideClicker.js`, `manageSidebarMenu.js` | n/a | Template (live) | Active | KEEP / REVIEW | Imported by `App.vue`, `MainSidebarComponent.vue`, `HeaderComponent.vue` |
| T10 | Template-only composables | `chartsDataManage.js`, `dashboardManage.js`, `nestableList.js`, `sweetalertManage.js` | n/a | Template | Importers found only under `template/` | REVIEW | One importer each, all in template folders |

---

## 4. Frontend view and component inventory

### 4.1 Custom views (25 non-template views)

| View | Size class | Reachable | Notes |
|---|---|---|---|
| `Guest/Login.vue` | 70 KB | Yes | Calls `/api/debug/login-diagnostics` |
| `Guest/register.vue` | 69 KB | Yes | |
| `Guest/ExternalRegister.vue`, `ForgotPassword.vue`, `UpdatePassword.vue`, `TermsPolicy.vue` | small | Yes | |
| `Member/HomeDashboard.vue` | 34 KB | Yes (`HomeView`) | Imports template `DateRangePicker` |
| `Member/LogWorkout.vue` | 275 KB | Yes | Largest custom view |
| `Member/WorkoutBuilder.vue` | 436 KB | Yes | Largest file in the app |
| `Member/WorkoutDetail.vue`, `FindPlans.vue` | medium | Yes | |
| `Member/exercises.vue` | 111 KB of style text (largest `!important` count) | Yes | |
| `Member/ProgressStats.vue` | 89 KB | Yes | Imports template `DateRangePicker` |
| `Member/NutritionWorkspace.vue` | 46 KB | Yes | |
| `Member/UserSettings.vue` | 101 KB | Yes | |
| `Member/AdminUsers.vue`, `AdminRoles.vue`, `AdminRoleTester.vue`, `ToolsView.vue` | medium | Yes | `AdminUsers.vue` calls `/api/bootstrap/promote-self-admin` |
| `Member/Notifications.vue`, `Help.vue`, `Logout.vue` | small | Yes | |
| **`views/HomeDashboard.vue`** | 4 KB | **No** (not imported, no route) | Legacy. REMOVAL CANDIDATE (RC-04) |
| **`views/LogWorkout.vue`** | 5 KB | **No** | Legacy; superseded by `Member/LogWorkout.vue`. RC-04 |
| **`views/Member/nutrition.vue`** | 49 KB | **No** | Legacy; superseded by `NutritionWorkspace.vue`; calls unmounted `POST /api/food-items`. RC-04 |

### 4.2 Custom components (50 non-template files)

| Group | Files | Reachable | Rec. |
|---|---|---|---|
| Shell: `HeaderComponent`, `MainSidebarComponent`, `FooterComponent`, `ProfileDropdown`, `ProfileRightSidebarComponent`, `MobileSearchModal`, `AvatarModal`, `DropDownDate`, `navigation/AppBottomNav`, `navigation/MobileMoreScreen`, `sidebarMenu.js` | 11 | Yes | KEEP |
| `workout-builder/*` (4), `workout-session/ExerciseSessionCard`, `nutrition-workspace/NutritionFoodCard`, `NutritionLogList`, `fitness/FitnessMetricCard` | 8 | Yes | KEEP |
| `Widgets/ProgressChart`, `Widgets/NutritionLogChart` | 2 | Yes (via `Member/HomeDashboard.vue`) | KEEP |
| `Widgets/AssignedWorkouts`, `AssignedWorkoutsMini`, `MyTasks`, `PendingGoals`, `PictureUpload`, `UpcomingActivitiesComponent`, `WorkoutStats` | 7 | **No** (imported only by unreachable `views/HomeDashboard.vue`) | REVIEW then RC-04 |
| `ui/*` (13 files) | 13 | **No** (`ui/Card` etc. import each other only) | REMOVAL CANDIDATE (RC-06) |
| `design-system/*` (5 files) | 5 | **No** | REMOVAL CANDIDATE (RC-06) |
| `exercises.vue`, `workout-log/WorkoutCard.vue`, `nutrition-workspace/NutritionMacroSummary.vue` | 3 | **No** | REVIEW (RC-04) |
| `sidebarMenu-TEMPLATE.js` | 1 | **No** | REMOVAL CANDIDATE (RC-03); it is the demo menu that lists all template routes |

`design-system/` (components) and `styles/design-system.css` / `assets/css/design-system.css` share a name; the two CSS files are distinct files (10.5 KB reachable, 5.5 KB unreachable) and their overlap was not measured.

### 4.3 Other frontend modules

| Module | Reachable | Notes |
|---|---|---|
| `composable/*` (19) | 18 reachable; `leftSidebarCollapse.js` unreachable | See T9 and T10 |
| `utils/*` (17) | 16 reachable; `browserDetect.js` unreachable | `*.test.mjs` run by `node --test`; not part of the app bundle |
| `stores/counter.js`, `stores/modal.js` | Unreachable | Pinia is initialised in `main.js`, but no store is imported. REVIEW (RC-07) |
| `router/Session.js`, `i18n/translation.js`, `shims-vue.d.ts` | Unreachable | REVIEW (RC-07) |
| `layouts.js` | Reachable | |
| `config/*` (4), `services/apiClient.js` | Reachable | KEEP |

---

## 5. Routing inventory

Source: `frontend/src/router/routing.js` (81 route entries), `router/index.js` (global guard).

### 5.1 Summary

| Category | Count | Notes |
|---|---|---|
| Custom authenticated (AppLayout) | 16 | `/dashboard`, `/Nutrition`, `/exercises`, `/workouts`, `/workout-builder`, `/find-plans`, `/workouts/:planId`, `/progress`, `/settings`, `/notifications`, `/help`, `/admin/users`, `/admin/roles`, `/tools`, `/admin/test-roles`, `/hrm-dashboard` (alias to `HomeView`) |
| Custom guest (GuestLayout) | 7 | `/login`, `/register`, `/terms-policy`, `/reset-password`, `/update-password`, `/ext-register`, `/logout` |
| Redirects | 2 | `/` to login, `/workout-log` to workouts |
| Template-component routes | 56 | Breakdown below |

### 5.2 Template-component routes (56)

| Group | Count | Live reference? | Rec. |
|---|---|---|---|
| Error pages `/error-400` ... `/error-504` | 7 | Yes (router guard, `layouts/Guest.vue`) | KEEP |
| Nav/profile-linked demos: `/chat`, `/calendar`, `/view-profile`, `/edit-profile`, `/task` | 5 | Yes (sidebar, dashboard, `ProfileDropdown`, `ProfileRightSidebarComponent`) | REVIEW |
| Name-token matches only: `/category`, `/email`, `/icon`, `/table`, `/pricing-table` | 5 | The reference found is a generic word match, not a link (suspected false positive) | REVIEW |
| No live reference outside `sidebarMenu-TEMPLATE.js` | 39 | No | REMOVAL CANDIDATE (RC-08) |

The full route list is in Appendix C.

### 5.3 Guard observations (static review, not a security test)

- Template routes carry no role metadata, so any authenticated user can reach them by URL. They have no backend API, so the exposure is the static demo content only. Treat this as a hygiene finding, not a confirmed vulnerability.
- `router/index.js` reads `VITE_DEBUG_NO_AUTH` (`=== "true"`). It is `false` in `frontend/.env.example`. The production value is not in the repository (UNKNOWN). This is a client-side convenience flag only; the backend enforces sessions.
- The alias `/hrm-dashboard` resolving to `HomeView` is a template leftover; intent unknown (question Q8).

---

## 6. CSS / SCSS and class inventory

### 6.1 Files and load mechanism

| File | Size | Loaded by | Status | Rec. |
|---|---|---|---|---|
| `styles/design-system.css` | 10 KB | `main.js` | Active | KEEP |
| `assets/css/style.css` | 428 KB, 3,474 blocks, 316 `!important` | `main.js` | Active (compiled Digiboard stylesheet) | REVIEW (large; mostly template classes, see 6.2) |
| `assets/css/mobile.css` | 11 KB, 69 `!important` | `main.js` | Active | KEEP |
| `assets/scss/default-dark.scss` | 9 KB, 85 `!important` | `main.js` | Active | KEEP |
| `styles/button-fill-overrides.css` | 10 KB | `main.js` line 82 (imported after the template CSS) | Active | KEEP |
| `assets/css/blue-color.css` | 11 KB | **Runtime `<link id="primaryColor">`** via `setStyleSheet(VITE_DEFAULT_COLOR \|\| 'blue-color')` in `App.vue` | Active | KEEP |
| 9 other `*-color.css` (deep_pink, eagle_green, gold, green, orange, pink, purple, tea_green, yellow_green) | ~11 KB each | Runtime only if `VITE_DEFAULT_COLOR` selects them | Uncertain | REVIEW (RC-09) |
| `assets/css/rtl-style.css` | 16 KB | Runtime `<link id="rtlStyle">` via `setRtl()`; `App.vue` forces `ltr` | Potentially unused | REVIEW (RC-09) |
| `assets/css/design-system.css` | 5 KB | Not imported | Potentially unused | REVIEW (RC-09) |
| `assets/css/email.css` | 6 KB | Not imported (15 of its 21 classes appear only in template files) | Potentially unused | REVIEW (RC-09) |
| `assets/scss/*` (22 files unreachable; `style.scss` import is commented out in `main.js`) | ~0.6 MB | Template build sources, not compiled by the app build except `default-dark.scss` | Potentially unused | REVIEW (RC-10); keep until the compiled `style.css` is replaced or documented |
| `assets/vendor/css/*` (16 unreachable files) | ~0.2 MB | Not imported (e.g. `sweetalert2` CSS is imported from `node_modules` instead) | Potentially unused | REVIEW (RC-10) |

### 6.2 Class usage heuristic (suspected, lexical)

Method: extract class selectors from each global stylesheet; tokenise every `.vue`/`.js`/`.html` file under `frontend/src` (excluding `<style>` blocks); count a class as "live-referenced" if its token appears in a non-template file, "template-only" if it appears only under `views/template` or `components/template`, and "unreferenced" otherwise. Generic words (e.g. `active`, `show`) can match by accident, and classes built by string concatenation are invisible, so these are estimates, not proofs.

| Stylesheet | Distinct classes | Live-referenced | Template-only | Unreferenced |
|---|---|---|---|---|
| `assets/css/style.css` | 850 | 182 | 310 | 358 |
| `assets/css/blue-color.css` | 141 | 54 | 35 | 52 |
| `assets/css/mobile.css` | 21 | 14 | 0 | 7 |
| `styles/design-system.css` | 78 | 39 | 3 | 36 |
| `styles/button-fill-overrides.css` | 36 | 28 | 2 | 6 |
| `assets/scss/default-dark.scss` | 55 | 35 | 1 | 19 |
| `assets/css/design-system.css` | 41 | 22 | 1 | 18 |
| `assets/css/email.css` | 21 | 5 | 15 | 1 |
| `assets/css/rtl-style.css` | 147 | 52 | 56 | 39 |

### 6.3 Component-scoped styles and `!important`

- 243 Vue files contain `<style>`; 236 are `scoped`. Total style text is about 736 KB. The largest are `WorkoutBuilder.vue` (130 KB), `exercises.vue` (111 KB), `LogWorkout.vue` (89 KB), `UserSettings.vue` (56 KB).
- `!important` counts: 1,397 in Vue styles (`exercises.vue` 365, `UserSettings.vue` 191, `register.vue` 148, `LogWorkout.vue` 84, `App.vue` 61), plus 580 across the nine global stylesheets listed above. High `!important` use shows a specificity fight between template CSS and custom CSS; it is a consolidation risk, not an immediately removable item.
- Body theme classes `light-theme`, `dark-theme`, `hover-menu`, `has-horizontal`, `has-two-column-menu` and `rtl` all appear in live (non-template) code, so the template's theme-class system is partly live.
- `style.css` references `../images/*` backgrounds for template pages (login, welcome, two-factor, coming-soon, chat, etc.); these image references keep those assets "referenced" even where the matching page is unused.

### 6.4 Observed defects (static)

- `assets/scss/main/_global.scss` and `sections/_main-content.scss` reference `../images/*` and `../vendor/images/sort_*.png` paths that do not resolve from the SCSS location. The files are unreachable, so there is no runtime effect.
- `components/template/MainSidebarComponent.vue` imports `@/composable/sidebarMenu`, which does not exist. The component is unreachable, so it does not break the build.

---

## 7. Dependency and asset inventory

### 7.1 Frontend dependencies (static import scan)

| Package | Importers | Template-only? | Status | Rec. |
|---|---|---|---|---|
| `vue`, `vue-router`, `pinia`, `vue-i18n`, `axios`, `bootstrap`, `@popperjs/core`, `aos`, `overlayscrollbars`, `vue-toast-notification`, `@vitejs/plugin-vue`, `vite`, `@intlify/unplugin-vue-i18n` | live | No | Active | KEEP |
| `vue3-apexcharts` (+ `apexcharts` peer) | live (`ProgressChart`, `ProgressStats`) and template | No | Active | KEEP |
| `vue-sweetalert2` | `main.js` | No | Active | KEEP |
| `sweetalert2` | `main.js`, `browserDialogs.js`, `WorkoutBuilder.vue` | No | **Used but undeclared** in `package.json` (resolved transitively; suspected) | REVIEW: declare explicitly (RC-11) |
| `flatpickr` | `views/LogWorkout.vue` (unreachable legacy) and template modals/pages | Effectively template-only | Undeclared; satisfied transitively by `vue-flatpickr-component` (suspected) | REVIEW |
| `vue-flatpickr-component` | one non-template importer (`views/LogWorkout.vue`, unreachable legacy), four template | Effectively template-only | Follows RC-04 and RC-08 | REVIEW |
| `vue-datepicker-next` | `main.js`, `components/DropDownDate.vue` (live), one template | No | Active | KEEP (revalidate) |
| `@fortawesome/fontawesome-free` | one non-template match (`Member/exercises.vue`) | No | Revalidate against the vendored Pro CSS imported by `main.js` | REVIEW |
| `@ckeditor/ckeditor5-build-classic`, `@ckeditor/ckeditor5-vue` | template only | Yes | Used only by template Form/AddProduct/Task/Email pages | KEEP until template removal, then REMOVAL CANDIDATE |
| `@fullcalendar/*` (core, daygrid, interaction, timegrid, vue3) | template only (`Calendar.vue`) | Yes | KEEP while Calendar demo stays |
| `dropzone`, `moment`, `swiper`, `vue-select`, `vue3-carousel`, `vue3-otp-input`, `vuedraggable` | template only | Yes | KEEP until template removal, then REMOVAL CANDIDATE |
| `@coreui/vue` | only unreachable `Member/nutrition.vue` | Legacy | REMOVAL CANDIDATE (RC-11) |
| `express-session` (in the **frontend** `package.json`) | none | - | Unused in frontend | REMOVAL CANDIDATE (RC-11) |
| `overlayscrollbars-vue`, `vue3-datepicker` | none | - | Unused | REMOVAL CANDIDATE (RC-11) |
| `sass` (dev) | `default-dark.scss` needs it | No | KEEP |
| `concurrently` (backend dev) | used by the `dev` script | No | KEEP |

### 7.2 Backend dependencies

| Package | Status | Rec. |
|---|---|---|
| `express`, `cors`, `dotenv`, `mysql2`, `express-session`, `connect-mysql2`, `multer`, `axios`, `bcryptjs`, `google-auth-library`, `nodemailer` | Imported | KEEP |
| `bcrypt`, `express-mysql-session`, `mssql`, `request` | No `require` found | REMOVAL CANDIDATE (RC-11) after a lockfile and deploy check |
| `dns` (flagged by the scan) | Node built-in; scan false positive | n/a |

### 7.3 Assets

Sizes are tracked repository file sizes.

| Set | Size | Referenced? | Rec. |
|---|---|---|---|
| `backend/workoutatlas-s3-data` (1,738 `APP/exercise-library`, 12 `USERS/14`, 1 `TEST`) | 94 MB | Yes: `mediaResolver.js`, `userMediaService.js`, scripts | KEEP |
| `frontend/src/assets/Excerises-OLD` (2,619 exercise folders + JSON) | 95 MB | No code reference found (only the folder name appears in legacy scripts as `Excerises`, a different folder) | REVIEW (RC-12) |
| `backend/free-exercise-db-main` (2,619 exercises, site, schema) | 96 MB | No code reference found; documented as third-party and "EXCLUDE" in `DOCUMENTATION-INVENTORY.md` | REVIEW (RC-12) |
| `backend/data/exercises.json` | 1 MB | Yes: fallback path in `excerises.js` | KEEP |
| `frontend/src/assets/images` + `logo` + `public/images` (119 image files) | 12.7 MB | See below | mixed |
| - not referenced by any filename in `src` or `index.html` | 25 files, 6.05 MB (includes `login-background2.jpg` 4.08 MB; `main-bg-*`/`nav-bg-*` duplicated in `public/images` and `src/assets/images`) | No | REMOVAL CANDIDATE (RC-13) |
| - referenced only from `template/` | 54 files, 1.84 MB | Template only | Follows the template decision (RC-08) |
| - referenced by live code or global CSS | 40 files | Yes | KEEP (global CSS references may point at template-only pages; revalidate with RC-10) |
| `frontend/src/assets/vendor/webfonts` | 9.4 MB | Font Awesome Pro webfonts | REVIEW (licensing, Q2) |
| `frontend/screenshots` | 0.8 MB, 20 files | Not referenced by code | REVIEW (RC-01) |
| `frontend/public/changelog.html`, `changelog.txt` | small | Served statically | REVIEW |

Total tracked size under `frontend/src/assets` is 117.8 MB, of which 95 MB is `Excerises-OLD` and 10.9 MB is `images`. This is repository size, not bundle size.

---

## 8. Backend functionality inventory

Static count of route declarations per mounted module (`server.js` mounts everything under `/api` except where noted):

| Module | Routes | Purpose | Status | Rec. |
|---|---|---|---|---|
| `api/auth.js` | 17 | Login, register, Google OAuth, password reset, session, avatar session compat, debug endpoints | Active | KEEP (debug endpoints REVIEW) |
| `api/users.js` | 37 | Plans, schedules, planner, global/featured plans, goals, favorites, covers | Active | KEEP |
| `api/excerises.js` | 13 | Exercise CRUD, favorites, scope, system-exercise admin | Active | KEEP |
| `api/workout-log.js` | 14 (mounted at `/api/workout-log`) | History | Active | KEEP |
| `api/workout-sessions.js` | 11 | Session lifecycle | Active | KEEP |
| `api/admin.js` | 13 (mounted at `/api/admin`) | Admin | Active | KEEP |
| `api/dashboard.js`, `progress.js`, `goals.js` | 3, 4, 7 | Metrics | Active | KEEP |
| `api/notifications.js` | 5 | Notifications | Active | KEEP |
| `api/nutrition.js` | 1 | Nutrition image upload | Active | KEEP |
| `api/OpenFoodFactsAPI/main-api.js` | 5 | OpenFoodFacts proxy | Active | KEEP |
| `api/media.js` | 4 | Media resolver, covers | Active | KEEP |
| `api/config.js` | 1 | Public config | Active | KEEP |
| `api/tools.js` | 4 | Diagnostics, gateway test image | Active | KEEP |
| `api/ai-gateway.js` | 1 | AI gateway proxy | Active | KEEP |
| `src/routes/avatar.js` | 2 (mounted at `/api/avatar`) | Avatar images | Active | KEEP |
| `server.js` direct | 1 | | Active | KEEP |
| **`api/OpenFoodFactsAPI/food-items.js`** | 1 (`POST /api/food-items`) | Legacy food item insert | **Not mounted**: no `require` anywhere | **REMOVAL CANDIDATE (RC-14)**; its only caller is unreachable `Member/nutrition.vue` |
| **`utils/StreakCalculator.js`** | - | Streak helper | No `require` found; `dashboard.js` mentions it only in a comment | REVIEW (RC-14) |

### 8.1 API cross-check (suspected, not proof)

A literal URL scan found 96 distinct frontend endpoint strings. 29 backend routes had no literal caller. Most are false positives from template-literal paths such as `/api/workout-sessions/${encodeURIComponent(id)}/pause`; the pause, resume, end, schedule exercise, cover and conversion routes in this group are almost certainly called dynamically. **No backend route is recommended for removal on this evidence alone.** The routes that deserve a human decision are:

| Route | Evidence | Rec. |
|---|---|---|
| `GET /api/debug/ping`, `GET /api/auth/session-test` | No frontend caller; `session-test` is listed in a `server.js` auth allowlist | REVIEW |
| `POST /api/debug/mobile-menu` | Called by `ProfileDropdown.vue` `sendMenuDebug()` via `sendBeacon` on menu events: live diagnostic telemetry | REVIEW |
| `GET /api/debug/login-diagnostics` | Called by `Login.vue` | REVIEW |
| `POST /api/bootstrap/promote-self-admin` | Called by `AdminUsers.vue` | KEEP until its security purpose is confirmed |
| `GET /api/tools/test-image`, `GET /api/tools/status` | Called by `ToolsView.vue` | KEEP |
| `PUT /api/workout-schedules/:id/groups` | No caller found; previously recorded as dormant in `CHANGELOG.md` 0.85.313.a9 | REVIEW |

---

## 9. Legacy template functionality assessment

### 9.1 What is template-origin

- `views/template/` (63 files: 18 apps, 10 components, 3 dashboards, 32 pages) and `components/template/` (124 files).
- `assets/css/style.css` and the `assets/scss/` sources, 10 color-theme CSS files, `rtl-style.css`, vendored CSS libraries.
- `components/sidebarMenu-TEMPLATE.js`, `components/template/MainSidebarComponent.vue`.
- Composables that drive the template theme customizer (T9, T10).
- Images: `slider-*`, `product-img-*`, `coming-soon*`, `error-*`, `card-declined`, file-type icons and payment logos.

### 9.2 Live coupling points that block a naive delete

| # | Coupling | Files | Effect if template folders were deleted |
|---|---|---|---|
| C1 | Live sidebar renders through template menu components | `components/MainSidebarComponent.vue` to `components/template/menu/SidebarMenuComponent.vue`, `DropdownMenuComponent.vue` | Sidebar breaks |
| C2 | Date range picker | `Member/HomeDashboard.vue`, `ProgressStats.vue` to `components/template/DateRangePicker.vue` | Dashboard and Progress break |
| C3 | Error pages | `router/index.js`, `layouts/Guest.vue` use `error_*` route names; routes point at `views/template/pages/error/*` | 4xx/5xx routing breaks |
| C4 | Nav entries to demos | `components/sidebarMenu.js` links `chat`, `calendar`; `Member/HomeDashboard.vue` and `ProfileRightSidebarComponent.vue` link `chat`, `calendar`, `view_profile`, `edit_profile`, `task`; `ProfileDropdown.vue` links `view_profile` | Dead links |
| C5 | Theme composables | `App.vue`, `HeaderComponent.vue`, `MainSidebarComponent.vue` import navbar/nav-position/preloader/background/color/direction composables | App initialisation breaks |
| C6 | Global CSS | `style.css` supplies shell classes (`panel`, sidebar, header, theme classes) used by live pages | Visual regressions |
| C7 | Runtime color sheet | `App.vue` `setStyleSheet` loads `assets/css/<color>.css` | Theme loss if the file is removed |
| C8 | Template images referenced by CSS | `auth-bg*`, `bg*`, `login*`, `chat-bg*` etc. | Broken backgrounds |
| C9 | Shared libraries | FullCalendar, CKEditor, Swiper, dropzone, moment, vue-select are used only inside template pages; they become removable only after those pages go | n/a |

### 9.3 Template inventory by state

| State | Items | Evidence |
|---|---|---|
| Live (KEEP) | C1, C2, C3 files, theme composables, `blue-color.css`, `style.css` shell classes | Import graph, runtime code |
| Live-as-demo (REVIEW, needs a product decision) | Chat, Calendar, View Profile, Edit Profile, Task, plus their modal and DashboardBreadcrumb dependencies | Nav/profile links |
| Route-reachable only by URL (REMOVAL CANDIDATE after decisions) | 39 template routes and about 100 supporting components | Route table scan |
| Unreachable (REMOVAL CANDIDATE) | 7 template views (`dashboard/HrmDashboard`, `eCommerceDashboard`, `authentication/Login`, `Login-2`, `Registration`, `ResetPassword`, `UpdatePassword`) and 17 template components (including the dead `MainSidebarComponent.vue`, `HeaderCalculator`, `SidebarLinkComponent`, ecommerce/hrm dashboard parts) | Import graph |

### 9.4 Licensing and provenance

- Template identified from the header of `style.css` / `style.scss`: "Digiboard - Admin & Dashboard HTML Template", Author Codebasket, ThemeForest. No license or purchase record is in the repository (Q1).
- `assets/vendor/css/all.min.css` header: "Font Awesome Pro 6.3.0". Pro webfonts (9.4 MB) are vendored. Whether a Pro license covers this project is not documented (Q2). Use of Pro-only styles (`fa-light`, `fa-thin`, `fa-duotone`, `fa-sharp`) in live code was not measured.
- `backend/free-exercise-db-main` is a third-party dataset; its license file was not located in the tracked files other than the README.

---

## 10. Protected functionality and dependencies

The following must not be removed or modified by any cleanup batch without a dedicated regression plan and separate approval:

- Authentication, login/logout, Google OAuth, registration, password reset, sessions, session store, `requireAdmin`, trusted-origin checks.
- User/Trainer/Admin roles and permissions; admin pages and tools.
- Exercises, favorites, custom exercises, exercise media and the media resolver.
- Workout plans, Schedule Planner, Global and Featured Plans, plan conversion, covers.
- Workout logging, timers, sessions, history, recovery.
- Nutrition and food logging; goals; progress; dashboard metrics.
- Profiles, settings, avatars, notifications.
- Gateway, storage and DB integrations; production API contract.
- **PlanID #5 ("Stephen K - Lean Muscle")** and existing personal workout history.

Inherited template dependencies that currently support protected features (do not remove, move or rename until replaced and verified):

1. `components/template/menu/SidebarMenuComponent.vue`, `DropdownMenuComponent.vue` (sidebar for every authenticated page).
2. `components/template/DateRangePicker.vue` (dashboard, progress statistics).
3. `views/template/pages/error/Error400-504.vue` and the `error-*.png` images (router and guest layout).
4. Theme/navbar/preloader/nav-position/background/color/direction composables imported by `App.vue`, `HeaderComponent.vue`, `MainSidebarComponent.vue`, plus `outsideClicker.js`, `manageSidebarMenu.js`.
5. `assets/css/style.css` global shell classes, `mobile.css`, `default-dark.scss`, `blue-color.css`, and `main.js` vendored imports (`all.min.css`, `bootstrap.min.css`, `dropzone.min.css`, `jquery.uploader.css`, `material-icon.css`).
6. The `<link id="primaryColor">` and `<link id="rtlStyle">` elements in `index.html` and the files they load.
7. Packages `bootstrap`, `@popperjs/core`, `aos`, `overlayscrollbars`, `vue-toast-notification`, `vue-sweetalert2` and `sweetalert2`, `vue-datepicker-next`, `vue3-apexcharts` (and `apexcharts`).

---

## 11. Proposed removal candidates

All items require explicit user approval and a baseline test/build run first. "Confidence" refers to the analysis, not to a safety guarantee.

| ID | Candidate | Size / count | Confidence | Prerequisites and risk | Rec. |
|---|---|---|---|---|---|
| RC-01 | Stray artifacts: 16 `frontend/tmp-0852*.png`, `tmp_backend_full_test_085285.txt`, `backend/__diag_individual_summary.txt`, `public/assets/Excerises/ADMIN_TEST_-_Do_the_Sushi_Roll_LOL/1792202143806.jpg`, optionally `frontend/screenshots` (20 files, 0.8 MB) | ~20 files | High (no code reference found) | Confirm none are cited as QA evidence in `CHANGELOG.md` or `docs/qa`. Do not touch the `public/assets/Excerises` upload directory itself (live write target of `ImageUpload.js`). Low risk. | REMOVAL CANDIDATE |
| RC-02 | `frontend/plugins/simple-admin-page.php` (WordPress plugin file inside the Vue app) | 1 file | Medium | Confirm ownership and purpose (Q9). | UNKNOWN |
| RC-03 | `components/sidebarMenu-TEMPLATE.js`, `components/template/MainSidebarComponent.vue` (dead, broken import) | 2 files | High (no importer) | None beyond tests/build. Low risk. | REMOVAL CANDIDATE |
| RC-04 | Unreachable legacy views and widgets: `views/HomeDashboard.vue`, `views/LogWorkout.vue`, `views/Member/nutrition.vue`, `components/exercises.vue`, `workout-log/WorkoutCard.vue`, `nutrition-workspace/NutritionMacroSummary.vue`, 7 unused `Widgets/*` | 13 files | High (static import graph); revalidate for dynamic `import()` or string-built imports | Verify with a repo-wide search for the component names and a build. Low to medium risk. | REMOVAL CANDIDATE |
| RC-05 | Unreachable modules: `router/Session.js`, `i18n/translation.js`, `stores/counter.js`, `stores/modal.js`, `utils/browserDetect.js`, `composable/leftSidebarCollapse.js`, `shims-vue.d.ts` | 7 files | Medium to high | `stores/*` and `shims-vue.d.ts` may be referenced by tooling; verify. | REVIEW |
| RC-06 | Unused `components/ui/*` (13) and `components/design-system/*` (5) | 18 files, small | High | Confirm they are not a planned design system (Q6). | REVIEW / REMOVAL CANDIDATE |
| RC-07 | Unused `Pinia` stores (see RC-05) | - | Medium | `createPinia()` in `main.js` remains. | REVIEW |
| RC-08 | Template demo routes and pages with no live reference (39 routes) and their exclusive components, images, composables and packages | ~100 components, ~40 views, ~54 images (1.84 MB) | High for "no live link"; Medium for "safe to delete" | Resolve C1 to C5 first; decide Chat/Calendar/Profile/Task (Q3, Q4); update `routing.js`; remove packages last (section 7). Medium-high risk, do in sub-batches. | REMOVAL CANDIDATE (after decisions) |
| RC-09 | Unused theme CSS: 9 non-default color sheets, `rtl-style.css`, `assets/css/design-system.css`, `email.css` | ~12 files, ~0.15 MB | Medium (runtime-loaded; production `VITE_DEFAULT_COLOR` unknown) | Confirm production env values and that no UI offers color/RTL switching. | REVIEW |
| RC-10 | Unused SCSS sources and vendored CSS (22 SCSS, 16 vendor CSS files) | ~0.8 MB | Medium | `style.css` is the compiled artifact of the SCSS; deleting sources removes the ability to rebuild the template theme. Archive or document before removal. | REVIEW |
| RC-11 | Unused npm dependencies: frontend `express-session`, `overlayscrollbars-vue`, `vue3-datepicker`, `@coreui/vue`; backend `bcrypt`, `express-mysql-session`, `mssql`, `request`; declare `sweetalert2` (and verify `flatpickr`) | 8 removals, 2 additions | High for "no import"; verify install/build | Lockfile and `npm ci` change; requires separate approval; package/lockfile change is outside this task. | REMOVAL CANDIDATE |
| RC-12 | `frontend/src/assets/Excerises-OLD` (95 MB) and `backend/free-exercise-db-main` (96 MB) | ~191 MB, ~5,300 files | Medium (no reference found; may be a source of record for migrations) | Confirm they are not the data source for a seed or migration script and that S3-data is the live copy (Q10). Large git-history impact is not changed by deletion. | REVIEW |
| RC-13 | 25 unreferenced images (6.05 MB), including `login-background2.jpg`, duplicate `main-bg/nav-bg` copies | 25 files | Medium-high | Filename-token search only; confirm no runtime-built path. | REMOVAL CANDIDATE |
| RC-14 | Unmounted backend module `api/OpenFoodFactsAPI/food-items.js`; `utils/StreakCalculator.js` | 2 files | High (no `require`) | Removing the frontend caller (RC-04) first. Low risk. | REMOVAL CANDIDATE |
| RC-15 | Debug/diagnostic endpoints and their frontend callers (`/api/debug/*`, `sendMenuDebug`) | 3+ routes | Not assessed for removal | Product and security decision (Q7); not a pure-deletion item. | REVIEW |

---

## 12. Risk assessment

| Risk | Where | Likelihood / impact | Mitigation |
|---|---|---|---|
| Breaking the live sidebar or dashboard by deleting `components/template/*` | C1, C2 | High if done naively; high impact | Move the live components out of `template/` first, then delete the rest |
| Breaking error handling | C3 | Medium; user-visible | Relocate the error pages to a non-template folder |
| Breaking theming | C5, C6, C7 | Medium; broad visual impact | Keep `style.css`, `blue-color.css` and composables until CSS is consolidated with screenshots |
| Dead links to Chat/Calendar/Profile/Task | C4 | Medium; user-visible | Decide whether to hide, redirect, or build the features |
| Static analysis false negatives (dynamic imports, runtime-built URLs, string-built class names) | Whole analysis | Medium | Treat all results as candidates; require build, test and browser smoke runs per batch |
| Licensing exposure (Font Awesome Pro, ThemeForest) | Vendored assets | Unknown | Q1, Q2; locate purchase evidence before redistribution |
| Specificity fights from `!important` (1,977 occurrences across global and scoped CSS) | CSS | Medium during consolidation | Consolidate last, screenshot-compare |
| Large-file removals (191 MB) | RC-12 | Low runtime, high process | Confirm provenance; do in a separate approved batch |
| Backend debug endpoints exposed in production | RC-15 | Unknown | Q7 |
| Data/identity risk to PlanID #5 | Not touched | None for this task | Keep all cleanup away from plan/schedule persistence code |
| Test coverage is source-contract and unit based; there is no browser or component-mount coverage | Test suite | Medium | Add browser smoke checks to each batch's acceptance criteria |

No change in this task alters runtime behavior; the risks above apply to later cleanup batches.

---

## 13. Recommended cleanup sequence

Each batch is incremental, independently testable and requires separate user approval. Every batch starts on `0.85.cleanup` from a clean tree and ends with a full pre-commit review. No batch should be combined with another.

| Batch | Scope | Test / acceptance | Items |
|---|---|---|---|
| 0 | Baseline | Backend `node --test` (with throwaway env), frontend `node --test`, Vite build, browser smoke of login, dashboard, workouts, builder, nutrition, progress, settings, admin; record sizes | none removed |
| 1 | Stray artifacts and unreachable orphan files | Build; no route or import changes | RC-01, RC-03, RC-14, RC-13 (unreferenced images) |
| 2 | Unreachable legacy views, widgets, `ui/`, `design-system/`, dead modules | Build; confirm no `import()` of removed names | RC-04, RC-05, RC-06 |
| 3 | Dependency hygiene | `npm ci`, build, tests; no runtime import changes | RC-11 (declare `sweetalert2`, then remove unused) |
| 4 | Decouple live code from `template/` | Move `SidebarMenuComponent`, `DropdownMenuComponent`, `DateRangePicker` and error pages to custom folders; update imports only; no deletion yet | C1 to C3 |
| 5 | Resolve nav-linked demos | Product decision; replace links or hide entries for Chat, Calendar, View/Edit Profile, Task | C4 |
| 6 | Remove template demo routes and pages in sub-batches (auth demos, CRM, HRM, e-commerce, forms/tables/charts, apps) | Build after each sub-batch; route table diff; smoke test | RC-08 |
| 7 | Remove template-only composables, images and npm packages (CKEditor, FullCalendar, swiper, dropzone, moment, vue-select, vue3-carousel, vue3-otp-input, vuedraggable, flatpickr stack) | `npm ci`, build, smoke | section 7, T10 |
| 8 | Theme CSS clean-up | Confirm `VITE_DEFAULT_COLOR` and RTL needs; remove unused color/RTL/design-system/email CSS; screenshot comparison | RC-09 |
| 9 | CSS/SCSS consolidation | Per-view screenshot comparison; reduce `!important` where safe | RC-10 and section 6 |
| 10 | Backend debug-endpoint and large-dataset review | Security review and provenance check | RC-12, RC-15 |

---

## 14. Outstanding questions and unknowns

| # | Question | Why it matters |
|---|---|---|
| Q1 | Where is the purchase/license record for "Digiboard" (ThemeForest, Codebasket)? Is redistribution of the vendored template CSS/JS permitted for this product? | Licensing |
| Q2 | Is there a Font Awesome Pro license for 6.3.0? Does live code use Pro-only styles (`fa-light`, `fa-thin`, `fa-duotone`, `fa-sharp`)? | Licensing; icon replacement scope |
| Q3 | Are "Chat with Trainer" and "Scheduling" planned features, or should the sidebar entries be removed? | C4, RC-08 |
| Q4 | Should template Profile (View/Edit), Task, Chat and Calendar pages be replaced, redirected, or hidden? | C4 |
| Q5 | What is the roadmap for Trainer features (the sidebar has a Trainer group)? | Keep/remove decisions for related demos |
| Q6 | Are `components/ui/*` and `components/design-system/*` a planned design-system effort? | RC-06 |
| Q7 | Are `/api/debug/*` and the `sendMenuDebug` beacon needed in production? Is `POST /api/bootstrap/promote-self-admin` a permanent mechanism? | Security and privacy |
| Q8 | What is the intent of the `/hrm-dashboard` alias to `HomeView`? | Route cleanup |
| Q9 | What is `frontend/plugins/simple-admin-page.php`? | RC-02 |
| Q10 | Are `Excerises-OLD` and `free-exercise-db-main` the source of record for any migration or seeding, or is `backend/workoutatlas-s3-data` the only live copy? | RC-12 |
| Q11 | What are the production values of `VITE_DEFAULT_COLOR`, `VITE_DEFAULT_DIRECTION`, `VITE_DEBUG_NO_AUTH`, `VITE_DEFAULT_THEME`-type variables? | RC-09, section 5.3 |
| Q12 | Is the import order in `main.js` (template CSS first, then `button-fill-overrides.css`) intentional and relied on for pill-style buttons? | CSS consolidation |
| Q13 | Are `frontend/public/changelog.html` and `changelog.txt` user-facing? | Retain/remove |
| Q14 | Do any documents cite the `tmp-0852*.png` screenshots as QA evidence? | RC-01 |
| Q15 | `CURRENT-STATE.md` and `SESSION-HANDOFF.md` still show HEAD `b7a44817`; the verified `BETA` HEAD is `6fdec962`. Should the BETA status block be refreshed in a separate approved change? | Documentation accuracy |

---

## Appendix A. Method and limitations

- Tools: PowerShell and Node scripts run from `%TEMP%` (outside the repository), reading tracked files only. No file inside the repository was written except documentation.
- Import graph: static ES-module imports and dynamic `import()` with literal paths, resolved from `main.js`. 387 code files (excluding `Excerises-OLD`), 261 reachable.
- Not visible to the analysis: string-built or template-literal imports and URLs, `new URL(...)` with variables (the color sheet case), runtime class concatenation, SCSS partial resolution (`@import "main/global"` resolves to `_global.scss`), server-side includes, environment-driven behavior, and anything outside `VueJSApps/WorkoutAtlas`.
- Route analysis: `routing.js` was parsed for path, name, layout and component; "references" were found by route-name and path tokens, so common words (`table`, `email`, `category`) can produce false positives.
- Class usage: lexical token comparison (section 6.2); estimates only.
- API analysis: literal and template-literal URL scan against backend route declarations; many dynamic callers will be missed.
- Verification performed: Git state checks (branch, HEAD, clean tree, 13 stashes preserved) and static read-only analysis. **No build, test suite, server start or browser check was run.**

## Appendix B. Unreachable-by-static-import frontend files (113, non-test)

- `assets/css`: 12 (`blue-color` is runtime-loaded and live; the other color sheets, `design-system`, `rtl-style` are conditionally runtime-loaded or unused).
- `assets/scss`: 22 (template build sources).
- `assets/vendor/css`: 16 (OverlayScrollbars, aos, datetimepicker, daterangepicker, FullCalendar x3, jquery-ui, DataTables, owl.carousel, select2, selectize, sharp-regular, sharp-solid, sweetalert2, swiper-bundle).
- `components/template`: 17 (`AutoNumberCounterComponent`, `HeaderCalculator`, `MainSidebarComponent`, `DatatableAction/HrmAttendanceTableAction`, `filemanager/FolderList`, `menu/SidebarLinkComponent`, 5 `ecommerce-dashboard/*`, 6 `hrm-dashboard/*`).
- `views/template`: 7 (`dashboard/HrmDashboard`, `dashboard/eCommerceDashboard`, `pages/authentication/Login`, `Login-2`, `Registration`, `ResetPassword`, `UpdatePassword`).
- `components/Widgets` 7, `components/ui` 13, `components/design-system` 5.
- Other 14: `components/exercises.vue`, `workout-log/WorkoutCard.vue`, `nutrition-workspace/NutritionMacroSummary.vue`, `sidebarMenu-TEMPLATE.js`, `composable/leftSidebarCollapse.js`, `i18n/translation.js`, `router/Session.js`, `shims-vue.d.ts`, `stores/counter.js`, `stores/modal.js`, `utils/browserDetect.js`, `views/HomeDashboard.vue`, `views/LogWorkout.vue`, `views/Member/nutrition.vue`.

## Appendix C. Template-component routes (56)

- Authentication/guest demos (12): `/registration-2`, `/login-status`, `/account-deactivated`, `/welcome`, `/email-verify`, `/two-factor`, `/multi-step-signup`, `/coming-soon`, `/coming-soon-2`, `/pricing-table`, `/pricing-table-2`, `/under-construction`.
- Blank-layout demos (5): `/card-declined`, `/promotion`, `/subscription-confirm`, `/welcome-mail`, `/reset-password-mail`.
- Error pages (7, live): `/error-400`, `/error-403`, `/error-404`, `/error-408`, `/error-500`, `/error-503`, `/error-504`.
- Dashboard (1): `/crm-dashboard`.
- CRM (6): `/audience`, `/company`, `/task` (live-linked), `/leads`, `/customer`.
- HRM (3): `/add-employee`, `/all-employee`, `/attendance`.
- E-commerce (5): `/all-customer`, `/add-product`, `/all-product`, `/category`, `/order`.
- Apps (5): `/calendar` (live-linked), `/chat` (live-linked), `/email`, `/invoices`, `/contact`.
- Profile (2, live-linked): `/view-profile`, `/edit-profile`.
- Components/advanced UI (10): `/sweet-alert`, `/nestable-list`, `/animation`, `/swiper-slider`, `/form`, `/table`, `/charts`, `/icon`, `/map`, `/file-manager`.
- Pages (1): `/utility`.

## Appendix D. Hygiene findings

- Tracked temporary or diagnostic files: see RC-01.
- `backend/__diag_individual_summary.txt` and `tmp_backend_full_test_085285.txt` look like captured test output.
- `public/assets/Excerises/ADMIN_TEST_-_Do_the_Sushi_Roll_LOL/1792202143806.jpg` is a test upload committed under the live upload directory.
- `frontend/plugins/simple-admin-page.php` is unrelated to a Vue/Node stack.
- `CURRENT-STATE.md` and `SESSION-HANDOFF.md` show a stale HEAD (`b7a44817`).

## Appendix E. Documentation updated by this task

`docs/engineering/APP-CLEANUP-INVENTORY.md` (this file), `CHANGELOG.md`, `WORKOUTATLAS_BATCH_RESULTS.md`, `docs/engineering/CURRENT-STATE.md`, `docs/engineering/SESSION-HANDOFF.md`, `docs/engineering/DEVLOG.md`, `docs/qa/QA-INDEX.md`, `docs/INDEX.md`, `docs/governance/DOCUMENTATION-INVENTORY.md`. No commit or push was made.

## Execution status - task 0.85.cleanup.1 (Controlled Legacy Template Feature Removal) - 2026-11-24

This section was added after the inventory above and does not rewrite it. Sections 9, 11 and 13 describe the pre-removal state.

**Status (superseded, see the rollback section at the end of this file):** implementation was complete on branch `0.85.cleanup` (base and HEAD `6fdec962`, nothing committed); the owner later recorded FAILED ACCEPTANCE - ROLLBACK REQUESTED and the source changes were rolled back.

### Owner decisions and scope

- The owner authorised removal of only these standalone Digiboard demo features: chat/direct messaging, standalone Calendar, CRM, HRM, e-commerce, template email app, template invoices and contacts, template file manager, template authentication demo pages, template pricing/subscription demo pages and template UI demo pages. Any further candidate or scope expansion needs separate owner approval.
- The owner decided to retain both profile pages (`/view-profile`, `/edit-profile`), `/settings`, the profile dropdown, the profile right sidebar and avatar management. Only the "Message" (`/chat`) and "Taskboard" (`/task`) links were removed from the profile right sidebar.
- `/hrm-dashboard` is retained: it is an alias of the live `HomeView` dashboard.

### Actual changes

- Routes removed from `frontend/src/router/routing.js` (44): `/calendar`, `/chat`, `/crm-dashboard`, `/audience`, `/company`, `/task`, `/leads`, `/customer`, `/add-employee`, `/all-employee`, `/attendance`, `/all-customer`, `/add-product`, `/all-product`, `/category`, `/order`, `/email`, `/invoices`, `/contact`, `/file-manager`, `/registration-2`, `/login-status`, `/account-deactivated`, `/welcome`, `/email-verify`, `/two-factor`, `/multi-step-signup`, `/pricing-table`, `/pricing-table-2`, `/card-declined`, `/promotion`, `/subscription-confirm`, `/welcome-mail`, `/reset-password-mail`, `/sweet-alert`, `/nestable-list`, `/animation`, `/swiper-slider`, `/form`, `/table`, `/charts`, `/icon`, `/map`, `/utility` (route table: 79 names / 81 paths before, 35 names / 37 paths after).
- Files modified (4): `frontend/src/router/routing.js`; `frontend/src/components/sidebarMenu.js` (Trainer section, Administrator Scheduling and Chat items removed); `frontend/src/views/Member/HomeDashboard.vue` (chat/calendar quick links and role actions, unused `isTrainer` removed); `frontend/src/components/ProfileRightSidebarComponent.vue` (Message and Taskboard links removed).
- Files deleted (161 = 51 template views + 110 exclusively owned template components), working tree only, nothing staged:

Views (51):

- `frontend/src/views/template/apps/Calendar.vue`
- `frontend/src/views/template/apps/Chat.vue`
- `frontend/src/views/template/apps/Contact.vue`
- `frontend/src/views/template/apps/Email.vue`
- `frontend/src/views/template/apps/Invoices.vue`
- `frontend/src/views/template/apps/crm/Audience.vue`
- `frontend/src/views/template/apps/crm/Company.vue`
- `frontend/src/views/template/apps/crm/Customer.vue`
- `frontend/src/views/template/apps/crm/Leads.vue`
- `frontend/src/views/template/apps/crm/Task.vue`
- `frontend/src/views/template/apps/ecommerce/AddProduct.vue`
- `frontend/src/views/template/apps/ecommerce/AllCustomer.vue`
- `frontend/src/views/template/apps/ecommerce/AllProduct.vue`
- `frontend/src/views/template/apps/ecommerce/Category.vue`
- `frontend/src/views/template/apps/ecommerce/Order.vue`
- `frontend/src/views/template/apps/hrm/AddEmployee.vue`
- `frontend/src/views/template/apps/hrm/AllEmployee.vue`
- `frontend/src/views/template/apps/hrm/Attendance.vue`
- `frontend/src/views/template/components/Charts.vue`
- `frontend/src/views/template/components/FileManager.vue`
- `frontend/src/views/template/components/Form.vue`
- `frontend/src/views/template/components/Icon.vue`
- `frontend/src/views/template/components/Map.vue`
- `frontend/src/views/template/components/Table.vue`
- `frontend/src/views/template/components/advanceUI/Animation.vue`
- `frontend/src/views/template/components/advanceUI/NestableList.vue`
- `frontend/src/views/template/components/advanceUI/SweetAlert.vue`
- `frontend/src/views/template/components/advanceUI/SwiperSlider.vue`
- `frontend/src/views/template/dashboard/CrmDashboard.vue`
- `frontend/src/views/template/dashboard/HrmDashboard.vue`
- `frontend/src/views/template/dashboard/eCommerceDashboard.vue`
- `frontend/src/views/template/pages/Utility.vue`
- `frontend/src/views/template/pages/additional/PricingTable.vue`
- `frontend/src/views/template/pages/additional/PricingTable2.vue`
- `frontend/src/views/template/pages/authentication/AccountDeactivated.vue`
- `frontend/src/views/template/pages/authentication/CardDeclined.vue`
- `frontend/src/views/template/pages/authentication/EmailVerify.vue`
- `frontend/src/views/template/pages/authentication/Login-2.vue`
- `frontend/src/views/template/pages/authentication/Login.vue`
- `frontend/src/views/template/pages/authentication/LoginStatus.vue`
- `frontend/src/views/template/pages/authentication/MultiStepSignup.vue`
- `frontend/src/views/template/pages/authentication/Promotion.vue`
- `frontend/src/views/template/pages/authentication/Registration-2.vue`
- `frontend/src/views/template/pages/authentication/Registration.vue`
- `frontend/src/views/template/pages/authentication/ResetPassword.vue`
- `frontend/src/views/template/pages/authentication/ResetPasswordMail.vue`
- `frontend/src/views/template/pages/authentication/SubscriptionConfirm.vue`
- `frontend/src/views/template/pages/authentication/TwoFactor.vue`
- `frontend/src/views/template/pages/authentication/UpdatePassword.vue`
- `frontend/src/views/template/pages/authentication/Welcome.vue`
- `frontend/src/views/template/pages/authentication/WelcomeMail.vue`

Components (110):

- `frontend/src/components/template/AutoNumberCounterComponent.vue`
- `frontend/src/components/template/CategoryInfoComponent.vue`
- `frontend/src/components/template/DatatableAction/AllEmployeeTableAction.vue`
- `frontend/src/components/template/DatatableAction/AttendanceTableAction.vue`
- `frontend/src/components/template/DatatableAction/CategoryTableAction.vue`
- `frontend/src/components/template/DatatableAction/CustomerTableAction.vue`
- `frontend/src/components/template/DatatableAction/HrmAttendanceTableAction.vue`
- `frontend/src/components/template/DatatableAction/LeadsTableAction.vue`
- `frontend/src/components/template/DatatableAction/OrderTableAction.vue`
- `frontend/src/components/template/DatatableAction/ProductTableAction.vue`
- `frontend/src/components/template/DatatableAction/TaskStatusTableAction.vue`
- `frontend/src/components/template/DatatableAction/TaskTableAction.vue`
- `frontend/src/components/template/DatatableAction/TaskTableAssignToAction.vue`
- `frontend/src/components/template/DatatableAction/TaskTablePriorityAction.vue`
- `frontend/src/components/template/ModalWrapper.vue`
- `frontend/src/components/template/attendance/AttendanceTableFilterOption.vue`
- `frontend/src/components/template/attendance/AttendanceTableHeaderComponent.vue`
- `frontend/src/components/template/audience/CompanyTableHeaderComponent.vue`
- `frontend/src/components/template/category/CategoryTableFilterOption.vue`
- `frontend/src/components/template/category/CategoryTableHeaderComponent.vue`
- `frontend/src/components/template/charts/AreaCharts.vue`
- `frontend/src/components/template/charts/BarCharts.vue`
- `frontend/src/components/template/charts/BoxplotCharts.vue`
- `frontend/src/components/template/charts/BubbleCharts.vue`
- `frontend/src/components/template/charts/CandlestickCharts.vue`
- `frontend/src/components/template/charts/ColumnCharts.vue`
- `frontend/src/components/template/charts/HeatmapCharts.vue`
- `frontend/src/components/template/charts/LineCharts.vue`
- `frontend/src/components/template/charts/MixedCharts.vue`
- `frontend/src/components/template/charts/PieCharts.vue`
- `frontend/src/components/template/charts/PolarAreaCharts.vue`
- `frontend/src/components/template/charts/RadarCharts.vue`
- `frontend/src/components/template/charts/RadialBarCharts.vue`
- `frontend/src/components/template/charts/ScatterCharts.vue`
- `frontend/src/components/template/charts/TimelineCharts.vue`
- `frontend/src/components/template/charts/TreemapCharts.vue`
- `frontend/src/components/template/company/CompanyTableHeaderComponent.vue`
- `frontend/src/components/template/crm-dashboard/BalanceOverviewChartComponent.vue`
- `frontend/src/components/template/crm-dashboard/CrmNoticeBoardComponent.vue`
- `frontend/src/components/template/crm-dashboard/CrmStatsComponent.vue`
- `frontend/src/components/template/crm-dashboard/InvoicesComponent.vue`
- `frontend/src/components/template/crm-dashboard/MyTasksComponent.vue`
- `frontend/src/components/template/crm-dashboard/PendingWorksComponent.vue`
- `frontend/src/components/template/crm-dashboard/RecentProjectsComponent.vue`
- `frontend/src/components/template/crm-dashboard/UpcomingActivitiesComponent.vue`
- `frontend/src/components/template/crm-dashboard/WorksDeadlinesComponent.vue`
- `frontend/src/components/template/customer/AllCustomerTableHeaderComponent.vue`
- `frontend/src/components/template/customer/CustomerTableFilterOption.vue`
- `frontend/src/components/template/customer/CustomerTableHeaderComponent.vue`
- `frontend/src/components/template/dragable/FolderComponent.vue`
- `frontend/src/components/template/dragable/NestedFolderComponent.vue`
- `frontend/src/components/template/dragable/NestedTeamComponent.vue`
- `frontend/src/components/template/dragable/TeamComponent.vue`
- `frontend/src/components/template/ecommerce-dashboard/EcommarceStatsComponent.vue`
- `frontend/src/components/template/ecommerce-dashboard/NewCustomersComponent.vue`
- `frontend/src/components/template/ecommerce-dashboard/RecentOrdersComponent.vue`
- `frontend/src/components/template/ecommerce-dashboard/SalesAnalyticsChartComponent.vue`
- `frontend/src/components/template/ecommerce-dashboard/SocialMediaVisitorComponent.vue`
- `frontend/src/components/template/email/EmailTableAction.vue`
- `frontend/src/components/template/email/EmailTableComponent.vue`
- `frontend/src/components/template/email/EmailTableFilterComponent.vue`
- `frontend/src/components/template/email/EmailTableHeaderComponent.vue`
- `frontend/src/components/template/email/MailDetailsComponent.vue`
- `frontend/src/components/template/employee/AllEmployeeTableHeaderComponent.vue`
- `frontend/src/components/template/employee/TableFilterOption.vue`
- `frontend/src/components/template/filemanager/FileList.vue`
- `frontend/src/components/template/filemanager/Settings.vue`
- `frontend/src/components/template/filemanager/Sidebar.vue`
- `frontend/src/components/template/hrm-dashboard/AttendanceTableComponent.vue`
- `frontend/src/components/template/hrm-dashboard/AudienceOverviewChartComponent.vue`
- `frontend/src/components/template/hrm-dashboard/HrmStatsComponent.vue`
- `frontend/src/components/template/hrm-dashboard/NoticeBoardComponent.vue`
- `frontend/src/components/template/hrm-dashboard/RecentActivityComponent.vue`
- `frontend/src/components/template/hrm-dashboard/UpcomingInterviewsComponent.vue`
- `frontend/src/components/template/leads/LeadsTableHeaderComponent.vue`
- `frontend/src/components/template/modals/AddNewLabelModalComponent.vue`
- `frontend/src/components/template/modals/AddTaskModal.vue`
- `frontend/src/components/template/modals/ComposeNewMailComponent.vue`
- `frontend/src/components/template/modals/CreateFolderModalComponent.vue`
- `frontend/src/components/template/modals/EditTaskModal.vue`
- `frontend/src/components/template/modals/EventDeleteModal.vue`
- `frontend/src/components/template/modals/EventModalComponent.vue`
- `frontend/src/components/template/modals/FileDetailsModalComponent.vue`
- `frontend/src/components/template/modals/InboxModal.vue`
- `frontend/src/components/template/modals/NewMessage.vue`
- `frontend/src/components/template/modals/UploadFileModalComponent.vue`
- `frontend/src/components/template/modals/VideoCallModal.vue`
- `frontend/src/components/template/modals/ViewTaskModal.vue`
- `frontend/src/components/template/modals/VoiceCallModal.vue`
- `frontend/src/components/template/order/OrderTableFilterOption.vue`
- `frontend/src/components/template/order/OrderTableHeaderComponent.vue`
- `frontend/src/components/template/product/ProductInfoComponent.vue`
- `frontend/src/components/template/product/ProductRatingComponent.vue`
- `frontend/src/components/template/product/ProductTableFilterOption.vue`
- `frontend/src/components/template/product/ProductTableHeaderComponent.vue`
- `frontend/src/components/template/slider/MousewheelSwiper.vue`
- `frontend/src/components/template/slider/VerticalSwiper.vue`
- `frontend/src/components/template/tables/BorderColorTableComponent.vue`
- `frontend/src/components/template/tables/BorderedTableComponent.vue`
- `frontend/src/components/template/tables/ColorsTableComponent.vue`
- `frontend/src/components/template/tables/CustomizedDataTableComponent.vue`
- `frontend/src/components/template/tables/DataTableBodyScrollComponent.vue`
- `frontend/src/components/template/tables/DefaultDataTableComponent.vue`
- `frontend/src/components/template/tables/DefaultTableComponent.vue`
- `frontend/src/components/template/tables/HoverableTableComponent.vue`
- `frontend/src/components/template/tables/StripedColumnsTableComponent.vue`
- `frontend/src/components/template/tables/StripedRowsTableComponent.vue`
- `frontend/src/components/template/tables/WithoutBordersTableComponent.vue`
- `frontend/src/components/template/task/TaskTableFilterOption.vue`
- `frontend/src/components/template/task/TaskTableHeaderComponent.vue`

### Preserved (shared or not authorised)

- Protected template dependencies: `components/template/menu/{SidebarMenuComponent,DropdownMenuComponent,SidebarLinkComponent}.vue`, `DateRangePicker.vue`, `DashboardBreadcrumb.vue`, `MainSidebarComponent.vue`, error pages 400-504 and assets, theme and navigation composables, global CSS/SCSS (including runtime-loaded `blue-color.css`), profile pages and their dependencies.
- Generic shared components kept although now unreferenced: `components/template/datatable/DigiDataTable.vue`, `datatable/TableFilterOption.vue`, `ModalWindow.vue`, `PagePanelHeader.vue`, `TextEditorComponent.vue`, `form/DropzoneComponent.vue`, `HeaderCalculator.vue`, `filemanager/FolderList.vue` (the last two were already unreferenced before this task).
- Template composables kept: `composable/chartsDataManage.js`, `dashboardManage.js`, `nestableList.js`, `sweetalertManage.js`.
- `layouts/Blank.vue` / `BlankLayout` registration kept; no route uses it now.

### Deferred candidates (need separate owner approval)

- `/coming-soon`, `/coming-soon-2`, `/under-construction` and their views (not in the authorised list).
- The unreferenced shared components and composables listed above.
- `components/sidebarMenu-TEMPLATE.js` (unreachable, still lists removed route names; RC-03 not approved).
- `SidebarMenuComponent.vue` (protected): a harmless hard-coded `currentRoute === 'hrm_add_employee'` string comparison remains.
- All other candidates in section 11 (datasets, assets, CSS, dependencies, debug endpoints, backend, licensing).

### Verification (actual results)

- Static check (import graph and route table) after each of five groups: no new unresolved imports or unknown routes. Remaining findings all pre-date this task and were not repaired: `MainSidebarComponent.vue` imports a missing `@/composable/sidebarMenu` (unreachable file); `HomeDashboard.vue` links `/user-settings` and `/admin/role-tester`, which are not registered routes.
- Frontend `node --test`: 140/140 passed (baseline 140/140).
- Vite production build to a temporary directory outside the repository: succeeded (154 files, 19,422,800 bytes; baseline 255 files, 23,126,576 bytes).
- Backend `node --test` (throwaway in-process env, no database): 238/238 passed (baseline 238/238).
- `backend/api/users.js`: 37 route declarations, identical to baseline apart from leading whitespace in the saved comparison; the file has no Git changes.
- Git: no backend, package manifest, lockfile, CSS, SCSS or SQL changes; 165 files changed vs HEAD (161 deleted, 4 modified), nothing staged; 13 stashes intact.
- Search of `components`, `views`, `layouts`, `composable`, `router` and stores for removed route paths: no matches outside `sidebarMenu-TEMPLATE.js`.

### Pending

- Manual browser acceptance (not run): sign-in; dashboard; every desktop and mobile navigation entry; `/view-profile`, `/edit-profile`, `/settings`, profile dropdown and right sidebar; `/hrm-dashboard`; Workout Builder; Schedule Planner; logging; nutrition; notifications; admin tools; error pages; deep links to removed routes resolve to the app's unknown-route handling.
- User acceptance PENDING. BETA integration NOT AUTHORIZED. No commit, push or merge was made.

## Rollback - task 0.85.cleanup.1: FAILED ACCEPTANCE - ROLLBACK REQUESTED - 2026-11-24

- Owner report: the application no longer started after the cleanup; user acceptance FAILED; rollback authorised. Cleanup is not authorised to continue.
- Restored from `6fdec96255110ce1588051bbf93afde2073a38b6` into the working tree only (`git restore --source=... --worktree`, 165 explicit paths): all 161 deleted files (51 template views and 110 template components, as listed above) and the 4 modified files `frontend/src/router/routing.js`, `frontend/src/components/sidebarMenu.js`, `frontend/src/views/Member/HomeDashboard.vue`, `frontend/src/components/ProfileRightSidebarComponent.vue`. `git diff 6fdec962 -- frontend backend` is now empty. Nothing staged; no `reset --hard`, `clean`, commit, push or merge; 13 stashes untouched; BETA untouched.
- Documentation preserved: this inventory (sections 1-14 and appendices) and the execution-status section above are retained as history; the other logs were only appended to.
- Environment configuration: `backend/.env` exists (git-ignored, last written 2026-04-23, before this task) and was not created, moved, modified or deleted by this task (no command touched any `.env`). `frontend/.env` does not exist and no `.env` backup was found in the workspace; only `.env.example` files are tracked. No `DB_*`, `NODE_ENV` or `SESSION_*` variables are set at User or Machine level or in VS Code `terminal.integrated.env.windows`. No environment variable was changed or unset by the rollback. No credentials were invented, copied or printed.
- Startup verification: `npm run dev` from `backend/` starts both processes after the rollback. The frontend (Vite, port 5173) serves the app (HTTP 200 with a browser Accept header, `routing.js` served). The backend listens on port 5000 and `GET /api/debug/ping` returns 200, but every database connection is rejected by the configured MySQL server (`ER_ACCESS_DENIED_ERROR` 1045 for the configured user from the current client address), so the session store and DB-backed routes (for example `/api/config/google`) fail with 503. This failure is in the database connection settings, not in application source (source is identical to the base commit). Possible causes (not verified): the MySQL host's remote-access allowlist no longer includes the current public address, or the stored password for the configured user is out of date. Resolution needs the owner (not guessed or worked around; session storage was not disabled).
- Remaining blockers: backend cannot reach its database with the existing `backend/.env`; full browser acceptance impossible until fixed. Dev servers were stopped after verification.
- Status of `0.85.cleanup.1`: FAILED ACCEPTANCE - ROLLBACK REQUESTED. Source rolled back; inventory and logs retained. No further cleanup is authorised. BETA integration NOT AUTHORIZED.

## Execution status - task 0.85.cleanup.1.a1 (Batch 1: CRM, HRM and e-commerce template removal) - 2026-11-25

Added after the rollback section; earlier sections are history and are not rewritten. `0.85.cleanup.1.a1` is a task label, not a package version (packages remain `0.85.308`).

**Status: BATCH 1 IMPLEMENTED - PENDING OWNER ACCEPTANCE.** Working tree of branch `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`), nothing staged, committed, pushed or merged. Batches 2-5 of the Phase 1 report are NOT started. BETA integration NOT AUTHORIZED.

### Restrictions observed

- `.env*` files (backend and frontend) were not read, modified, moved, copied, renamed or deleted; no environment variable was assigned or removed; no Windows environment setting changed.
- Individual deletions only (no recursive, wildcard or `git clean` deletes; no reset, stash or checkout operations); 13 stashes and BETA unchanged.
- Static verification only: no `npm` script, `node --test`, build, install, DB access or app start.

### Routes removed from `frontend/src/router/routing.js` (14)

`/crm-dashboard`, `/audience`, `/company`, `/task`, `/leads`, `/customer`, `/add-employee`, `/all-employee`, `/attendance`, `/all-customer`, `/add-product`, `/all-product`, `/category`, `/order`. Route paths 81 -> 67. `/hrm-dashboard` (component `HomeView`, name `hrm_dashboard`) is retained. `/calendar`, `/chat`, `/email`, `/invoices`, `/contact`, `/file-manager`, `/view-profile`, `/edit-profile`, `/settings` and the Batch 3 and 4 demo routes remain.

### Other source modification (1)

`frontend/src/components/ProfileRightSidebarComponent.vue`: only the Taskboard (`/task`) list item removed. Message (`/chat`), Help, Profile, Settings and Logout are unchanged.

### Files deleted (67 = 16 views + 51 components; all previously Git-tracked)

Views (16):

- `frontend/src/views/template/apps/crm/Audience.vue`
- `frontend/src/views/template/apps/crm/Company.vue`
- `frontend/src/views/template/apps/crm/Customer.vue`
- `frontend/src/views/template/apps/crm/Leads.vue`
- `frontend/src/views/template/apps/crm/Task.vue`
- `frontend/src/views/template/apps/ecommerce/AddProduct.vue`
- `frontend/src/views/template/apps/ecommerce/AllCustomer.vue`
- `frontend/src/views/template/apps/ecommerce/AllProduct.vue`
- `frontend/src/views/template/apps/ecommerce/Category.vue`
- `frontend/src/views/template/apps/ecommerce/Order.vue`
- `frontend/src/views/template/apps/hrm/AddEmployee.vue`
- `frontend/src/views/template/apps/hrm/AllEmployee.vue`
- `frontend/src/views/template/apps/hrm/Attendance.vue`
- `frontend/src/views/template/dashboard/CrmDashboard.vue`
- `frontend/src/views/template/dashboard/HrmDashboard.vue` (was unrouted)
- `frontend/src/views/template/dashboard/eCommerceDashboard.vue` (was unrouted)

Components (51), all under `frontend/src/components/template/`:

- `AutoNumberCounterComponent.vue`
- `CategoryInfoComponent.vue`
- `DatatableAction/AllEmployeeTableAction.vue`
- `DatatableAction/AttendanceTableAction.vue`
- `DatatableAction/CategoryTableAction.vue`
- `DatatableAction/CustomerTableAction.vue`
- `DatatableAction/HrmAttendanceTableAction.vue`
- `DatatableAction/LeadsTableAction.vue`
- `DatatableAction/OrderTableAction.vue`
- `DatatableAction/TaskStatusTableAction.vue`
- `DatatableAction/TaskTableAction.vue`
- `DatatableAction/TaskTableAssignToAction.vue`
- `DatatableAction/TaskTablePriorityAction.vue`
- `attendance/AttendanceTableFilterOption.vue`
- `attendance/AttendanceTableHeaderComponent.vue`
- `audience/CompanyTableHeaderComponent.vue`
- `category/CategoryTableFilterOption.vue`
- `category/CategoryTableHeaderComponent.vue`
- `company/CompanyTableHeaderComponent.vue`
- `crm-dashboard/BalanceOverviewChartComponent.vue`
- `crm-dashboard/CrmNoticeBoardComponent.vue`
- `crm-dashboard/CrmStatsComponent.vue`
- `crm-dashboard/InvoicesComponent.vue`
- `crm-dashboard/MyTasksComponent.vue`
- `crm-dashboard/PendingWorksComponent.vue`
- `crm-dashboard/RecentProjectsComponent.vue`
- `crm-dashboard/UpcomingActivitiesComponent.vue`
- `crm-dashboard/WorksDeadlinesComponent.vue`
- `customer/AllCustomerTableHeaderComponent.vue`
- `customer/CustomerTableFilterOption.vue`
- `customer/CustomerTableHeaderComponent.vue`
- `ecommerce-dashboard/EcommarceStatsComponent.vue`
- `ecommerce-dashboard/NewCustomersComponent.vue`
- `ecommerce-dashboard/RecentOrdersComponent.vue`
- `ecommerce-dashboard/SalesAnalyticsChartComponent.vue`
- `ecommerce-dashboard/SocialMediaVisitorComponent.vue`
- `employee/AllEmployeeTableHeaderComponent.vue`
- `hrm-dashboard/AttendanceTableComponent.vue`
- `hrm-dashboard/AudienceOverviewChartComponent.vue`
- `hrm-dashboard/HrmStatsComponent.vue`
- `hrm-dashboard/NoticeBoardComponent.vue`
- `hrm-dashboard/RecentActivityComponent.vue`
- `hrm-dashboard/UpcomingInterviewsComponent.vue`
- `leads/LeadsTableHeaderComponent.vue`
- `modals/AddTaskModal.vue`
- `modals/EditTaskModal.vue`
- `modals/ViewTaskModal.vue`
- `order/OrderTableFilterOption.vue`
- `order/OrderTableHeaderComponent.vue`
- `task/TaskTableFilterOption.vue`
- `task/TaskTableHeaderComponent.vue`

### Static verification results (actual)

- Deleted set equals the approved allowlist (67 of 67, nothing extra); all were tracked and present before deletion.
- Before deletion: zero retained dependencies on any of the 67 files across 1,196 scanned src files.
- Modified non-documentation files: exactly 2 (`routing.js`, `ProfileRightSidebarComponent.vue`). Frontend diff: 69 files, 6,186 lines deleted.
- Zero changes to backend, CSS/SCSS, package manifests, lockfiles, `public`, assets or environment files.
- All 14 removed route paths absent; 30 protected or later-batch routes confirmed present, including `/hrm-dashboard`, `/dashboard`, `/view-profile`, `/edit-profile`, `/settings`, `/calendar`, `/chat`.
- Only unresolved import in `src`: pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu` (unreachable file, not part of this batch).
- Four deleted files had local edits versus the original template (`AllCustomerTableHeaderComponent`, `BalanceOverviewChartComponent`, `SalesAnalyticsChartComponent`, `AudienceOverviewChartComponent`); they were in the approved allowlist.

### Skipped candidates and blockers

- Skipped candidates: none. Blockers: none.
- Remaining references to Batch 1 route names, outside retained functionality: `components/sidebarMenu-TEMPLATE.js` (unreachable; 12 entries), `components/template/menu/SidebarMenuComponent.vue` line 35 (literal active-state comparison; protected file, not modified), `components/template/product/ProductTableHeaderComponent.vue` line 68 (`/add-product` link in a Batch 4 demo component; dead link until Batch 4).
- Chat and calendar links in `HomeDashboard.vue`, `sidebarMenu.js` and the sidebar Message link remain until Batch 2. Shared components used by later batches (for example `ModalWindow`, `DigiDataTable`, `TableFilterOption`, `PagePanelHeader`, `TextEditorComponent`, `DropzoneComponent`, `ProductTableAction`) were deliberately not deleted.

### Pending

- Owner manual acceptance (not run): sign-in; dashboard and date range; `/hrm-dashboard`; profile dropdown, right sidebar and its links; `/view-profile`, `/edit-profile`, `/settings`; desktop and mobile navigation; Workout Builder; Schedule Planner; logging; nutrition; admin tools; error pages; `/chat` and `/calendar` still present (Batch 2). Note the DB credential issue recorded in the rollback section may still affect testing.
- User acceptance PENDING. Batches 2-5 not authorised or started. BETA integration NOT AUTHORIZED. No commit, push or merge was made.

## Investigation - task 0.85.cleanup.1.a2 (Batch 1 navigation regression, read-only) - 2026-11-25

Task label only. Trigger: manual testing of `0.85.cleanup.1.a1` reported numerous broken menu links, so Batch 1 acceptance was not given at that point. No source or documentation file was changed by the investigation.

- Method: static comparison of baseline `6fdec962` with the working tree; route-table parse; import and path-string scans; trace of every desktop sidebar, mobile bottom-nav, More-screen, profile dropdown, right-sidebar, header and dashboard link for member, trainer and administrator. No tests, build, app start or `.env` access.
- Result: every live link resolved to a registered route name or path and an existing component; no retained file depended on a deleted file; the owner-reported symptom could not be reproduced statically.
- Defects attributable to Batch 1: `/add-product` link in the Batch 4 demo `ProductTableHeaderComponent.vue` (dead end, reachable only by URL); unreachable leftovers (`sidebarMenu-TEMPLATE.js`, a literal in `SidebarMenuComponent.vue`).
- Pre-existing, not Batch 1: Help `href="#"` in the right sidebar; hardcoded identity text in the right sidebar; unrendered `/user-settings` and `/admin/role-tester` strings in `HomeDashboard.vue`; `/login-2` in `Registration-2.vue`; missing `@/composable/sidebarMenu` import in the unreachable `template/MainSidebarComponent.vue`; no catch-all route.
- Unverified hypotheses for the symptom: the router guard redirecting protected navigation to login while `GET /api/session` fails (the recorded DB credential blocker); a stale Vite dev server after the mass deletion; runtime errors inside destination pages.
- Outcome: owner authorised Batch 2 and no unrelated repair was made. A formal Batch 1 acceptance statement was not supplied and is not inferred.

## Execution status - task 0.85.cleanup.2 (Batch 2: chat, calendar, email, invoices, contacts and file manager template removal) - 2026-11-25

Added after the a2 investigation section; earlier sections are history and are not rewritten. `0.85.cleanup.2` is a task label, not a package version (packages remain `0.85.308`).

**Status: BATCH 2 IMPLEMENTED - PENDING OWNER ACCEPTANCE.** Working tree of branch `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`), nothing staged, committed, pushed or merged. Batch 3 is NOT started. BETA integration NOT AUTHORIZED.

### Restrictions observed

- `.env*` files (backend and frontend) were not read, modified, moved, copied, renamed or deleted; no environment variable was assigned or removed; no Windows environment setting changed.
- Each file was deleted individually by exact path (no recursive or wildcard deletes; no reset, clean, stash or checkout); 13 stashes and BETA unchanged.
- Static verification only: no `npm` script, `node --test`, build, install, DB access or app start. `node --check` was run only on Temp copies of two edited JavaScript files.

### Routes removed from `frontend/src/router/routing.js` (6)

| Path | Route name | Component |
|---|---|---|
| `/chat` | `chat` | `views/template/apps/Chat.vue` |
| `/calendar` | `calendar` | `views/template/apps/Calendar.vue` |
| `/email` | `email` | `views/template/apps/Email.vue` |
| `/invoices` | `invoices` | `views/template/apps/Invoices.vue` |
| `/contact` | `contact` | `views/template/apps/Contact.vue` |
| `/file-manager` | `file_manager` | `views/template/components/FileManager.vue` |

Route paths 81 (baseline) -> 67 (Batch 1) -> 61. All other routes, aliases, redirects and guards are unchanged; `/hrm-dashboard`, `/view-profile`, `/edit-profile`, `/settings`, the workout, nutrition, progress, admin, help, notifications and authentication routes remain.

### Navigation modifications (3 files; only entries targeting the six removed routes)

- `frontend/src/components/sidebarMenu.js`: removed the entire `Trainer` section (its only entries were Chat with Trainer -> `chat` and Scheduling -> `calendar`); removed Administrator `Scheduling` (`calendar`) and `Chat` (`chat`). Kept in order: Dashboard section (7 entries), Administrator `View Progress`, `Upload Picture`, `Users`, `Roles`, and the Developer Tools section (`Test Roles`, `Tools`). Icons, `linkClass` and permission filtering untouched. The desktop sidebar and the mobile More screen derive from this array and tolerate the missing Trainer section (`getSectionByName('trainer') || { menus: [] }`; the `Trainer Services` block is hidden when empty).
- `frontend/src/components/ProfileRightSidebarComponent.vue`: removed the Message (`/chat`) list item. Profile, Help, Settings (`/edit-profile`) and Logout unchanged.
- `frontend/src/views/Member/HomeDashboard.vue`: removed the admin role actions Scheduling (`/calendar`) and Chat (`/chat`), the trainer role actions Chat with Clients and Scheduling, and the matching entries (Chat with Trainer, Scheduling, Admin Chat) in the unrendered `allMenuLinks` array. Administrator role actions Users, Roles and Tools and the three quick actions are unchanged. Trainers no longer see a role-actions block (all of its entries were removed routes).
- Surfaces inspected with no change needed: `MainSidebarComponent.vue`, `navigation/AppBottomNav.vue`, `navigation/MobileMoreScreen.vue`, `ProfileDropdown.vue`, `HeaderComponent.vue`, mobile search, `template/menu/SidebarMenuComponent.vue`. The WorkoutAtlas Schedule Planner and Workout Builder entries were not touched. No placeholder links were added.

### Files deleted (27 = 6 views + 21 components; all previously Git-tracked and in the approved inventory)

Views (6), under `frontend/src/`:

- `views/template/apps/Calendar.vue`
- `views/template/apps/Chat.vue`
- `views/template/apps/Contact.vue`
- `views/template/apps/Email.vue`
- `views/template/apps/Invoices.vue`
- `views/template/components/FileManager.vue`

Components (21), under `frontend/src/components/template/`:

- `ModalWindow.vue`
- `ModalWrapper.vue`
- `email/EmailTableAction.vue`
- `email/EmailTableComponent.vue`
- `email/EmailTableFilterComponent.vue`
- `email/EmailTableHeaderComponent.vue`
- `email/MailDetailsComponent.vue`
- `filemanager/FileList.vue`
- `filemanager/Settings.vue`
- `filemanager/Sidebar.vue`
- `modals/AddNewLabelModalComponent.vue`
- `modals/ComposeNewMailComponent.vue`
- `modals/CreateFolderModalComponent.vue`
- `modals/EventDeleteModal.vue`
- `modals/EventModalComponent.vue`
- `modals/FileDetailsModalComponent.vue`
- `modals/InboxModal.vue`
- `modals/NewMessage.vue`
- `modals/UploadFileModalComponent.vue`
- `modals/VideoCallModal.vue`
- `modals/VoiceCallModal.vue`

### Static verification results (actual)

- Deleted set equals the approved Batch 2 inventory (27 of 27, nothing extra); all were tracked and present before deletion. Cumulative deleted files: 94 = Batch 1 (67, all still deleted) + Batch 2 (27); no other file deleted.
- Before deletion: the importers of the six views were `routing.js` only; every other file in the set was imported only by other files in the set (`ModalWindow.vue` by four of them, `ModalWrapper.vue` by `Email.vue`). No retained file named any of them as a component tag or string.
- After deletion: the only unresolved import in `src` is the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu` (unreachable). Every other retained `@/` and relative import resolves.
- Route table: 61 paths; the six paths are absent; 18 protected paths confirmed present (`/view-profile`, `/edit-profile`, `/settings`, `/hrm-dashboard`, `/dashboard`, `/workout-log`, `/workout-builder`, `/Nutrition`, `/progress`, `/exercises`, `/tools`, `/admin/users`, `/admin/roles`, `/admin/test-roles`, `/help`, `/notifications`, `/logout`, `/login`). Every `import('@/…')` target of the remaining routes exists.
- Live navigation: no `to=`, `href`, `route:`, `link_name` or `router.push` reference to the six paths or names remains in `components`, `views`, `composable`, `layouts`, `router`, `utils`, `config`, `App.vue` or `main.js`. The only remaining string references are in the unreachable `components/sidebarMenu-TEMPLATE.js` (not imported anywhere) and the i18n `crm_dashboard` key (unrelated).
- Incremental Batch 2 diff: 27 deleted files (2,987 lines); `routing.js` -36, `sidebarMenu.js` -25, `HomeDashboard.vue` -12, `ProfileRightSidebarComponent.vue` -3. Cumulative frontend diff: 98 files, 9,249 lines deleted, 0 added (6,186 from Batch 1 + 3,063 from Batch 2).
- Zero changes to backend, CSS/SCSS, package manifests, lockfiles, assets or environment files. Stashes: 13, SHAs identical to the earlier snapshot. BETA unchanged (read-only checks only).

### Skipped candidates and blockers

- The approved Batch 2 inventory holds 27 files, not the 28 expected. `components/template/filemanager/FolderList.vue` is an unreferenced orphan (no importer) that was never assigned to any batch in the saved analysis; it was preserved because it is not in the approved inventory. Owner decision needed on whether to include it later.
- Preserved because retained or shared pages still use them: `DashboardBreadcrumb.vue`, `datatable/DigiDataTable.vue`, `composable/dashboardManage.js` (`initCalendar`), the shared date-range picker and sidebar menu components. Packages used only by removed pages (`@fullcalendar/*`, `vue3-carousel`, `overlayscrollbars`, `moment`, `bootstrap` usage) were not touched; dependency cleanup needs separate approval.
- Empty directories `components/template/email` and `components/template/modals` remain on disk (Git does not track them).
- Not repaired (out of scope): Help `href="#"`; `/user-settings` and `/admin/role-tester` strings in `HomeDashboard.vue`; `/add-product` in `ProductTableHeaderComponent.vue` (Batch 4); `/login-2`; the now-unused `isTrainer` computed in `HomeDashboard.vue`; `index === 1` two-column-layout expression in `MainSidebarComponent.vue` (applies only to empty sub-menu lists in a layout the app does not use). Remaining `sidebarMenu-TEMPLATE.js` route-name strings stay for a later batch. No blockers.

### Cumulative cleanup totals (Batch 1 + Batch 2)

- Files deleted: 94 (67 + 27). Routes removed: 20 (14 + 6). Route paths: 81 -> 61. Source files modified: 4 (`routing.js`, `sidebarMenu.js`, `HomeDashboard.vue`, `ProfileRightSidebarComponent.vue`).

### Manual acceptance checklist (owner; not run)

1. Restart the Vite dev server (and backend) and confirm the application starts; note the recorded DB credential blocker may still affect sign-in.
2. Sign in as a member, a trainer and an administrator.
3. Desktop sidebar: Dashboard, Exercise Log, Workout Planner, Nutrition, Progress, Settings, Logout work; Trainer section is gone; Administrator shows View Progress, Upload Picture, Users, Roles; Developer Tools shows Test Roles and Tools (administrator only).
4. Mobile bottom navigation and More screen: Quick Actions, Your Account, Administration (admin only), Logout; no Trainer Services block.
5. Profile dropdown and right sidebar: Profile, Help, Settings, Logout work; the Message item is gone.
6. Dashboard: date range, quick actions, administrator role actions (Users, Roles, Tools); `/hrm-dashboard` still loads.
7. `/view-profile`, `/edit-profile`, `/settings`, avatar and profile information.
8. Workout Builder, the WorkoutAtlas Schedule Planner, workout logging, active sessions, history, exercise search and favourites, plans, nutrition, progress.
9. Typing `/chat`, `/calendar`, `/email`, `/invoices`, `/contact` or `/file-manager` no longer opens a page (no catch-all route exists; an empty page is expected).
10. Error pages, notifications, authentication and registration.

### Pending

- Owner manual acceptance. Batch 3 not authorised or started. BETA integration NOT AUTHORIZED. No commit, push or merge was made. The inventory remains untracked in Git and was not staged.

## Execution status - task 0.85.cleanup.3 (Batch 3: unused authentication, pricing and email demonstration template removal) - 2026-11-25

Added after the cleanup.2 section; earlier sections are history and are not rewritten. `0.85.cleanup.3` is a task label, not a package version (packages remain `0.85.308`).

**Status: BATCH 3 IMPLEMENTED - PENDING OWNER ACCEPTANCE.** Working tree of branch `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`), nothing staged, committed, pushed or merged. Batch 4 is NOT started. BETA integration NOT AUTHORIZED.

**Acceptance status of earlier batches (recorded, not inferred):** the owner did not state acceptance of Batch 1 (`0.85.cleanup.1.a1`) or Batch 2 (`0.85.cleanup.2`); both remain PENDING OWNER ACCEPTANCE. The owner authorised Batch 3 without acceptance wording for either.

### Restrictions observed

- `.env*` files (backend and frontend) were not read, modified, moved, copied, renamed or deleted; no environment variable was assigned or removed; no Windows environment setting changed.
- Each file was deleted individually by exact path (no recursive or wildcard deletes; no reset, clean, stash or checkout); 13 stashes and BETA unchanged.
- Static verification only: no `npm` script, `node --test`, build, install, DB access or app start; no new temporary script or file was created.

### Routes removed from `frontend/src/router/routing.js` (14)

Each route was verified to point to a `views/template/pages/*` Digiboard demonstration page (static markup, no API, store or composable use) before removal. None pointed to `views/Guest/*`.

| Path | Route name | Component | Layout |
|---|---|---|---|
| `/registration-2` | `registration_2` | `template/pages/authentication/Registration-2.vue` | Guest |
| `/login-status` | `login_status` | `template/pages/authentication/LoginStatus.vue` | Guest |
| `/account-deactivated` | `account_deactivated` | `template/pages/authentication/AccountDeactivated.vue` | Guest |
| `/welcome` | `welcome` | `template/pages/authentication/Welcome.vue` | Guest |
| `/email-verify` | `email_verify` | `template/pages/authentication/EmailVerify.vue` | Guest |
| `/two-factor` | `two_factor` | `template/pages/authentication/TwoFactor.vue` | Guest |
| `/multi-step-signup` | `multi_step_signup` | `template/pages/authentication/MultiStepSignup.vue` | Guest |
| `/pricing-table` | `pricing_table` | `template/pages/additional/PricingTable.vue` | Guest |
| `/pricing-table-2` | `pricing_table_2` | `template/pages/additional/PricingTable2.vue` | Guest |
| `/card-declined` | `card_declined` | `template/pages/authentication/CardDeclined.vue` | Blank |
| `/promotion` | `promotion` | `template/pages/authentication/Promotion.vue` | Blank |
| `/subscription-confirm` | `subscription_confirm` | `template/pages/authentication/SubscriptionConfirm.vue` | Blank |
| `/welcome-mail` | `welcome_mail` | `template/pages/authentication/WelcomeMail.vue` | Blank |
| `/reset-password-mail` | `reset_password_mail` | `template/pages/authentication/ResetPasswordMail.vue` | Blank |

Route paths 81 (baseline) -> 67 (Batch 1) -> 61 (Batch 2) -> 47. Kept: `/login`, `/register`, `/terms-policy`, `/reset-password`, `/update-password`, `/ext-register`, `/logout`, `/coming-soon`, `/coming-soon-2`, `/under-construction`, all error routes, and every Member, Admin and tool route. Guards, aliases and redirects unchanged.

### Navigation and layout modifications (1 file)

- `frontend/src/layouts/Guest.vue`: removed the stale `'pricing_table'` entry from the `errorRoutes` list (it matched only the removed template pricing page). `login_3` and the `login` handling are unchanged.
- `frontend/src/layouts/Blank.vue`: preserved unchanged.
- Surfaces inspected with no reference to the 14 routes (no edit needed): `layouts` (Guest, Blank, App), `views/Guest/*`, `components/sidebarMenu.js`, `MainSidebarComponent.vue`, `navigation/AppBottomNav.vue`, `navigation/MobileMoreScreen.vue`, `ProfileDropdown.vue`, `ProfileRightSidebarComponent.vue`, `HeaderComponent.vue`, `HomeDashboard.vue` quick actions and role actions, `router`, `composable`, `stores`, `utils`, `config`, `i18n`, `App.vue`, `main.js`. No placeholder links added.

### Files deleted (19; all previously Git-tracked and in the approved Batch 3 inventory)

Under `frontend/src/views/template/pages/additional/` (2):

- `PricingTable.vue`
- `PricingTable2.vue`

Under `frontend/src/views/template/pages/authentication/` (17):

- `AccountDeactivated.vue`
- `CardDeclined.vue`
- `EmailVerify.vue`
- `Login-2.vue` (no route; unreferenced mock-up)
- `Login.vue` (no route; unreferenced mock-up; not `views/Guest/Login.vue`)
- `LoginStatus.vue`
- `MultiStepSignup.vue`
- `Promotion.vue`
- `Registration-2.vue`
- `Registration.vue` (no route; unreferenced mock-up)
- `ResetPassword.vue` (no route; unreferenced mock-up; not `views/Guest/ForgotPassword.vue`)
- `ResetPasswordMail.vue`
- `SubscriptionConfirm.vue`
- `TwoFactor.vue`
- `UpdatePassword.vue` (no route; unreferenced mock-up; not `views/Guest/UpdatePassword.vue`)
- `Welcome.vue`
- `WelcomeMail.vue`

The `authentication/` folder is now empty on disk (Git does not track empty folders).

### Authentication protection verification (static)

- Preserved and unmodified: `views/Guest/Login.vue`, `register.vue`, `ForgotPassword.vue`, `UpdatePassword.vue`, `ExternalRegister.vue`, `TermsPolicy.vue`; routes `/login`, `/register`, `/terms-policy`, `/reset-password`, `/update-password`, `/ext-register`, `/logout`; `views/Member/Logout.vue`.
- None of the 19 deleted views imported an API client, store, composable, service or backend endpoint (the only non-asset `@/` import in `template/pages/{authentication,additional}` is `ComingSoon2.vue` -> `utils/browserDialogs`, which is retained and out of scope).
- Router guards, session and role logic, authentication services and composables, Google sign-in preparation and all backend files: no change (diff shows only `routing.js` and `Guest.vue` changed under `frontend/src` for this batch, plus documentation).
- Actual authentication functionality removed: 0.

### Static verification results (actual)

- Deleted set equals the approved Batch 3 allowlist (19 of 19, nothing extra). Cumulative deleted files: 113 = 67 + 27 + 19; Batch 1 and 2 deletions (94) intact; `filemanager/FolderList.vue` preserved.
- Before deletion: 14 files were imported only by `routing.js`; the other five (`Login`, `Login-2`, `Registration`, `ResetPassword`, `UpdatePassword`) had no importer; only intra-batch references existed (`Login-2.vue` <-> `Registration-2.vue` links).
- After deletion: all 44 remaining route component imports in `routing.js` resolve to existing files; no unresolved import was introduced (the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu` is unchanged).
- Route table: 47 paths; the 14 paths are absent. No `to=`, `href`, `link_name`, `router.push`, route-name or path reference to the 14 routes remains in retained source outside `assets` styles and the unreachable `components/sidebarMenu-TEMPLATE.js` (not imported anywhere). No backend reference to the paths.
- Batch 3 diff: 19 files (1,522 lines) deleted; `routing.js` -86; `Guest.vue` 1 line changed. Cumulative frontend diff: 118 files, 10,858 lines deleted, 1 added.
- Zero changes to backend, CSS/SCSS, package manifests, lockfiles, assets or environment files. Stashes: 13, unchanged. BETA unchanged (read-only checks only). Nothing staged.

### Skipped candidates and blockers

- `components/template/filemanager/FolderList.vue` remains preserved (outside every approved inventory).
- `template/pages/additional/ComingSoon.vue`, `ComingSoon2.vue`, `UnderConstruction.vue` and their routes were not in Batch 3 and are kept.
- Assets and styles used only by the removed pages were left untouched (images such as `welcome-img.png`, `card-declined.png`, `promotion.png`, `welcome-bg*.png`, `two-factor-bg*.png`; CSS/SCSS classes such as `.pricing-table`, `.email-verify-panel`, `.two-factor-panel`, `.multi-step-signup-panel`). Cleanup of shared assets and styles needs separate approval.
- Not repaired (out of scope): route-name strings in `sidebarMenu-TEMPLATE.js`; `/add-product` in `ProductTableHeaderComponent.vue` (Batch 4); Help `href="#"`; `/user-settings` and `/admin/role-tester` strings in `HomeDashboard.vue`; unused `isTrainer`; missing `@/composable/sidebarMenu` import in the unreachable `template/MainSidebarComponent.vue`. No blockers.

### Cumulative cleanup totals (Batches 1-3)

- Files deleted: 113 (67 + 27 + 19). Routes removed: 34 (14 + 6 + 14). Route paths: 81 -> 47. Source files modified: 5 (`routing.js`, `sidebarMenu.js`, `HomeDashboard.vue`, `ProfileRightSidebarComponent.vue`, `Guest.vue`).

### Manual acceptance checklist (owner; not run)

1. Restart the Vite dev server (and backend) and confirm the application starts; the recorded DB credential blocker may still affect sign-in.
2. `/login`: the real login form renders, Google sign-in area behaves as before, sign in as a member, a trainer and an administrator.
3. `/register`, `/terms-policy`, `/ext-register`: pages load and the registration flow works.
4. `/reset-password` (forgot password) and `/update-password`: pages load; reset email flow works where configured.
5. `/logout` ends the session and returns to login; protected pages redirect to login when signed out.
6. Role access: member, trainer and administrator navigation and restricted pages behave as before.
7. Desktop sidebar, mobile bottom navigation and More screen, profile dropdown and right sidebar: all links work; no dead entries.
8. Dashboard, `/hrm-dashboard`, profile, settings, Workout Builder, Schedule Planner, logging, history, exercises, plans, nutrition, progress, notifications.
9. Error pages `/error-400` to `/error-504` and `/coming-soon`, `/coming-soon-2`, `/under-construction` still render.
10. Typing any of the 14 removed URLs shows nothing (no catch-all route exists; an empty page is expected).

### Pending

- Owner manual acceptance of Batch 3 (and of Batches 1 and 2, which remain pending). Batch 4 not authorised or started. BETA integration NOT AUTHORIZED. No commit, push or merge was made. The inventory remains untracked in Git and was not staged.

## Execution status - task 0.85.cleanup.4 (Batch 4: unused Digiboard UI demonstration removal) - 2026-11-25

Added after the cleanup.3 section; earlier sections are history and are not rewritten. `0.85.cleanup.4` is a task label, not a package version (packages remain `0.85.308`).

**Status: BATCH 4 IMPLEMENTED - PENDING OWNER ACCEPTANCE.** Working tree of branch `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`), nothing staged, committed, pushed or merged. Batch 5 is NOT started. BETA integration NOT AUTHORIZED.

**Acceptance status of earlier batches (recorded, not inferred):** the owner did not state acceptance of Batch 1 (`0.85.cleanup.1.a1`), Batch 2 (`0.85.cleanup.2`) or Batch 3 (`0.85.cleanup.3`); all remain PENDING OWNER ACCEPTANCE. The owner authorised Batch 4 without acceptance wording for any of them.

### Restrictions observed

- `.env*` files (backend and frontend) were not read, modified, moved, copied, renamed or deleted; no environment variable was assigned or removed; no Windows environment setting changed.
- Each file was deleted individually by exact path (no recursive or wildcard deletes; no reset, clean, stash or checkout); 13 stashes and BETA unchanged.
- No composable, dependency (`package.json`, lockfile), asset, CSS/SCSS or backend deletion or edit.
- Static verification only: no `npm` script, test, build, install, DB access or app start; no new temporary script or file was created.

### Routes removed from `frontend/src/router/routing.js` (10)

Each route used `meta: { layout: 'AppLayout', isPartials: true }` and pointed to a Digiboard demonstration view (no API, store or service use). `/view-profile` and `/edit-profile` (which precede them) were kept.

| Path | Route name | Component |
|---|---|---|
| `/sweet-alert` | `sweet_alert` | `template/components/advanceUI/SweetAlert.vue` |
| `/nestable-list` | `nestable_list` | `template/components/advanceUI/NestableList.vue` |
| `/animation` | `animation` | `template/components/advanceUI/Animation.vue` |
| `/swiper-slider` | `swiper_slider` | `template/components/advanceUI/SwiperSlider.vue` |
| `/form` | `form` | `template/components/Form.vue` |
| `/table` | `table` | `template/components/Table.vue` |
| `/charts` | `charts` | `template/components/Charts.vue` |
| `/icon` | `icon` | `template/components/Icon.vue` |
| `/map` | `map` | `template/components/Map.vue` |
| `/utility` | `utility` | `template/pages/Utility.vue` |

Route paths 81 (baseline) -> 67 (Batch 1) -> 61 (Batch 2) -> 47 (Batch 3) -> 37. Kept: all authentication, Member, Admin and tool routes, `/view-profile`, `/edit-profile`, `/coming-soon`, `/coming-soon-2`, `/under-construction` and all error routes. Guards, aliases and redirects unchanged.

### Navigation and layout modifications (none)

- No live navigation surface referenced the 10 routes (desktop sidebar `sidebarMenu.js`, `MainSidebarComponent`-based menus, mobile bottom navigation and More screen, profile dropdown, right sidebar, header, dashboard quick and role actions, layouts, `router`, `composable`, `stores`, `utils`, `config`, `views/Member`, `views/Guest`, `ToolsView.vue`). Only the unreachable `components/sidebarMenu-TEMPLATE.js` still holds the route-name strings (not imported anywhere; not modified). No placeholder links added.

### Files deleted (48; all previously Git-tracked and in the approved Batch 4 inventory)

Under `frontend/src/views/template/components/` (9): `Charts.vue`, `Form.vue`, `Icon.vue`, `Map.vue`, `Table.vue`, `advanceUI/Animation.vue`, `advanceUI/NestableList.vue`, `advanceUI/SweetAlert.vue`, `advanceUI/SwiperSlider.vue`.

Under `frontend/src/views/template/pages/` (1): `Utility.vue`.

Under `frontend/src/components/template/` (38):

- `DatatableAction/ProductTableAction.vue`
- `charts/` (16): `AreaCharts.vue`, `BarCharts.vue`, `BoxplotCharts.vue`, `BubbleCharts.vue`, `CandlestickCharts.vue`, `ColumnCharts.vue`, `HeatmapCharts.vue`, `LineCharts.vue`, `MixedCharts.vue`, `PieCharts.vue`, `PolarAreaCharts.vue`, `RadarCharts.vue`, `RadialBarCharts.vue`, `ScatterCharts.vue`, `TimelineCharts.vue`, `TreemapCharts.vue`
- `dragable/` (4): `FolderComponent.vue`, `NestedFolderComponent.vue`, `NestedTeamComponent.vue`, `TeamComponent.vue`
- `product/` (4): `ProductInfoComponent.vue`, `ProductRatingComponent.vue`, `ProductTableFilterOption.vue`, `ProductTableHeaderComponent.vue`
- `slider/` (2): `MousewheelSwiper.vue`, `VerticalSwiper.vue`
- `tables/` (11): `BorderColorTableComponent.vue`, `BorderedTableComponent.vue`, `ColorsTableComponent.vue`, `CustomizedDataTableComponent.vue`, `DataTableBodyScrollComponent.vue`, `DefaultDataTableComponent.vue`, `DefaultTableComponent.vue`, `HoverableTableComponent.vue`, `StripedColumnsTableComponent.vue`, `StripedRowsTableComponent.vue`, `WithoutBordersTableComponent.vue`

### Approved inventory files preserved (6 of 54)

| File | Reason |
|---|---|
| `components/template/PagePanelHeader.vue` | Owner-protected shared component. Only importer was the deleted `CustomizedDataTableComponent`; now unreferenced. |
| `components/template/TextEditorComponent.vue` | Owner-protected. Only importer was the deleted `Form.vue`; now unreferenced. |
| `components/template/datatable/DigiDataTable.vue` | Owner-protected. Importers were deleted table components only; now unreferenced. |
| `components/template/datatable/TableFilterOption.vue` | Owner-protected. Importer was the deleted `CustomizedDataTableComponent`; now unreferenced. |
| `components/template/form/DropzoneComponent.vue` | Owner-protected. Only importer was the deleted `Form.vue`; now unreferenced. |
| `components/template/employee/TableFilterOption.vue` | Same file name as the protected `TableFilterOption.vue`; preserved conservatively and reported. Importers were deleted table components only; now unreferenced. |

Also deliberately kept (not in the inventory or protected): `DashboardBreadcrumb.vue` (still used by `EditProfile.vue`), `DateRangePicker.vue`, `HeaderCalculator.vue`, `menu/*`, `MainSidebarComponent.vue`, `filemanager/FolderList.vue`.

### Static verification results (actual)

- Deleted set equals the approved allowlist minus the 6 preserved files (48 of 54, nothing extra, all tracked). Cumulative deleted files: 161 = 67 + 27 + 19 + 48; Batch 1-3 deletions (113) intact; the 6 preserved files still exist.
- Before deletion: the 10 views were imported only by `routing.js`; chart, table, product, dragable and slider components were imported only by the demo views or each other; no retained file (including `ProgressStats.vue`) imported any of them.
- After deletion: 37 route paths; every `import('@/…')` target of the remaining routes resolves; scan of 146 source files found one unresolved import, the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu` (unreachable); zero retained references to the deleted files, the 10 paths or the 10 route names, other than the unreachable `sidebarMenu-TEMPLATE.js`.
- Protected routes present: `/login`, `/register`, `/dashboard`, `/hrm-dashboard`, `/progress`, `/workouts`, `/workout-builder`, `/Nutrition`, `/exercises`, `/settings`, `/view-profile`, `/edit-profile`, `/notifications`, `/coming-soon`, `/coming-soon-2`, `/under-construction`.
- Batch 4 diff: 48 files (4,766 lines) deleted; `routing.js` -60. Cumulative frontend diff: 166 files, 15,684 lines deleted, 1 added.
- Zero changes to backend, CSS/SCSS, package manifests, lockfiles, composables, assets or environment files. Stashes: 13, unchanged. BETA unchanged (read-only checks only). Nothing staged.
- Side effect: the dangling `/add-product` link left in `ProductTableHeaderComponent.vue` by Batch 1 is gone with that file.

### Skipped candidates and blockers

- Composables used only by the removed demos were preserved (no composable deletion authorised): `composable/nestableList.js` (was used by `NestableList.vue`), `composable/chartsDataManage.js` (was used by `Charts.vue`).
- npm packages used only by the removed demos (for example `vue3-apexcharts`, `vuedraggable`, `swiper`) and images/CSS/SCSS used only by them were left untouched; dependency and asset cleanup needs separate approval.
- Not repaired (out of scope): route-name strings in `sidebarMenu-TEMPLATE.js`; Help `href="#"`; `/user-settings` and `/admin/role-tester` strings in `HomeDashboard.vue`; unused `isTrainer`; missing `@/composable/sidebarMenu` import in the unreachable `template/MainSidebarComponent.vue`. No blockers.

### Cumulative cleanup totals (Batches 1-4)

- Files deleted: 161 (67 + 27 + 19 + 48). Routes removed: 44 (14 + 6 + 14 + 10). Route paths: 81 -> 37. Source files modified: 5 (`routing.js`, `sidebarMenu.js`, `HomeDashboard.vue`, `ProfileRightSidebarComponent.vue`, `Guest.vue`).

### Batch 5 candidates (not authorised; listed for planning only)

- Now-unreferenced shared components: `PagePanelHeader.vue`, `TextEditorComponent.vue`, `datatable/DigiDataTable.vue`, `datatable/TableFilterOption.vue`, `employee/TableFilterOption.vue`, `form/DropzoneComponent.vue`; plus `filemanager/FolderList.vue`.
- Composables `nestableList.js`, `chartsDataManage.js`; `sidebarMenu-TEMPLATE.js`; the unreachable `template/MainSidebarComponent.vue`; demo-only npm packages, images and styles.

### Manual acceptance checklist (owner; not run)

1. Restart the Vite dev server (and backend) and confirm the application starts; the recorded DB credential blocker may still affect sign-in.
2. Sign in as a member, a trainer and an administrator; `/login`, `/register`, `/reset-password`, `/update-password`, `/logout` behave as before.
3. Desktop sidebar, mobile bottom navigation and More screen, profile dropdown and right sidebar: all links work; no dead entries.
4. Dashboard and `/hrm-dashboard` render correctly.
5. Progress charts, workout forms and tables render and work (`/progress`, `/workouts`, `/exercises`).
6. Workout Builder, the Schedule Planner, workout logging, history, plans, nutrition.
7. Profile (`/view-profile`, `/edit-profile`), `/settings`, notifications, admin pages and Developer Tools.
8. Error pages `/error-400` to `/error-504` and `/coming-soon`, `/coming-soon-2`, `/under-construction` still render.
9. Typing any of the 10 removed URLs (`/sweet-alert`, `/nestable-list`, `/animation`, `/swiper-slider`, `/form`, `/table`, `/charts`, `/icon`, `/map`, `/utility`) shows nothing (no catch-all route exists; an empty page is expected).

### Pending

- Owner manual acceptance of Batch 4 (and of Batches 1, 2 and 3, which remain pending). Batch 5 not authorised or started. BETA integration NOT AUTHORIZED. No commit, push or merge was made. The inventory remains untracked in Git and was not staged.

## Execution status - task 0.85.cleanup.5 (Batch 5: final unused template composable cleanup) - 2026-11-25

Added after the cleanup.4 section; earlier sections are history and are not rewritten. `0.85.cleanup.5` is a task label, not a package version (packages remain `0.85.308`).

**Status: IMPLEMENTED - PENDING FINAL OWNER ACCEPTANCE.** Working tree of branch `0.85.cleanup` (HEAD `6fdec96255110ce1588051bbf93afde2073a38b6`), nothing staged, committed, pushed or merged. No further batch is planned or authorised. BETA integration NOT AUTHORIZED.

**Acceptance status of earlier batches (recorded, not inferred):** the owner did not state acceptance of Batch 1 (`0.85.cleanup.1.a1`), Batch 2, Batch 3 or Batch 4; all remain PENDING OWNER ACCEPTANCE. Final cleanup acceptance is PENDING.

### Restrictions observed

- `.env*` files were not read, modified, moved, copied, renamed or deleted; no environment variable was assigned or removed.
- Each file was deleted individually by exact path (no recursive or wildcard deletes; no reset, clean, stash or checkout); 13 stashes and BETA unchanged.
- No route, navigation, component, backend, package, lockfile, asset or CSS/SCSS change; no dependency uninstalled; no retained component modified to force a removal.
- Static verification only: no `npm` script, test, build, install, DB access or app start; no new temporary script or file was created.

### Files deleted (4; all Git-tracked and listed in the original inventory, row T10 "Template-only composables")

| File | Lines deleted | Former consumer (removed earlier) | Exports |
|---|---|---|---|
| `frontend/src/composable/chartsDataManage.js` | 1,379 | `views/template/components/Charts.vue` (Batch 4) | 16 `use*ChartData` functions |
| `frontend/src/composable/dashboardManage.js` | 41 | Batch 2 calendar/file-manager views | `initCalendar` |
| `frontend/src/composable/nestableList.js` | 99 | `views/template/components/advanceUI/NestableList.vue` (Batch 4) | `list`, `listThree`, `folderTeamData` |
| `frontend/src/composable/sweetalertManage.js` | 267 | `views/template/components/advanceUI/SweetAlert.vue` (Batch 4) | 14 SweetAlert demo functions |

Combined: 1,786 lines. The saved analysis file held only Batches 1-4; membership of these four files was confirmed from the T10 row of this inventory and the owner's explicit list.

### Dependency verification (static)

- Importers by `@/composable/<name>` or relative path: none in `frontend/src`, `index.html`, `vite.config.js`, tests or scripts. No `import.meta.glob`, `require.context` or dynamic registration.
- Exported names (`initCalendar`, `use*ChartData`, `list`/`listThree`/`folderTeamData`, `saBasic` and the other SweetAlert demo exports) are not used in retained source. The `successMessage` match in `views/Member/exercises.vue` is an unrelated local variable.
- Retained SweetAlert use (`main.js` `VueSweetalert2`, `utils/browserDialogs.js`, `exercises.vue`, `WorkoutBuilder.vue`) imports `sweetalert2` directly and does not depend on `sweetalertManage.js`.
- No protected reusable component, route, navigation entry or WorkoutAtlas feature depended on any of the four files. Preserved files: 0 (all four met every condition).

### Static verification results (actual)

- Cumulative deleted files: 165 = 67 + 27 + 19 + 48 + 4; Batches 1-4 deletions (161) intact; only four composables deleted in this batch.
- Route paths: 37, unchanged; no navigation file modified. The five previously modified source files are the only modified source files.
- Scan of 142 source files: one unresolved import, the pre-existing `template/MainSidebarComponent.vue` -> `@/composable/sidebarMenu` (unreachable; not repaired by instruction). No new unresolved import. Zero retained references to the four deleted files.
- Protected components present: `PagePanelHeader.vue`, `TextEditorComponent.vue`, `datatable/DigiDataTable.vue`, `datatable/TableFilterOption.vue`, `employee/TableFilterOption.vue`, `form/DropzoneComponent.vue`, `filemanager/FolderList.vue`, `HeaderCalculator.vue`, `DateRangePicker.vue`, `MainSidebarComponent.vue`, `sidebarMenu-TEMPLATE.js`.
- Batch 5 diff: 4 files, 1,786 lines deleted. Cumulative frontend diff: 170 files, 17,470 lines deleted, 1 added.
- Zero changes to backend, CSS/SCSS, package manifests, lockfiles, assets or environment files. Stashes: 13, unchanged. BETA unchanged. Nothing staged.

### Final cleanup totals (Batches 1-5)

- Files deleted: 165 (67 + 27 + 19 + 48 + 4). Routes removed: 44 (14 + 6 + 14 + 10 + 0). Route paths: 81 -> 37. Source files modified: 5 (`routing.js`, `sidebarMenu.js`, `HomeDashboard.vue`, `ProfileRightSidebarComponent.vue`, `Guest.vue`).

### Outstanding items (not repaired; no authorisation)

- Pre-existing: missing `@/composable/sidebarMenu` import in the unreachable `template/MainSidebarComponent.vue`; route-name strings in `sidebarMenu-TEMPLATE.js`; Help `href="#"`; `/user-settings` and `/admin/role-tester` strings in `HomeDashboard.vue`; unused `isTrainer`; `/login-2`.
- Orphaned but untouched: six Batch 4 protected components, `filemanager/FolderList.vue`, demo-only npm packages (for example `vue3-apexcharts`, `vuedraggable`, `swiper`, FullCalendar), images such as `chat-bg.png` and `chat-bg-black.png`, orphaned CSS/SCSS, and `frontend/dist` build output. Dependency, asset and CSS cleanup is not authorised.

### Manual acceptance checklist (owner; not run)

1. Restart the Vite dev server (and backend) and confirm the application starts; the recorded DB credential blocker may still affect sign-in.
2. Sign in as a member, a trainer and an administrator; authentication and registration routes behave as before.
3. Desktop sidebar, mobile bottom navigation and More screen, profile dropdown and right sidebar: all links work.
4. Dashboard and `/hrm-dashboard`; Progress charts and statistics.
5. Workout Builder, Schedule Planner, workout logging and sessions, history, exercise search and favourites, Global, Featured and Custom Plans, nutrition.
6. Profile, settings, notifications, admin pages and Developer Tools; AI, gateway and storage features.
7. SweetAlert dialogs in Workout Builder and exercises still display (they use `sweetalert2` directly).
8. Error pages and `/coming-soon`, `/coming-soon-2`, `/under-construction`.
9. Confirm all earlier removed URLs still show nothing (no catch-all route exists).

### Pending

- Owner manual acceptance of every batch and final cleanup verification. No further batch authorised. BETA integration NOT AUTHORIZED. No commit, push or merge was made. The inventory remains untracked in Git and was not staged.

