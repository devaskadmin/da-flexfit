# FlexFit Database Schema

Current app version: **0.7 beta**

## Source of truth

The canonical schema and migration for workout scheduling and workout logging is:

- [backend/sql/workout_schedule_schema.sql](backend/sql/workout_schedule_schema.sql)

## Includes

- `workout_schedules`
- `workout_schedule_groups`
- `workout_schedule_exercises`
- `workout_log_sessions`
- `workout_log` linkage columns to schedule/session sources
- `workout_log_sets`

## Notes

- Schedules are templates.
- Workout logs are performed history.
- One schedule can be used for many logged sessions.
