# WorkoutAtlas Acceptance Matrix

| Workflow | Automated | Live tested | User accepted | State |
|---|---|---|---|---|
| Plan Builder create/save | Existing coverage | Disposably live-tested | No | LIVE TESTED |
| Plan publish/unpublish | Existing coverage | Not reliably live-completed | No | PENDING VERIFICATION |
| Global discovery/copy | Existing coverage | Live-tested | No | LIVE TESTED |
| Featured registration | Existing coverage | Blocked: no live Featured plan | No | BLOCKED |
| ExerciseScope mutation | Existing coverage | Not safely performed | No | PENDING VERIFICATION |
| Workout sessions | Existing coverage | Partial live-tested | No | PENDING USER ACCEPTANCE |
| History correction/deletion | Existing coverage | Live-tested disposable record | No | LIVE TESTED |
| HTTP 400 regression | Passed | Live-tested | No | LIVE TESTED |
| 390/800 mobile | Existing coverage | Live-tested | No | LIVE TESTED |
| WA-UI-TABLET-001 page-level overflow | Passed at 320/390/768/800/820/1024/1366px | Read-only browser-tested; no mutation | No | USER ACCEPTANCE PENDING |
| WA-UI-TABLET-001 internal table overflow and action access | Passed at 768/800/820/1024px; cards replace table | Read-only browser-tested; all card actions visible | No | USER ACCEPTANCE PENDING |

## Restored-code implementation verification - 2026-11-21

| Requirement | Automated/source verification | State |
|---|---|---|
| 0.85.309 top-right Save button | Source lacks top-right control; Save is in bottom primary-actions footer | FAIL |
| 0.85.309a Save-button alignment | No top-right Save/alignment implementation found | FAIL |
| 0.85.311 recording type, fields, layout, More/Less, tags | Recording-field utility tests pass 5/5; source includes layout and Goal Tags | PASS |
| 0.85.312 bottom Add Day/Add Week after one day/week and two exercises | No matching implementation/commit found | MISSING |

## 0.85.312 bottom schedule controls - 2026-11-21

| Requirement | Automated/source verification | State |
|---|---|---|
| Bottom Add Day/Add Week in Create Plan | Render condition and existing handler wiring present | USER ACCEPTANCE PENDING |
| Bottom Add Day/Add Week in Edit Plan | Shared Create/Edit schedule implementation present | USER ACCEPTANCE PENDING |
| At least one schedule and two exercises | Visibility condition source-verified | USER ACCEPTANCE PENDING |
| Collapsed accordion accessibility | Bottom controls rendered outside accordion bodies | USER ACCEPTANCE PENDING |
| Desktop/tablet/mobile layout | Existing responsive CSS plus contract coverage | USER ACCEPTANCE PENDING |

Focused contract suite passed `12/12`; Vite build passed `701` modules. Live browser acceptance is still required.

This was verification-only. No live user acceptance or 0.85.313 implementation is claimed.

## 0.85.311 FIX consolidated verification - 2026-11-21

| Requirement | Verification | State |
|---|---|---|
| Recording Type determines primary/additional fields | Utility tests cover Sets & Reps, Time & Distance, and Custom | PASS |
| Workout Type determines badge only | Utility tests prove independence; empty badges are hidden | PASS |
| Exactly three fields per row | Utility/component source and contract coverage | PASS |
| Labels left of inputs | Builder/session component source | PASS |
| Fourth-column More/Less control | Shared component source; blue 44px control | PASS |
| Additional fields collapse by default | Component state starts collapsed | PASS |
| Values preserved while toggling | State toggles only; no value reset logic | PASS |
| LBS replaces Wt/Weight labels | Shared utility and session component labels corrected | PASS |
| Empty exercise tags omitted | Builder/session source hides empty labels | PASS |
| Create/Edit/View/Preview/Log/Active/Resume/History coverage | Shared components cover multiple surfaces, but browser replay is incomplete | NOT VERIFIED |
| Desktop/tablet/mobile visual layout | Source responsive CSS and build passed; live geometry is incomplete | NOT VERIFIED |

Focused recording/builder tests passed `19/19`; Vite build passed `701` modules. User acceptance remains pending.

## 0.85.312 recovery checkpoint - 2026-11-21

| Implementation | Automated result | Live/user acceptance |
|---|---|---|
| 0.85.309 top Save | Contract/build PASS | PENDING |
| 0.85.309a Save alignment | Contract/build PASS | PENDING |
| 0.85.311 FIX recording fields/layout/tags | Focused tests PASS 19/19; build PASS | NOT VERIFIED / PENDING |
| 0.85.312 bottom Add Day/Add Week | Contract/build PASS | PENDING |

Historical restored-code FAIL/MISSING evidence above is preserved as historical verification context. 0.85.313 is TODO and not started.
