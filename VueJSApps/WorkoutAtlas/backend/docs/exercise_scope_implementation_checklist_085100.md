# WorkoutAtlas 0.85.100 - ExerciseScope Migration Implementation Checklist

Status: Planning only. No app code or SQL has been executed.

## Guardrails (Must Hold Throughout)

1. Preserve all existing ExerciseIDs.
2. Do not change S3/object media paths under APP/exercise-library/{ExerciseID}/images.
3. Do not delete/recreate exercises for migration.
4. Do not auto-classify ambiguous legacy rows as SYSTEM.
5. Fail closed: unknown scope/ownership must never broaden access.
6. Preserve workout history and planner foreign key relationships.
7. Exclude generated dist files from manual edits; regenerate via build only.

## 1) Database Checklist

1. File: backend/schema/exercises_schema.sql:11
Current dependency: IsGlobalExercise column + visibility index.
Replacement: add ExerciseScope ENUM('SYSTEM','TRAINER_SHARED','PRIVATE') nullable (transitional), OwnerTrainerID BIGINT UNSIGNED NULL, SourceExerciseID BIGINT UNSIGNED NULL.
Authorization change: none in schema file; enforcement in API.
Required testing: schema bootstrap on empty DB, verify columns + indexes + no ExerciseID changes.

2. File: backend/schema/exercises_schema.sql:13
Current dependency: idx_exercises_global_visibility (IsGlobalExercise, CreatedByUserID).
Replacement: add indexes for scope-aware reads:
- idx_exercises_scope_owner (ExerciseScope, OwnerTrainerID)
- idx_exercises_owner_scope (OwnerTrainerID, ExerciseScope)
- idx_exercises_source (SourceExerciseID)
Keep legacy index during transition.
Authorization change: none.
Required testing: EXPLAIN plans for read/list endpoints.

3. File: backend/migrations/security/20260527_exercise_ownership.sql:50
Current dependency: migration introduces IsGlobalExercise.
Replacement: add a new migration (do not edit historical migration semantics) that introduces ExerciseScope/OwnerTrainerID/SourceExerciseID and performs controlled backfill preview + guarded update logic.
Authorization change: none in SQL; API must enforce after deploy.
Required testing: migration dry-run in staging, rollback script verified.

4. File: backend/migrations/core/20260615_exercise_media_storage_columns.sql:8
Current dependency: MediaProvider added AFTER IsGlobalExercise.
Replacement: remove positional dependency on IsGlobalExercise in future migration scripts; place AFTER a stable column (for example CreatedByUserID or PrimaryImage sequence via explicit order policy).
Authorization change: none.
Required testing: migration succeeds whether IsGlobalExercise remains or is later dropped.

5. File: backend/migrations/security/20261017_exercise_scope_stage1_diagnostics.sql:53
Current dependency: candidate mapping and ambiguity reporting around IsGlobalExercise.
Replacement: keep this diagnostic workflow as pre-cutover gate; expand with unresolved row counts and stop deployment if unresolved ambiguity > 0.
Authorization change: none.
Required testing: diagnostics output reviewed/approved before any destructive schema step.

6. New DDL requirement (create in new migration file, not executed yet)
Current dependency: no trainer-client validated sharing table exists in canonical active schema.
Replacement: introduce exercise_assignments with active/inactive assignment lifecycle and FKs to exercises/users only after relationship validation step passes.
Authorization change: service-layer checks required until validated trainer-client linkage source is configured.
Required testing: FK integrity and active assignment uniqueness behavior.

7. File: backend/scripts/schema_verify.js:42
Current dependency: verifies exercises.IsGlobalExercise.
Replacement: verify ExerciseScope, OwnerTrainerID, SourceExerciseID in addition to IsGlobalExercise during transition; eventually retire IsGlobalExercise check only after full cutover.
Authorization change: none.
Required testing: schema verify passes in mixed-compat window and post-cutover mode.

## 2) Backend API Checklist

1. File: backend/api/excerises.js:47
Current dependency: normalizeExerciseCreatePayload sets IsGlobalExercise/CreateAsGlobalExercise.
Replacement logic:
- parse requested ExerciseScope
- default PRIVATE for non-admin/non-trainer
- set OwnerTrainerID = session user id for PRIVATE/TRAINER_SHARED
- SYSTEM only admin allowed
- keep legacy IsGlobalExercise write for transition mirror
Authorization change:
- Admin: SYSTEM/TRAINER_SHARED/PRIVATE
- Trainer: TRAINER_SHARED/PRIVATE
- Member: PRIVATE only
Required testing: unit tests for role-to-scope create matrix and fail-closed unknown scope.

2. File: backend/api/excerises.js:645
Current dependency: fetchExercisesForView uses COALESCE(IsGlobalExercise,1)=1 OR owner.
Replacement query design:
- Admin visibility: all scopes.
- Non-admin visibility:
  - SYSTEM always visible
  - PRIVATE visible only to owner
  - TRAINER_SHARED visible to owner trainer and assigned clients (active assignment only)
- Transitional compatibility WHERE:
  - prefer ExerciseScope when non-null
  - fallback to legacy IsGlobalExercise mapping only when ExerciseScope is null
Authorization change: explicit scope-based visibility.
Required testing: endpoint contract tests by role and assignment state.

3. File: backend/api/excerises.js:705
Current dependency: paginated endpoint inherits global/owner logic.
Replacement: apply same scope-aware visibility in paginated count and rows queries to keep pagination totals consistent.
Authorization change: identical to list view.
Required testing: page totals and item sets match unpaginated endpoint for same filters.

4. File: backend/api/excerises.js:842
Current dependency: update path toggles IsGlobalExercise for admin.
Replacement: allow ExerciseScope transitions only via transition matrix; keep IsGlobalExercise mirror update in transition period.
Authorization change: transition-specific permission checks.
Required testing: transition authorization matrix tests and invariants (owner required for PRIVATE/TRAINER_SHARED).

5. File: backend/api/excerises.js:1046
Current dependency: create endpoint enforces admin-only global.
Replacement: enforce scope-based create policy; store OwnerTrainerID and SourceExerciseID as needed.
Authorization change: role-based scope create matrix.
Required testing: API create integration tests for admin/trainer/member.

6. File: backend/api/excerises.js:1250
Current dependency: /exercises/my supports scope=admin-global filtering on IsGlobalExercise.
Replacement: preserve Admin My Global Exercises by mapping to SYSTEM owned by current admin during transition:
- scope=admin-global (legacy alias)
- resolved as ExerciseScope='SYSTEM' and owner=currentUser (or legacy fallback when scope null)
Authorization change: admin-only remains.
Required testing: UI toggle still returns expected rows; non-admin still 403.

7. File: backend/api/excerises.js:1357
Current dependency: delete policy uses IsGlobalExercise and IsSystemExercise.
Replacement: delete policy by ExerciseScope:
- SYSTEM: admin only
- TRAINER_SHARED: owner trainer or admin
- PRIVATE: owner or admin
Keep history-reference block unchanged.
Authorization change: scope-based delete permissions.
Required testing: delete attempts across all scopes + history-linked rows.

8. File: backend/api/media.js:33
Current dependency: media endpoint resolves by ExerciseID only, no scope visibility check.
Replacement: before streaming image, enforce exercise read visibility using same scope-access predicate used by exercises list endpoints.
Authorization change: private/trainer_shared images must not leak to unauthorized users.
Required testing: access-denied cases for private and trainer_shared images.

9. File: backend/services/mediaResolver.js:519
Current dependency: ensureExerciseMediaColumns uses AFTER IsGlobalExercise.
Replacement: remove strict dependency on IsGlobalExercise position; preserve media paths and primary image behavior.
Authorization change: none.
Required testing: migration/bootstrap still creates media columns without touching media keys.

## 3) Frontend Checklist

1. File: frontend/src/views/Member/exercises.vue:514
Current dependency: admin-global toggle query parameter + global/custom view labels.
Replacement:
- retain toggle UX and endpoint alias
- interpret as SYSTEM scope view for current admin
- add scope-aware labels where required
Authorization change: toggle remains admin-only.
Required testing: toggle states, row sets, and role gating.

2. File: frontend/src/views/Member/exercises.vue:860
Current dependency: edit form derives CreateAsGlobalExercise from IsGlobalExercise.
Replacement: edit form binds to ExerciseScope selector/toggle model (SYSTEM/TRAINER_SHARED/PRIVATE) with role-based disable rules.
Authorization change: members cannot select SYSTEM/TRAINER_SHARED unless policy allows.
Required testing: edit modal role behavior and saved payload shape.

3. File: frontend/src/views/Member/exercises.vue:1082
Current dependency: create flow uses CreateAsGlobalExercise boolean.
Replacement: create flow sends ExerciseScope (and optional share intent metadata), not a single global flag.
Authorization change: UI options constrained by role.
Required testing: payload and success/error handling for each role.

4. File: frontend/src/views/Member/exercises.vue:1404
Current dependency: delete success copy and confirmation branch on IsGlobalExercise.
Replacement: branch copy on ExerciseScope and ownership semantics.
Authorization change: none client-side beyond hidden/disabled actions.
Required testing: delete dialogs for SYSTEM/TRAINER_SHARED/PRIVATE.

5. File: frontend/src/views/Member/exercises.vue:2411
Current dependency: ownership filter includes global option.
Replacement: filter model should be scope-aware:
- all, mine/private, trainer_shared, system
Keep legacy global label mapped to SYSTEM during transition if needed.
Authorization change: trainer_shared filter results scoped to assignment/ownership.
Required testing: filter chips/options and result counts.

6. File: frontend/src/composable/exerciseFilters.js:5
Current dependency: client-side ownership filter uses IsGlobalExercise and IsOwnedByCurrentUser.
Replacement: filter by ExerciseScope and IsOwnedByCurrentUser; keep fallback mapping for rows that still only include IsGlobalExercise during transition.
Authorization change: none.
Required testing: pure unit tests for filter permutations.

7. File: frontend/src/components/workout-builder/ExercisePickerModal.vue:67
Current dependency: mine/favorites uses IsOwnedByCurrentUser, no explicit scope handling.
Replacement: ensure picker receives and respects backend visibility decisions; optional scope chip rendering for user clarity.
Authorization change: none if backend already filtered.
Required testing: picker contents unchanged for permitted users, no unauthorized leaks.

8. File: frontend/src/views/Member/UserSettings.vue:301
Current dependency: fetches /api/exercises?view=all for goal exercise pickers.
Replacement: confirm endpoint returns only scope-visible exercises for user; no UI broadening.
Authorization change: none client-side.
Required testing: user goals can still select previously visible exercises only.

9. Dist policy
Files: frontend/dist/assets/*.js, frontend/dist/assets/*.css
Action: no manual edits. Rebuild artifacts after source changes only.

## 4) Authorization and Transition Rules Checklist

1. Safe transition matrix (server-enforced)
- PRIVATE -> TRAINER_SHARED: trainer owner or admin
- TRAINER_SHARED -> PRIVATE: trainer owner or admin
- PRIVATE -> SYSTEM: admin only
- TRAINER_SHARED -> SYSTEM: admin only
- SYSTEM -> TRAINER_SHARED: admin only
- SYSTEM -> PRIVATE: admin only
- SYSTEM -> SYSTEM: admin update only

2. Required ownership invariants
- PRIVATE and TRAINER_SHARED require OwnerTrainerID.
- SYSTEM may have OwnerTrainerID null or admin owner depending on policy; unresolved rows remain transitional and not auto-broadened.
- Unknown/null ExerciseScope rows are treated with legacy-compatible but restrictive fallback and never broader than current behavior.

3. Transitional compatibility approach
- Keep IsGlobalExercise temporarily.
- Dual-write strategy in API:
  - when ExerciseScope changes, mirror IsGlobalExercise:
    - SYSTEM/TRAINER_SHARED -> 1
    - PRIVATE -> 0
- Dual-read strategy in API:
  - if ExerciseScope is not null, use it
  - else fallback to legacy IsGlobalExercise mapping
- Cutover criteria before dropping legacy column:
  - all rows have non-null ExerciseScope
  - all endpoints/tests pass in scope-only mode
  - diagnostics show zero ambiguous rows pending manual decision

4. Trainer-client relationship validation (do not assume existing table)
- Add a pre-implementation validation gate to identify canonical relationship source (table/view/service) in current environment.
- If no validated relationship source exists, do not enable TRAINER_SHARED client visibility in production.
- In that case, restrict TRAINER_SHARED visibility to owner trainer and admin only until relationship source is approved and integrated.

## 5) Planner and History Compatibility Checklist

1. File: backend/api/users.js:1003
Current dependency: planner joins workout_schedule_exercises.exercise_id to exercises.ExerciseID.
Migration requirement: preserve ExerciseIDs and existing joins untouched.
Required testing: existing plans load with same exercises before/after scope migration.

2. File: backend/api/users.js:1174
Current dependency: schedule exercise hydration via LEFT JOIN exercises.
Migration requirement: no ExerciseID remap; unresolved scope must not break historical plan reads.
Required testing: schedule details and edit flows preserve references.

3. File: backend/api/workout-log.js:215
Current dependency: workout log history joins exercises by ExerciseID.
Migration requirement: history reads remain ExerciseID-based and unaffected by scope migration.
Required testing: user history list and latest-history endpoints unchanged.

4. File: backend/api/workout-sessions.js:258
Current dependency: workout session paths resolve exercises by ExerciseID when adding scheduled exercises.
Migration requirement: keep ExerciseID stable; scope affects visibility/selection only, not historical linkage.
Required testing: complete/end session and replay workflows.

5. File: backend/api/progress.js:309
Current dependency: progress queries join logs to exercises for display metadata.
Migration requirement: continue resolving existing ExerciseIDs, including those from legacy/global sources.
Required testing: progress charts and per-exercise filters still resolve titles.

6. File: backend/api/dashboard.js:104
Current dependency: dashboard joins workout_log to exercises.
Migration requirement: preserve ExerciseID joins and no regression in aggregates.
Required testing: dashboard metric parity pre/post.

## 6) Tests Checklist

1. File: backend/tests/exercise-storage-marker.test.js:227
Current dependency: asserts IsGlobalExercise normalization.
Replacement: add ExerciseScope assertions alongside legacy assertions during transition; later remove legacy assertions after cutover.
Authorization change: include role-based scope tests.
Required testing: pass in dual-read/dual-write mode.

2. New backend tests to add
- Scope visibility matrix tests for /api/exercises and /api/exercises paginated.
- Scope transition authorization tests for update endpoint.
- Media endpoint scope access tests.
- Admin My Global Exercises compatibility test for scope=admin-global alias.
- Unknown/null scope fail-closed behavior tests.

3. Existing regression suites to rerun
- Exercise create/edit/delete/favorites.
- Workout planner CRUD and schedule exercise references.
- Workout history, progress stats, dashboard metrics.

## 7) Replacement Visibility Query Design

1. Canonical read predicate (non-admin)
- visible when any condition is true:
  - ExerciseScope = SYSTEM
  - ExerciseScope = PRIVATE and OwnerTrainerID = currentUserId
  - ExerciseScope = TRAINER_SHARED and (
      OwnerTrainerID = currentUserId
      OR active trainer-client assignment exists for currentUserId
    )

2. Transitional fallback for rows with ExerciseScope NULL
- map from legacy IsGlobalExercise without broadening access:
  - IsGlobalExercise = 0 -> treat as PRIVATE(owner=CreatedByUserID)
  - IsGlobalExercise = 1 and owner present -> treat as TRAINER_SHARED candidate, but client visibility only if validated relationship exists; otherwise owner/admin only
  - IsGlobalExercise = 1 and owner null -> do not auto-escalate to SYSTEM; expose only to admin until manually classified

3. Pagination consistency rule
- identical WHERE predicate for count query and page rows query.

## 8) Recommended Order and Verification Stopping Points

1. Stage A - finalize query and authorization specs
Stop point A verification:
- transition matrix approved
- fallback rules approved
- trainer-client validation plan approved

2. Stage B - prepare DB migration scripts and schema verifier updates (not executed in production)
Stop point B verification:
- migration scripts peer-reviewed
- schema_verify expectations updated for dual mode
- diagnostics script reports reviewed

3. Stage C - backend dual-read/dual-write implementation
Stop point C verification:
- API tests green for create/read/update/delete/favorites/pagination
- no visibility broadening in unknown/null scope cases

4. Stage D - frontend scope model migration
Stop point D verification:
- exercises view parity (including My Global Exercises)
- filters/pagination parity
- no dist manual edits

5. Stage E - planner/history/progress/dashboard regressions
Stop point E verification:
- ExerciseID-linked workflows unchanged
- history and plan references preserved

6. Stage F - staged cutover decision
Stop point F verification:
- zero unresolved ambiguous rows
- all rows have ExerciseScope
- approval to retire IsGlobalExercise read/write paths

7. Stage G - legacy cleanup
Stop point G verification:
- remove IsGlobalExercise dependencies
- regenerate dist artifacts via build
- final production rollout approval

## 9) Explicit Exclusions for This Step

1. No application code edits.
2. No SQL execution.
3. No production migration run.
4. No manual changes inside frontend/dist artifacts.
