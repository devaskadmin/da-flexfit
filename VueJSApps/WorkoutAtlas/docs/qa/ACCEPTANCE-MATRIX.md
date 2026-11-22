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

## 0.85.313 baseline verification - 2026-11-21

| Check | Result | State |
|---|---|---|
| Requested branch `0.85.113.RESET` | Checked-out branch is `0.85.113`; HEAD commit subject is `0.85.113.RESET` | FAIL — branch name mismatch |
| Restored 0.85.312 baseline | HEAD tree exactly matches BETA `df1f026d506c50456b477e0777a98bb55c2e1977`; direct tree diff empty | PASS |
| Working tree | Clean; no tracked or staged changes | PASS |
| `backend/api/users.js` | 4,768 lines; 37 route definitions | RECORDED |
| Week/day assignment | Payload normalization/reconstruction and exercise `scheduleGroup` assignments verified; MySQL group/exercise tables identified | RECORDED |
| PlanID 5/data protection | No PlanID 5, history, paused session, database, migration, or protected-data change | PASS |

No live acceptance claim or implementation authorization is inferred. STOP pending approval.

Stage 1/10 re-verification (2026-11-21): branch name FAIL; 0.85.312 baseline PASS; `users.js` 4,768 lines / 37 routes RECORDED; source working tree clean (documentation-only edits).

## 0.85.313.a1 Default Week Initialization (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| New plan initializes Week 1 | `createWorkoutPlan` seeds `weekGroups`; contract test passed | PASS (automated) |
| Existing/saved plans unchanged | `hydratePlanner`/`resetPlannerDraft` contain no default; contract test passed | PASS (automated) |
| `users.js` routes | 37 route definitions; no diff | PASS |
| Production build | Vite build passed | PASS |
| PlanID 5/data protection | No database, migration, or protected-data change | PASS |
| Live browser acceptance (Week View on new plan) | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a2 Default Day Assignment (2026-11-21) - SUPERSEDED by 0.85.313.a2.1

| Check | Evidence | Status |
| --- | --- | --- |
| Unassigned exercises assigned to Week 1 on load | Helper suite `7/7` | PASS (automated) |
| Valid assignments, custom week names, recording values preserved | Helper tests (reference equality) | PASS (automated) |
| No duplicate assignment/groups | Case-insensitive de-dup and idempotency tests | PASS (automated) |
| No auto-save during load | Contract test: no fetch/save/router in `hydratePlanner` | PASS (automated) |
| `users.js` routes | 37 route definitions; no backend diff | PASS |
| Production build | Vite build passed (`702` modules) | PASS |
| PlanID 5/data protection | No database, migration, or protected-data change | PASS |
| Live browser load of existing plans | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a2.1 Correct Day Assignment (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Whole days assigned to weeks (in memory) | Mapping suite `11/11` | PASS (automated) |
| Default Week 1, else first existing week | Default-week tests | PASS (automated) |
| Valid assignments, custom weeks, day names preserved | Reconcile tests | PASS (automated) |
| No duplicate day assignment | Case-insensitive uniqueness/idempotency tests | PASS (automated) |
| No `Week 1` day card; exercise labels unchanged | `hydratePlanner` loads exercises as saved; no helper touches `scheduleGroup`; wiring test | PASS (automated) |
| No auto-save; not in payload/dirty state | Wiring and payload tests | PASS (automated) |
| `users.js` routes | 37 route definitions; no backend diff | PASS |
| Production build | Vite build passed (`702` modules) | PASS |
| PlanID 5/data protection | No database, migration, or protected-data change | PASS |
| Live browser load; mapping persistence | Not performed / not implemented | PENDING USER ACCEPTANCE |

## 0.85.313.a3 Persist Day-to-Week Assignments (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Assignments saved to `settings_json` and restored | Fixture round trip (backend suite `11/11`) | PASS (automated, fixture) |
| Existing settings keys preserved | Merge tests | PASS (automated) |
| Non-object stored settings never overwritten; no-op without column | Persist guard tests | PASS (automated) |
| Day names, exercises, recording values untouched | No change to group/exercise save code; frontend `28/28` | PASS (automated) |
| Default to Week 1 / first week; Week 1 initialized if none | Reconcile tests and hydrate contract test | PASS (automated) |
| Unsaved-change detection includes assignments | Contract test | PASS (automated) |
| `users.js` routes | 37, identical order to HEAD; `node --check` clean | PASS |
| Production build | Vite build passed (`702` modules) | PASS |
| Schema / production data | No `ALTER`, migration, or data write; PlanID 5 untouched | PASS |
| Column present in target DB; browser save and reopen | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a3.1 Database Verification (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| `settings_json` exists in target DB | User-run read-only query (phpMyAdmin): 1 row in `stephenk_flexfit` | PASS (user-supplied evidence) |
| Data type and nullability | Backups `0.76`/`0.83`: nullable `longtext utf8mb4_bin` with `json_valid` (not the live DB) | PASS: `longtext`, nullable (`YES`), default `NULL`; matches backups |
| No database writes or schema change | None performed | PASS |
| No application code change; PlanID 5 | No code edited; PlanID 5 not read or modified | PASS |

## 0.85.313.a3.2 Preserve Day and Week Groups (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Both day and week groups saved in either mode | Backend `workout-plan-groups` `21/21` (fixture) | PASS (automated, fixture) |
| Group IDs, names, order preserved on re-save; no duplicates | Fixture re-save, reorder and legacy-duplicate tests | PASS (automated, fixture) |
| Unintended deletion prevented | Isolated removal, unsent-set and placeholder tests | PASS (automated, fixture) |
| Exercises, recording values, day-to-week assignments intact | Settings suite `11/11`; assignment week names remain; frontend `29/29` | PASS (automated) |
| `users.js` routes | 37, identical order to HEAD; `node --check` clean; CRLF kept | PASS |
| Production build | Vite build passed | PASS |
| Schema / production data | No `ALTER`, migration or data write; PlanID 5 fixture unchanged | PASS |
| Other readers counting all groups (`workout-log.js`, `dashboard.js`, plan list `group_count`) | Not changed; documented | OPEN (user decision) |
| Browser save and reopen in day and week modes; mode switch; reload | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a3.3 Schedule Group Filtering (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Workout Log day ordering excludes week containers (`GET`/`PUT /day-order`) | Suite `24/24`: builder, custom and ordered lists; display order written for days only | PASS (automated, fixture) |
| Dashboard weekly target excludes week containers | Dashboard fixture tests; plan with only weeks gives 0 | PASS (automated, fixture) |
| Plan-list day totals exclude week containers | Source contract plus evaluated SQL predicate | PASS (automated; `users.js` not runnable locally) |
| Legacy Week View still works | Week-mode plan keeps its week groups in ordering and target | PASS (automated, fixture) |
| Shared label between a day card and a week container | Ordering lists one day card and writes only the day row | PASS (automated, fixture) |
| Save logic, UI, schema, data | No change; PlanID 5 fixture snapshot unchanged; no writes outside the requested plan | PASS |
| Routes | `users.js` 37, `workout-log.js` 14, `dashboard.js` 3; identical to HEAD | PASS |
| Regression | `21/21`, `11/11`, frontend `29/29`, Vite build passed | PASS |
| SQL on real MySQL; add-exercise default group and `workout-sessions.js` lookups | Not executed / not changed | OPEN |
| Browser: Workout Log day order, dashboard card and Find Plans day counts for day and week plans | Not performed | PENDING USER ACCEPTANCE |
