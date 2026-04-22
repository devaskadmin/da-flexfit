# FlexFit Database Schema

Current app version: **0.7.1-beta**

## Schema Change Log

### [0.7.1-beta] - 2026-04-22
- Added exercises ownership support via `exercises.CreatedByUserID`.
- Added `user_favorite_exercises` mapping table for per-user favorite exercises.
- Added authenticated exercise view support in backend for:
  - all exercises
  - current user's exercises
  - current user's favorite exercises
- Added schema migration script:
  - `backend/sql/exercises_schema.sql`

### [0.7.0-beta] - 2026-04-20
- Added relational workout scheduling model:
	- `workout_schedules`
	- `workout_schedule_groups`
	- `workout_schedule_exercises`
- Added performed session model:
	- `workout_log_sessions`
	- `workout_log_sets`
- Added workout log source-linkage columns to map performed entries back to schedule/session origins.

## Source of truth

The canonical schema and migrations are:

- [backend/sql/workout_schedule_schema.sql](backend/sql/workout_schedule_schema.sql)
- [backend/sql/exercises_schema.sql](backend/sql/exercises_schema.sql)

## Includes

- `workout_schedules`
- `workout_schedule_groups`
- `workout_schedule_exercises`
- `workout_log_sessions`
- `workout_log` linkage columns to schedule/session sources
- `workout_log_sets`
- `exercises.CreatedByUserID`
- `user_favorite_exercises`

## Notes

- Schedules are templates.
- Workout logs are performed history.
- One schedule can be used for many logged sessions.
