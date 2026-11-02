# WorkoutAtlas 0.85.124 - ExerciseScope 2.0 Migration Package

## A. Pre-migration backup checklist

- Confirm a fresh logical backup of the current database exists and can be restored.
- Capture row counts for `exercises`, `user_favorite_exercises`, `workout_log`, `workout_log_sessions`, `workout_log_sets`, `workout_schedules`, `workout_schedule_groups`, and `workout_schedule_exercises`.
- Export the current `exercises` table definition and foreign-key map.
- Preserve the current media bucket / filesystem snapshot for exercise images.
- Record the current application version, schema version, and migration runner state.
- Verify no admin maintenance or account-deletion jobs are running.

## B. Read-only diagnostic SQL

- `backend/migrations/security/20261017_exercise_scope_stage1_diagnostics.sql`

Purpose:
- Inventory current `ExerciseScope`, `IsGlobalExercise`, `IsSystemExercise`, `CreatedByUserID`, and `SourceExerciseID` data.
- Report ambiguity cases that need manual review.
- Quantify favorites, schedule links, and workout-log references so nothing is accidentally orphaned.

## C. Forward migration SQL

- `backend/migrations/security/20261017_exercise_scope_stage2_forward.sql`

Planned changes:
- Add `ExercisePublicationState` to separate discoverability from ownership.
- Expand `ExerciseScope` to accept `SHARED` and `CUSTOM` while keeping legacy values.
- Backfill existing rows so legacy `PRIVATE` exercises remain restricted and existing `SYSTEM` / `TRAINER_SHARED` rows remain discoverable.
- Add an index for publication-state filtering.

## D. Post-migration validation SQL

- `backend/migrations/security/20261017_exercise_scope_stage3_validation.sql`

Validation goals:
- Confirm the new column exists and is populated.
- Confirm the `ExerciseScope` enum still contains legacy values and the new `SHARED` / `CUSTOM` values.
- Confirm legacy private rows are still restricted.
- Confirm workout-history reference counts still match the pre-migration baseline.

## E. Rollback SQL

- `backend/migrations/security/20261017_exercise_scope_stage4_rollback.sql`

Rollback behavior:
- Drop the new publication-state column and its index.
- Restore the original `ExerciseScope` enum if no rows have been converted to `SHARED` / `CUSTOM` yet.
- If any data has already been rewritten to the new model, restore from backup instead of relying on rollback SQL alone.

## F. Affected backend and frontend files

- `backend/api/excerises.js`
- `frontend/src/views/Member/exercises.vue`
- `frontend/src/composable/exerciseFilters.js`
- `backend/scripts/schema_verify.js`
- `backend/tests/exercise-storage-marker.test.js`

Expected compatibility work in the next implementation stage:
- Treat `SYSTEM`, `SHARED`, and `CUSTOM` as distinct scopes in backend authorization.
- Keep legacy `TRAINER_SHARED` support until all existing data and callers are migrated.
- Use publication state to distinguish legacy restricted records from discoverable custom content.
- Update client-side labels and filters without changing current routes or endpoints.

## G. Staged implementation order

1. Apply the forward schema prep and keep the app running against the dual-compatibility schema.
2. Update backend scope normalization and authorization logic.
3. Update the exercise create/edit UI to expose the new scope and publication semantics.
4. Add copy-operation handling for CUSTOM exercises.
5. Add final validation for search, copy, favorites, workout plans, and workout-log references.

## H. Risks and unresolved dependencies

- Legacy `PRIVATE` records must stay restricted until a user explicitly publishes them.
- `SourceExerciseID` already exists, but copy deduplication still needs application logic.
- Workout-log and schedule references mean deletes still need guardrails until a separate archive strategy is approved.
- Account-deletion behavior is intentionally unchanged in this stage.
- No automatic SQL execution is included here; hosting.com/phpMyAdmin execution still requires approval.

## Manual execution order

1. `backend/migrations/security/20261017_exercise_scope_stage1_diagnostics.sql`
2. `backend/migrations/security/20261017_exercise_scope_stage2_forward.sql`
3. `backend/migrations/security/20261017_exercise_scope_stage3_validation.sql`
4. `backend/migrations/security/20261017_exercise_scope_stage4_rollback.sql` only if rollback is needed

## Expected phpMyAdmin output

- Diagnostics: only result sets, no schema changes.
- Forward: `Query OK` for the DDL statements and backfill updates.
- Validation: only result sets, no schema changes.
- Rollback: `Query OK` for the DDL reversions if executed before any new-model data is written.
