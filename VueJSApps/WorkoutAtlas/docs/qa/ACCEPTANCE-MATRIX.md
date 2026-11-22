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

## 0.85.313.a3.4 Global Plan Persistence (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Global/Featured/Community create and edit keep day-to-week assignments | Source contract on `PATCH /admin/global-workout-plans/:id/schedule`; fixture edit replaces stale assignments and keeps other settings | PASS (automated; `users.js` not runnable locally) |
| Global adopt and featured clone copy assignments | Source contract on both routes; fixture clone copies assignments, source row unchanged | PASS (automated) |
| Plan-type conversion and register-time featured copy keep assignments | Source contract on `users.js` and `auth.js` | PASS (automated, contract only) |
| Week names, exercises, recording values, permissions | Unchanged code paths (a3.2 group copy); assignments stored verbatim | PASS (by design) |
| No write when `settings_json` is missing; no DDL; statements scoped to the new schedule | Fixture: no queries issued without the column; no ALTER/DROP/CREATE | PASS (automated) |
| PlanID 5 | Fixture snapshot unchanged | PASS |
| Routes | `users.js` 37, identical to HEAD | PASS |
| Regression | settings `11/11`, groups `21/21`, group filter `24/24`, frontend 7 files, Vite build | PASS |
| SQL on real MySQL; register/conversion integration suites | Not executed (`express`/`mysql2` missing locally) | OPEN |
| Browser: create/edit a global plan with week assignments, clone a plan, adopt a global and a featured plan, reopen each | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a4 Unified Schedule Planner, Stage 5/10 (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Day View / Week View tabs removed from Create/Edit Workout Plan | Contract suite `8/8`: no tab text, `planner-mode-*` markup or `changeScheduleMode` in the builder | PASS (automated, source contract) |
| One Schedule Planner listing workout day cards | Contract: heading, day-card loop and card class present | PASS (automated, source contract) |
| Add Day, Add Exercise, Add Exercise to End, bottom controls, day menu preserved | Contract assertions | PASS (automated, source contract) |
| Week dropdown and Rename Week not added | Contract: neither present | PASS |
| Week assignments and workout content preserved | Payload still sends both group sets, orders, `settings.dayWeekAssignments`, exercises; hydrate restores them; builder only ever in day mode | PASS (automated, source contract) |
| Legacy plan compatibility | Load logic unchanged | PASS (by design); not verified in a browser |
| Nothing above Workout Plan Information, no backend/DB/package change; PlanID 5 | Diff limited to the planner section of `WorkoutBuilder.vue`; no data access | PASS |
| Regression | 8 frontend test files, 70 tests; Vite build passed | PASS |
| Browser: tabs gone, layout spacing, Add Day/Add Exercise/Save work, reopen a plan with weeks and a legacy week-mode plan | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a5 Week Selection Dropdown, Stage 6/10 (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Week dropdown inside the Schedule Planner, above Add Day and the day cards, below Workout Plan Information | Contract suite `7/7` (source position) | PASS (automated, source contract) |
| Options come from existing saved weeks; `Week 1` shown as `Week 1 (Default)`, stored as `Week 1` | Util tests `18/18` (`buildWeekOptions`), contract | PASS (automated) |
| Default selection Week 1, else the first existing week; kept while the week exists; reset on load/reset | Util tests, contract | PASS (automated) |
| Switching weeks does not lose unsaved changes, edit data, save or filter cards | Contract: selection not in payload, dirty snapshot, draft, card loop or any data write | PASS (automated, source contract) |
| Day filtering, Add Week, Rename Week not added | Contract | PASS |
| Existing controls, assignments and save behavior preserved | Contract plus unchanged payload/dirty assertions; a4 contract `8/8` | PASS (automated) |
| Nothing above Workout Plan Information; no backend/DB/package change; PlanID 5 | Diff hunks all below the metadata form; no data access | PASS |
| Regression | 9 frontend test files, 81 tests; Vite build passed | PASS |
| Browser: dropdown renders with `Week 1 (Default)`, switching weeks keeps unsaved edits, plan without Week 1 selects its first week, save and reopen unchanged | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a6 Add Week, Stage 7/10 (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| `+ Add Week` beside the Week dropdown, below Workout Plan Information | Contract suite `8/8` (source position) | PASS (automated, source contract) |
| Enabled only when the selected week has a day with at least one exercise; only the selected week is checked, not the whole plan | Util tests `24/24` (`weekHasDayWithExercise`), contract | PASS (automated) |
| Next unique name (Week 2, Week 3, gap-filling, case-insensitive) | Util tests (`buildNextWeekName`) | PASS (automated) |
| New week is auto-selected and starts empty; no assignments, days or exercises edited | Contract: handler body has no data writes | PASS (automated, source contract) |
| Switching existing weeks is never disabled; unsaved changes preserved | Contract: `<select>` has no disabled binding; selection not in payload/dirty snapshot | PASS (automated, source contract) |
| Rename Week and day filtering not added; existing controls and save payload preserved | Contract; a4/a5 contract suites | PASS |
| Nothing above Workout Plan Information; no backend/DB/package change; PlanID 5 | Diff hunks all below the metadata form (plus import and CSS); no data access | PASS |
| Regression | 10 frontend test files, 95 tests; Vite build passed | PASS |
| Browser: disabled/enabled states, Week 2/Week 3 creation and selection, empty new week, switching, unsaved edits kept, save and reopen keeps the new week | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a7 Rename Week, Stage 8/10 (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Three-dot menu with Rename Week beside the Week dropdown, below Workout Plan Information; disabled outside create/edit mode | Contract suite `9/9` (source position, disabled binding) | PASS (automated, source contract) |
| Editor reuses the inline day-rename look and the day name validator; Enter saves, Escape cancels | Contract | PASS (automated, source contract) |
| Custom names with spaces, apostrophes and hyphens accepted | Util tests `29/29` (`renameWeekInPlan`), validator pattern contract | PASS (automated) |
| Empty and duplicate names rejected, including different case; own name and capitalisation-only change allowed | Util tests | PASS (automated) |
| Day-to-week assignments, week position, selection, exercises and days preserved; no duplicate week created; inputs not mutated | Util tests, contract (handler touches no days or exercises) | PASS (automated) |
| Rename state not in payload, dirty snapshot or draft; reset on load/reset; menu closes on outside click | Contract | PASS (automated, source contract) |
| Week identity independent of name | Builder keeps its identity entry on rename (contract). Persistence has no stable week id: a saved rename replaces the week's group row (new group id); backend not changed | LIMITATION (reported; unverified on a live DB) |
| Day filtering not added; nothing above Workout Plan Information; no backend/DB/package change; PlanID 5 | Contract; diff hunks all below the metadata form (plus import, helper state and CSS); no data access | PASS |
| Regression | 11 frontend test files, 109 tests; Vite build passed | PASS |
| Browser: menu placement and styling, rename flow, error messages, dropdown and selection update, assigned days intact, save and reopen shows the new name | Not performed | PENDING USER ACCEPTANCE |

## 0.85.313.a8 Week Filtering and Day Assignment, Stage 9/10 (2026-11-21)

| Check | Evidence | Status |
| --- | --- | --- |
| Only the days assigned to the selected week are shown (default-week fallback for unassigned days) | Util tests `35/35` (`getDaysForWeek`), contract suite `12/12` (cards built from `visibleDayGroups`) | PASS (automated) |
| New days from the top and bottom Add Day controls are assigned to the selected week | Util tests (`assignDayToWeek`), contract (shared `addScheduleGroupFromValue`) | PASS (automated, source contract) |
| A newly created week shows an empty schedule | Util tests, contract (empty-state message) | PASS (automated) |
| Switching weeks keeps unsaved days, exercises, recording values and assignments; nothing saved | Contract (watcher touches no plan data) | PASS (automated, source contract) |
| Save payload still carries every week, day, assignment and exercise | Contract | PASS (automated, source contract) |
| Identical day names in separate weeks | Data model is keyed by day name; backend matches by label | BLOCKER (reported, not implemented; duplicates stay rejected with a message naming the other week) |
| Add Week validation, Rename Week and day-card actions preserved; move up/down within the week | Contract; util tests (`moveDayAmongVisible`); a6/a7 suites | PASS (automated) |
| Nothing above Workout Plan Information; no backend/DB/package change; PlanID 5 | Diff hunks all below the metadata form (plus import and helper state); no data access | PASS |
| Regression | 12 frontend test files, 127 tests; Vite build passed | PASS |
| Browser: filtered cards per week, Add Day top and bottom, empty new week, switching weeks keeps edits, move within a week, Add Week and Rename Week, save and reopen preserves all weeks | Not performed | PENDING USER ACCEPTANCE |
