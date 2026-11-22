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
