# WorkoutAtlas 0.85.99 - ExerciseScope Migration (Stage 1 Design)

## Scope

This document is design-only for Stage 1.

- No production migration is executed by this document.
- No trainer sharing UI changes are included.
- Deliverables here: architecture inventory, mapping strategy, diagnostics, assignments design, backend security matrix.

## 1) Architecture Inventory (Current State)

### 1.1 Exercises ownership and visibility columns

Current ownership and visibility model is implemented via:

- `exercises.CreatedByUserID`
- `exercises.IsGlobalExercise`
- `exercises.IsSystemExercise`

Primary schema/migration evidence:

- `backend/schema/exercises_schema.sql`
- `backend/migrations/security/20260527_exercise_ownership.sql`

### 1.2 Exercise media and compatibility fields

Exercise records also include media abstraction columns:

- `MediaProvider`
- `MediaPath`
- `PrimaryImage`
- Legacy compatibility: `ImageURL`, `ImageGallery`

Evidence:

- `backend/migrations/core/20260615_exercise_media_storage_columns.sql`
- `backend/api/excerises.js`

### 1.3 Runtime authorization and ownership behavior

Ownership and role checks currently run in API logic:

- `requireAuthUserId()` obtains authenticated user from session.
- `isAdminUser()` checks role/roleSlug.
- Create always assigns `CreatedByUserID` from session user id.
- Non-admin users cannot create global exercises.
- Global delete is admin-only; non-global delete requires owner match.

Evidence:

- `backend/api/excerises.js`

### 1.4 Read surfaces that depend on current model

Current read views and semantics:

- `/api/exercises?view=all|mine|favorites` with ownership/global filtering.
- `/api/exercises/my` plus `scope=admin-global` for admin-owned global rows.
- Favorites visibility still honors ownership/global constraints for non-admin users.

Evidence:

- `backend/api/excerises.js`

### 1.5 Write surfaces that depend on current model

- Create: `/api/save-exercises`
- Edit: `/api/get-exercise/:id`
- Delete: `/api/delete-exercise/:id`
- Favorite add/remove: `/api/exercises/:id/favorite`

Evidence:

- `backend/api/excerises.js`

### 1.6 Downstream dependency surfaces

Exercise usage dependencies currently include:

- `workout_schedule_exercises.exercise_id` -> FK to `exercises.ExerciseID`
- `workout_log.ExerciseID` usage in API checks for history references
- `user_favorite_exercises.exercise_id`

Evidence:

- `backend/schema/workout_schedule_schema.sql`
- `backend/schema/exercises_schema.sql`
- `backend/api/excerises.js`

## 2) Observed Gaps and Ambiguities

### 2.1 No ExerciseScope column yet

`ExerciseScope` does not exist in current schema.

### 2.2 Trainer-client assignment relationship is not formalized in scanned canonical schema

No canonical trainer-client mapping table was found in:

- `backend/schema/*.sql`
- `backend/migrations/**/*.sql` (non-archive migration paths)

This affects the final FK target for ExerciseAssignments.

### 2.3 Favorites table FK mismatch across bootstrap paths

- `backend/schema/exercises_schema.sql` creates `user_favorite_exercises` with FK to exercises.
- `ensureExerciseSchema()` in `backend/api/excerises.js` creates the table without FK (runtime compatibility path).

Stage 2 should decide whether to normalize this.

## 3) Stage 1 Target Data Model (Design)

### 3.1 New columns on exercises

Proposed additions:

- `ExerciseScope ENUM('SYSTEM','TRAINER_SHARED','PRIVATE') NULL` (Stage 1 starts nullable for safe backfill + diagnostics)
- `OwnerTrainerID BIGINT UNSIGNED NULL`
- `SourceExerciseID BIGINT UNSIGNED NULL`

Semantic intent:

- `SYSTEM`: seeded/platform exercise, immutable by non-admin.
- `TRAINER_SHARED`: trainer-owned template visible to assigned clients.
- `PRIVATE`: private to owner.

Notes:

- `OwnerTrainerID` is the exercise owner account id. Name retained to match scope model, but value is still a user id from `users.id`.
- `SourceExerciseID` tracks clone lineage (for future copy/adopt workflows).

### 3.2 Proposed constraints (after cleanup)

- CHECK-like policy in app + migration validation:
  - `ExerciseScope = 'SYSTEM'` -> `OwnerTrainerID` may be NULL.
  - `ExerciseScope IN ('TRAINER_SHARED','PRIVATE')` -> `OwnerTrainerID` required.
- FK proposal:
  - `OwnerTrainerID -> users.id` (ON DELETE SET NULL)
  - `SourceExerciseID -> exercises.ExerciseID` (ON DELETE SET NULL)

## 4) IsGlobalExercise -> ExerciseScope Mapping Strategy

Stage 1 should be two-pass: classify then diagnose.

### 4.1 Deterministic mapping rules

1. If `IsSystemExercise = 1` -> `ExerciseScope = 'SYSTEM'`
2. Else if `IsGlobalExercise = 0` -> `ExerciseScope = 'PRIVATE'`
3. Else if `IsGlobalExercise = 1 AND CreatedByUserID IS NOT NULL` -> candidate `TRAINER_SHARED`
4. Else if `IsGlobalExercise = 1 AND CreatedByUserID IS NULL` -> candidate `SYSTEM`

### 4.2 Ambiguous cases that must be reviewed

- Global rows created by admin users where business intent may be platform-level or trainer-shared.
- Any row with conflicting flags (for example, `IsSystemExercise = 1` with owner set).
- Rows where owner role is not trainer/admin but global flag is set.

These are explicitly surfaced by diagnostic SQL in this stage.

## 5) ExerciseAssignments Design (Stage 1)

Because no canonical trainer-client table was confirmed in active schema files, Stage 1 should use a user-centric assignment table that can later bind to trainer-client constraints.

### 5.1 Proposed table

`exercise_assignments`

- `id BIGINT UNSIGNED PK AUTO_INCREMENT`
- `exercise_id BIGINT UNSIGNED NOT NULL`
- `trainer_user_id BIGINT UNSIGNED NOT NULL`
- `client_user_id BIGINT UNSIGNED NOT NULL`
- `assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `assigned_by_user_id BIGINT UNSIGNED NULL`
- `revoked_at TIMESTAMP NULL`
- `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`

Indexes/uniqueness:

- `UNIQUE (exercise_id, trainer_user_id, client_user_id, revoked_at)` is not safe in MySQL due to NULL handling.
- Preferred active uniqueness pattern:
  - Add generated `is_active` column or enforce in service layer.
- Minimum indexes:
  - `(exercise_id)`
  - `(trainer_user_id)`
  - `(client_user_id)`
  - `(client_user_id, revoked_at)`

FKs:

- `exercise_id -> exercises.ExerciseID` (ON DELETE CASCADE)
- `trainer_user_id -> users.id` (ON DELETE CASCADE)
- `client_user_id -> users.id` (ON DELETE CASCADE)
- `assigned_by_user_id -> users.id` (ON DELETE SET NULL)

### 5.2 Required service-layer policy until trainer-client table is formalized

On assignment create/update:

- Trainer role validation for `trainer_user_id`.
- Non-trainer assignees blocked.
- Optional admin override path.
- Prevent self-assignment where not intended.

## 6) Backend Security Matrix (Required for Scope Operations)

Create:

- Admin:
  - can create `SYSTEM`, `TRAINER_SHARED`, `PRIVATE`
- Trainer:
  - can create `TRAINER_SHARED`, `PRIVATE`
- Member:
  - can create `PRIVATE` only

Read:

- `SYSTEM`: all authenticated users
- `TRAINER_SHARED`:
  - owner trainer
  - assigned clients
  - admin
- `PRIVATE`:
  - owner only
  - admin optional override (recommended yes for support)

Update:

- `SYSTEM`: admin only
- `TRAINER_SHARED`: owner trainer or admin
- `PRIVATE`: owner or admin

Delete:

- `SYSTEM`: admin only
- `TRAINER_SHARED`: owner trainer or admin (subject to history reference protections)
- `PRIVATE`: owner or admin (subject to history reference protections)

Scope transitions:

- `PRIVATE -> TRAINER_SHARED`: owner trainer/admin only
- `TRAINER_SHARED -> PRIVATE`: owner trainer/admin only
- Any `* -> SYSTEM`: admin only
- `SYSTEM -> *`: admin only and must pass policy checks

## 7) Stage 1 Execution Plan (No Production Execution Yet)

1. Run diagnostics only (`SELECT`-only script).
2. Review ambiguity reports with product/security owners.
3. Lock final mapping policy for admin-created globals.
4. Confirm canonical trainer-client relationship table (or approve interim user-centric assignments).
5. Author Stage 2 DDL + data backfill migration with explicit rollback notes.

## 8) Stage 1 Artifact References

- Diagnostics script:
  - `backend/migrations/security/20261017_exercise_scope_stage1_diagnostics.sql`
