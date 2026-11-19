# WorkoutAtlas Database Relationships

## Repository-verified Mermaid relationship view

```mermaid
erDiagram
  USERS ||--o{ WORKOUT_SCHEDULES : owns
  WORKOUT_SCHEDULES ||--o{ WORKOUT_SCHEDULE_GROUPS : contains
  WORKOUT_SCHEDULES ||--o{ WORKOUT_SCHEDULE_EXERCISES : contains
  WORKOUT_SCHEDULE_GROUPS ||--o{ WORKOUT_SCHEDULE_EXERCISES : organizes
  EXERCISES ||--o{ WORKOUT_SCHEDULE_EXERCISES : may_populate
  USERS ||--o{ WORKOUT_LOG_SESSIONS : performs
  WORKOUT_SCHEDULES o|--o{ WORKOUT_LOG_SESSIONS : optional_source
  WORKOUT_LOG_SESSIONS ||--o{ WORKOUT_LOG : contains
  WORKOUT_LOG ||--o{ WORKOUT_LOG_SETS : details
  USERS ||--o{ USER_FAVORITE_EXERCISES : favorites
  EXERCISES ||--o{ USER_FAVORITE_EXERCISES : favorited
```

## Verification status

- Direct foreign keys for schedules/groups/exercises/sessions are declared in `backend/schema/workout_schedule_schema.sql`.
- The exercise favorite relationship is declared in `backend/schema/exercises_schema.sql`.
- Goal relationships are source-backed by the user-goals migration and schedule SQL.
- Live foreign-key metadata, constraint names, and environments are not live-verified for this task.
