# WorkoutAtlas — Migration and Schema Registry

**Status:** repository-derived compatibility registry; live schema state is not verified.

The previous static schema-version label is not sufficient evidence of deployed database state. Use migration artifacts and the canonical [database schema reference](../../docs/database/SCHEMA.md) for repository-based review.

## Recent repository evidence

- Workout session status paused migration: `workout/20261117_workout_session_status_paused.sql`
- Workout plan cover columns: `workout/20261030_085167b_workout_plan_cover_columns_forward.sql`
- Workout plan type classification: `workout/20261017_085131a_workout_plan_type_classification_forward.sql`
- ExerciseScope staged migration package: `security/20261017_exercise_scope_stage1_diagnostics.sql` through `stage4_rollback.sql`

## Migration folders

- `core/` — users, external authentication, goals
- `workout/` — plans, sessions, history, planner ordering
- `security/` — ownership, RBAC, ExerciseScope
- `dashboard/` — metrics, notifications, progress
- `nutrition/` — future nutrition migrations
- `ai/` — future AI migrations
- `archive/` — deprecated or historical scripts

No live database introspection or migration execution was performed for documentation work.
