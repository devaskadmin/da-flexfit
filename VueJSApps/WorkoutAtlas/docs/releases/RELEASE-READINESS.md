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
