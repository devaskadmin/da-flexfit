# WorkoutAtlas Database Schema Reference

**Status:** repository-derived, not live-database introspected.

Source verification: SQL and migration files plus backend queries. No production or live database was inspected for this documentation task.

## Core plan tables

### `workout_schedules`

Source: `backend/schema/workout_schedule_schema.sql` and workout migrations.

- Purpose: workout plan templates.
- Primary key: `id BIGINT UNSIGNED`.
- Owner: `user_id INT(11)` with FK to `users(id)`.
- Key fields: `title`, `description`, `workout_type`, `workout_plan_type`, `source_global_plan_id`, `visibility`, `status`, `schedule_mode`, cover metadata, export metadata.
- `settings_json` (`LONGTEXT`, nullable, `json_valid` check; defined in `backend/schema/workout_schedule_schema.sql`): since 0.85.313.a3 holds the Workout Builder day-to-week mapping under the `dayWeekAssignments` key (`{ "<lowercase day name>": "<week label>" }`). Other keys in the object are preserved on save. The backend reads and writes it only when the column exists (detected via `information_schema`); no migration or `ALTER` is issued. Written by `PUT /api/workout-planner`; returned as `planner.settings.dayWeekAssignments` by `GET /api/workout-planner` and `GET /api/workout-schedules/:id`. Global-plan save and clone paths do not write it.
- Live verification status (0.85.313.a3.1, 2026-11-21): **VERIFIED** by a user-run read-only query in phpMyAdmin: schema `stephenk_flexfit`, `workout_schedules.settings_json` exists, `DATA_TYPE` and `COLUMN_TYPE` `longtext`, `IS_NULLABLE` `YES`, `COLUMN_DEFAULT` `NULL`. The agent had no direct DB access. Other environments (for example production) were not checked. Indirect evidence only: the repository backups `WorkoutAtlas - Database Backups/0.76` and `0.83` (`stephenk_flexfit.sql`) both define `settings_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(...))` on `workout_schedules` (nullable `LONGTEXT`). A backup is not the live database. Read-only check to run in phpMyAdmin against the target schema: `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workout_schedules' AND COLUMN_NAME = 'settings_json';` (one row expected; zero rows means persistence stays a no-op). **First attempt (2026-11-21) was inconclusive:** it ran with `information_schema` selected, so `DATABASE()` returned `information_schema`. Use this instead, which does not depend on the selected database: `SELECT TABLE_SCHEMA, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_NAME = 'workout_schedules' AND COLUMN_NAME = 'settings_json';`
- Relationships: owner user, optional source global schedule, optional linked goal, schedule groups, schedule exercises.

### `workout_schedule_groups`

- Purpose: day/week/section grouping for plan schedules.
- Primary key: `id BIGINT UNSIGNED`.
- Parent: `workout_schedule_id` with FK to `workout_schedules(id)`.
- Fields: `label`, `group_type`, `sort_order`, `workout_log_display_order`.
- Since 0.85.313.a3.2 a plan holds both its day set (`day`/`any`/`section`) and its week set (`week`) regardless of the selected schedule mode. `PUT /api/workout-planner` syncs them in place (`backend/utils/workoutPlanGroups.js`): rows are matched by family and case-insensitive label, so IDs persist; new labels are inserted; removed labels are deleted; legacy duplicates within a synced set collapse. A set not sent by the client, or a set that is only the default placeholder (`Any Day`/`Week 1`) with no stored rows, is not written. `workout_log_display_order` is kept only when a custom order is already set. No schema change. Readers that count or list every group (`workout-log.js` day ordering, `dashboard.js` weekly target, plan list `group_count`) now see both sets.
- Since 0.85.313.a3.3 readers that count or list workout days follow `workout_schedules.schedule_mode`: day mode uses every `group_type` except `week`; legacy Week View (`schedule_mode = 'week'`) uses its `week` groups. Applied to Workout Log `GET`/`PUT /day-order`, dashboard `weeklyTarget`, and the global plan-list `day_count`/`group_count`. Shared in `backend/utils/workoutScheduleGroupFilter.js`. Not yet filtered: the add-exercise default group (`users.js`) and `workout-sessions.js` day lookups by id or label. No schema change.

### `workout_schedule_exercises`

- Purpose: exercises assigned to plans and plan groups.
- Primary key: `id BIGINT UNSIGNED`.
- Parent: `workout_schedule_id` and optional `workout_schedule_group_id`.
- Optional exercise: `exercise_id` references `exercises(ExerciseID)`.
- Target fields: sets, reps, weight, duration, distance, rest, notes.

## Session/history tables

### `workout_log_sessions`

- Purpose: performed workout sessions and lifecycle state.
- Primary key: `id BIGINT UNSIGNED`.
- Owner: `user_id` with FK to `users(id)`.
- Optional source: `source_workout_schedule_id`.
- Status verified in repository migration: enum includes `in_progress`, `paused`, `completed`, `ended`, `cancelled`.
- Date: `workout_date DATE`.

### `workout_log`

- Purpose: canonical performed exercise history rows.
- Source: legacy/base and migration definitions.
- Links: optional `workout_log_session_id`, `source_workout_schedule_id`, `source_workout_schedule_exercise_id`, and source schedule group label.

### `workout_log_sets`

- Purpose: detailed set values for performed history/sessions.
- Primary key: `id BIGINT UNSIGNED`.
- Parent: `workout_log_id` FK to `workout_log(WorkoutLogID)`.
- Fields: set number, reps, weight, duration, completed.

## Exercise tables

### `exercises`

- Purpose: system/custom/shared exercise library.
- Primary key/identity: repository SQL identifies `ExerciseID`.
- Ownership evidence: `CreatedByUserID`, `IsGlobalExercise` and ExerciseScope migration files.
- Exact live ExerciseScope columns must remain repository-source verified; do not claim live metadata beyond source evidence.

### `user_favorite_exercises`

- Purpose: per-user exercise favorites.
- Primary key: `id`.
- User and exercise identifiers; unique pair constraint.

## Goals, notifications, and users

- `user_goals` is created in `backend/migrations/core/20260813_user_goals.sql` and is referenced by workout schedules.
- Notification tables are defined in `backend/migrations/dashboard/20260527_notifications_schema.sql`.
- `users` is a core application table referenced across plans and sessions. Exact full column metadata is not live-verified in this documentation task.

## Live verification caveat

This document is maintainable repository evidence, not a live MySQL dump. Live column-nullability, indexes, constraints, and migrations require authorized database metadata verification.
