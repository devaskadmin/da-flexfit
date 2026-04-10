# Changelog

## [0.68.3] - 2026-04-09

### Changed
- **Detailed page header gradient theming refactor** (main page banners only):
  - Added shared theme variable `--ff-page-header-gradient` in all primary color stylesheets:
    - `blue-color.css`
    - `orange-color.css`
    - `pink-color.css`
    - `purple-color.css`
    - `green-color.css`
    - `gold-color.css`
    - `eagle_green-color.css`
    - `deep_pink-color.css`
    - `tea_green-color.css`
    - `yellow_green-color.css`
  - Standardized shared page-header radius via `--ff-page-header-radius`.
  - Shared page-header styling now resolves from theme CSS variables, so initial page load reflects the active theme immediately.
  - Theme-color changes in layout settings now automatically update page-header gradients without per-page hardcoded colors.
- **Header consistency updates** across major member pages:
  - Dashboard
  - Exercises
  - Workouts (Log Workout)
  - Workout Builder
  - Nutrition
  - Settings
  - Other pages already using the shared top-banner pattern (`.ff-page-header`)
- **Settings header alignment**:
  - Preserved as the visual reference while now using the same shared theme-driven gradient variable architecture.
- **Header date picker input styling polish**:
  - Updated date-input typography inside page headers to match header UI scale and weight.
  - Improved date-input contrast, padding, and rounded-corner treatment while preserving existing layout/position.
  - Added responsive size tuning for mobile readability.
- **Nutrition header date control simplification**:
  - Removed duplicate top `Selected Date` label and bottom date text from Nutrition header.
  - Kept a single right-aligned date input control using the same simplified pattern as other main pages.
  - Preserved existing functionality and header layout.
- **Safari login failure diagnostics**:
  - Added Safari-targeted detailed error messaging on login failure.
  - Added explicit troubleshooting steps for Safari cookie/session restrictions.
  - Included API/status/network detail context in the on-screen error for faster debugging.
  - Added `Copy Login Diagnostics` action so full failure details can be copied and shared during testing.
  - Added always-visible Safari hint banner on login so users can confirm diagnostics support is active before testing.

### Database
- No schema changes in `0.68.3`.

### Files Updated
- `frontend/src/assets/css/style.css`
- `frontend/src/assets/css/blue-color.css`
- `frontend/src/assets/css/orange-color.css`
- `frontend/src/assets/css/pink-color.css`
- `frontend/src/assets/css/purple-color.css`
- `frontend/src/assets/css/green-color.css`
- `frontend/src/assets/css/gold-color.css`
- `frontend/src/assets/css/eagle_green-color.css`
- `frontend/src/assets/css/deep_pink-color.css`
- `frontend/src/assets/css/tea_green-color.css`
- `frontend/src/assets/css/yellow_green-color.css`
- `frontend/src/views/Member/UserSettings.vue`
- `frontend/src/views/Member/WorkoutBuilder.vue`
- `frontend/.env`
- `frontend/src/views/Guest/Login.vue`
- `frontend/public/changelog.txt`
- `Database Log file.txt`

---

## [0.68.2] - 2026-04-09

### Fixed
- **Mobile login/session reliability** improvements for Safari/Android/desktop by waiting for session readiness before route transition.
- **Admin authorization mismatch** resolved with robust role checking (role mappings + fallback profile role support).
- **Settings page loading blocker** resolved (startup preloader no longer persists unexpectedly).

### Changed
- **Password reset temp-login flow hardening**:
  - pending reset login now validates reset-code path consistently;
  - temporary reset code invalidated after successful temp-login handoff.
- **Terms/registration/login UX polish** and defensive flow handling retained.
- **Header/date UX refinements**:
  - Exercises top selected-date label removed while keeping date input control.
  - Nutrition selected-date labeling clarified.
- **Profile greeting copy format** updated to `Greetings, <username>`.
- **Settings header styling baseline** set to the target polished blue gradient used as the v0.68.3 reference.

### Database
- No schema changes in `0.68.2`.

---

## [0.68.1] - 2026-04-09

### Fixed
- **Front page infinite loading spinner** by auto-clearing startup preloader after initial render.

### Changed
- **Login page cleanup**:
  - Removed duplicate lower `Forgot Password?` link (kept the inline link beside `Remember Me`).
  - Removed login `Database status` panel from UI.
  - Reverted footer info sections to single-column stacked layout for better mobile readability.
- **Version bump**:
  - App version now set to `0.68.1` via `frontend/.env` (`VITE_APP_VERSION`).
  - Login fallback version updated to `0.68.1`.

### Database
- No schema changes in `0.68.1`.

### Files Updated
- `frontend/src/App.vue`
- `frontend/src/views/Guest/Login.vue`
- `frontend/.env`
- `frontend/public/changelog.txt`

---

## [0.68] - 2026-04-09

### Added
- **Remember Me session support** on login (`Remember Me` checkbox now extends session cookie lifespan up to 1 week).
- **User profile dropdown menu** in header profile icon with:
  - `Greetings <username>`
  - `View Settings` (routes to user settings)
  - `Logout`
- **Login app version display** (`Version: APP_VERSION`) with fallback to `0.68`.
- **Developer Change Log Notes** link on login page.
- New public changelog pages/files:
  - `frontend/public/changelog.html` (scrollable full-page viewer)
  - `frontend/public/changelog.txt` (text source)

### Changed
- **Theming persistence improvements**:
  - Right layout sidebar now supports saving advanced theme visibility per user.
  - Theme settings and display settings now stay in sync across localStorage and DB profile settings.
- **Profile settings merge logic** in backend now deep-merges nested settings to avoid overwriting sibling config objects.
- **Page header styling consistency updates** across member pages:
  - Account Settings header now uses themed gradient style.
  - Dashboard and Workouts header border/radius alignment updated.
  - Nutrition header date section labeling/alignment updated (`Selected date`).
- **Log Workout page layout alignment** improved to match header/body width consistency.

### Fixed
- Prevented nested user settings from being unintentionally replaced during partial settings saves.
- Improved consistency of theme sidebar hide behavior across startup and saved profile state.

### Database
- No schema changes in `0.68`.

### Files Updated
- `frontend/src/views/Guest/Login.vue`
- `frontend/src/components/HeaderComponent.vue`
- `frontend/src/components/RightSidebarComponent.vue`
- `frontend/src/views/Member/UserSettings.vue`
- `frontend/src/views/Member/HomeDashboard.vue`
- `frontend/src/views/Member/LogWorkout.vue`
- `frontend/src/views/Member/NutritionWorkspace.vue`
- `frontend/src/views/Member/exercises.vue`
- `frontend/public/changelog.html` (new)
- `frontend/public/changelog.txt` (new)
- `backend/api/auth.js`
- `backend/api/users.js`

---

## [0.6.7] - 2026-04-09

### Added
- **Forgot Password Flow** — Implemented password reset request and reset form in frontend (`Guest/ForgotPassword.vue`, `Guest/ResetPassword.vue`).
- Backend API endpoints for password reset email and token validation.
- Email templates for password reset notifications.
- New database fields for password reset tokens and expiry.
- User feedback for password reset success/failure.

### Changed
- Improved error handling and user messages across login/register/forgot password flows.
- Updated frontend and backend dependencies to latest minor versions.
- Minor UI/UX tweaks to guest authentication pages.

### Fixed
- Resolved issues with email delivery for password reset (SMTP config, error logging).
- Fixed edge case where expired tokens were not properly invalidated.

### Database
- Added `password_reset_token` and `password_reset_expires` columns to `users` table.

### Files Updated
- `frontend/src/views/Guest/ForgotPassword.vue`, `frontend/src/views/Guest/ResetPassword.vue`
- `backend/api/auth.js`, `backend/email/templates/resetPassword.html`
- `backend/models/user.js`, `backend/dbConfig.js`
- `frontend/package.json`, `backend/package.json`

---

All notable changes to **FlexFit** are documented in this file.

---

## [0.6.5] - 2026-04-01

### Changed
- **Environment refactor** — replaced all hardcoded `localhost` URLs and custom `RUN_PUBLIC` switch logic with a clean `.env` / `.env.local` split.
- `frontend/.env` now holds production/Render defaults (`VITE_API_BASE` = Render backend URL).
- `frontend/.env.local` holds local dev overrides (`VITE_API_BASE=http://localhost:5000`) — gitignored.
- `backend/.env` now holds production/Render defaults (`FRONTEND_URL`, `SESSION_COOKIE_SECURE=true`, `NODE_ENV=production`).
- `backend/.env.local` holds local dev overrides — gitignored.
- Created `frontend/src/config/env.js` — single shared `API_BASE` export used by all frontend files.
- Removed hardcoded `http://localhost:5000` from all frontend source files (13 files updated).
- Simplified `backend/server.js` — removed `RUN_PUBLIC`/`IS_RENDER` mode detection; server now uses `const PORT = process.env.PORT || 5000` for all environments.
- CORS allowlist driven purely by `FRONTEND_URL` + `CORS_ORIGINS` env vars.
- Session cookie security driven by `SESSION_COOKIE_SECURE` env var.
- `SESSION_SECRET` moved from hardcoded string to env var.
- `backend/dbConfig.js` updated to also load `.env.local` overrides.

### Files Updated
- `backend/server.js`, `backend/dbConfig.js`, `backend/.env`, `backend/.env.local` (new)
- `frontend/.env`, `frontend/.env.local` (new), `frontend/src/config/env.js` (new)
- `frontend/src/router/index.js`, `frontend/src/router/Session.js`
- `frontend/src/components/HeaderComponent.vue`, `frontend/src/components/exercises.vue`
- `frontend/src/views/Guest/Login.vue`, `frontend/src/views/Guest/register.vue`
- `frontend/src/views/Member/Logout.vue`, `frontend/src/views/Member/Notifications.vue`
- `frontend/src/views/Member/AdminUsers.vue`, `frontend/src/views/Member/AdminRoles.vue`
- `frontend/src/views/Member/AdminRoleTester.vue`, `frontend/src/views/Member/exercises.vue`
- `frontend/src/views/LogWorkout.vue`

---

## [0.6.4] - 2026-04-01

### Added
- **Render.com deployment** — full production deployment of frontend and backend.
- Backend binds to `process.env.PORT` (Render dynamic port assignment).
- Session cookies configured with `secure: true` and `sameSite: 'none'` for Render HTTPS.
- `trust proxy` enabled for Render's reverse proxy.
- `GET /api/db-status` endpoint for live database connectivity check.
- `DEBUG=true` mode exposes structured DB error info (`code`, `errno`, `host`, etc.) from `/api/db-status`.
- Temporary PHP DB connectivity test script (`backend/PHP/db_connect_test.php`).
- In-app database status indicator on the Login page (checking / connected / disconnected).

### Fixed
- Linux case-sensitive import errors blocking Render build:
  - `Exercises.vue` → `exercises.vue`
  - `widgets/` → `Widgets/`
  - `template/Product/` → `template/product/`
- `apexcharts` dependency bumped to `^5.10.4` to satisfy `vue3-apexcharts` peer dependency.
- Frontend router guard tightened — requires both `/api/session` and `/api/db-status` to pass before rendering protected routes.
- Root route `/` now redirects to `/login`; dashboard moved to `/dashboard`.
- Render SPA rewrite rule configured (`/*` → `/index.html` as Rewrite, not Redirect).

### Infrastructure
- Frontend static site: `https://flex-fit-lkzh.onrender.com`
- Backend web service: `https://dev-asterisks-github.onrender.com`
- DB host: `65.181.116.252` (Hosting.com/cPanel, remote access enabled for Render IPs)

---

## [0.6.3] - 2026-03-28

### Added
- **In-app notification system** — bell icon in header opens `/notifications` page.
- `frontend/src/views/Member/Notifications.vue` — full notifications page with filter (all/unread), mark as read, mark all read, refresh.
- `backend/api/notifications.js` — REST API: list, unread count, mark read, mark all read, create.
- `backend/sql/notifications_schema.sql` — `notifications` and `notification_preferences` tables.
- Unread badge on bell icon polls backend every 60 seconds.

---

## [0.6.2] - 2026-03-27

### Added
- Membership tiers (`membership_tiers` table).
- Role-based access system (`roles`, `user_roles` tables).
- User profiles (`user_profiles` table).
- User membership billing history (`user_memberships` table).
- Admin UI: Users management, Roles management, Role Tester pages.

---

## [0.6.1] - 2026-03-26

### Added
- Enhanced exercise browser with improved search filtering and category navigation.
- Nutrition macro tracking stabilized with improved Open Food Facts API reliability.
- Workout log history pagination and export functionality.
- Admin dashboard for managing members, exercises, and content.

### Improved
- Workout log UI refinements and data consistency fixes carried forward from 0.6.0-alpha.
- General stability and performance improvements across member-facing views.

---

## [0.6.0-alpha] - 2026-03-23

> ⚠️ **Alpha Release** — Active development. Features may be incomplete or subject to change.

### Added
- Branch `flexfit-0.5` promoted toward **0.6 Alpha** milestone.
- Continued integration of nutrition tracking improvements from prior cycles.
- Ongoing workout log UI refinements and data consistency fixes.

### In Progress
- Enhanced exercise browser and search filtering.
- Nutrition macro tracking and Open Food Facts API stability improvements.
- Workout log history pagination and export.
- Admin dashboard for managing members, exercises, and content.

---

## [0.3.9] - 2025-12-22

### Changed
- Updated `.gitignore` and environment config (`.env`) for cleaner repo hygiene.
- Refined Open Food Facts API integration (`main-api.js`).
- Updated `LogWorkout.vue`, `exercises.vue`, and `nutrition.vue` views with stability fixes.

---

## [0.3.9] - 2025-08-28

### Added
- Expanded Open Food Facts API module (`main-api.js`).
- Initial nutrition view (`nutrition.vue`) introduced to the member area.

---

## [0.3.8-a] - 2025-08-27

### Fixed
- Follow-up patch to 0.3.8 with additional stability corrections.

---

## [0.3.8] - 2025-08-27

### Improved
- General codebase cleanup and refinements following the 0.3.7 release.

---

## [0.3.7] - 2025-07-18

### Added
- **Workout Log Deletion** — Users can now delete recorded workout logs directly from the log table.
- **Per-Row Edit/Cancel** — Each workout log row now supports inline editing. A cancel button lets users revert changes without saving.

### Improved
- Improved vertical spacing and 100% width stacking for workout log rows for better readability on all screen sizes.
- Increased size for log action icons and buttons for improved accessibility and touch support.

### Fixed
- Fixed an issue where deleting a workout log did not correctly update the UI or backend state.
- Resolved missing/incorrect TypeScript configuration (`tsconfig.json` and Vue shims) that caused build errors.
- Addressed layout issues where workout log rows were too close together at full width.

### TypeScript & Build
- Fixed `tsconfig.json` and Vue shims to ensure smooth development and build processes.

### Other
- General code cleanup and improved state management for per-row editing.

---

## [0.3.7.5] - 2025-07-17

### Changed
- Incremental patch fixes ahead of the 0.3.7 release.

---

## [0.3.6] - 2025-07-13

### Improved
- Continued refinement of member-facing views and workout tracking flows.

---

## [0.3.5] - 2025-07-04

### Added
- Continued feature work on the `flexfit-0.5` development branch.

---

## [0.3.3] - 2025-06-04

### Added
- Workout log features and member view updates merged from the `flexfit-0.4` branch.

---

## [0.3.0] - 2025-05-28

### Added
- Full `0.3 Release` — merged backend and frontend branches into a stable baseline.
- Database schema finalized and seeded (`0.3 Release DB`).
- Core backend API structure: `auth.js`, `users.js`, `excerises.js`, `workout-log.js`.
- Open Food Facts API module scaffolded under `api/OpenFoodFactsAPI/`.
- Image upload component added (`Components/ImageUpload/ImageUpload.js`).

---

## [0.2.99] - 2025-05-22

### Changed
- Pre-release stabilization pass before the 0.3 milestone.

---

## [0.2.9] - 2025-03-22

### Added
- Early backend/frontend integration work.
- Initial Vue 3 + Vite frontend scaffolding with routing, stores (Pinia), and i18n support.
- Express/Node.js backend with JWT authentication, bcrypt password hashing, and MySQL via `db.js`.
- Basic member area views: exercises, workout log, nutrition (stubs).
- Role-based routing and layout system (`layouts.js`).
