# WorkoutAtlas Release Readiness

## Current checkpoint

`0.85.312` is **not user accepted** and has unresolved live acceptance items.

## State

- Local runtime: previously reachable and live-tested.
- Automated evidence: passed subsets are preserved in changelog/batch evidence.
- Live evidence: plan/copy/preview/session/history/mobile/media subsets passed.
- Pending: publish/unpublish, Featured registration, role write authorization, ExerciseScope mutation, and two/third-session live replay.
- Content: remaining manual Global plans and exercises are separate content work.

No release should be marked released or accepted merely because automated tests pass.

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
