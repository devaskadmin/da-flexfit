# Changelog

All notable changes to **FlexFit** are documented in this file.

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
