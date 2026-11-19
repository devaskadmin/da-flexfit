# WorkoutAtlas Data Dictionary

This dictionary uses repository-verified names and labels. LIVE-VERIFIED = not established for full live schema metadata.

| Domain | Name | Meaning | Source |
|---|---|---|---|
| User | `users.id` | Core application user identifier | Referenced by SQL/migrations |
| Plan | `workout_schedules.id` | Unique plan/template identifier | workout_schedule_schema.sql |
| Plan status | `draft`, `active`, `archived` | Planned publication lifecycle | workout schedule SQL |
| Plan type | `featured`, `community_shared`, `global`, `personal`, `trainer_shared`, `community`, `marketplace` | Plan classification or legacy compatibility | workout schedule SQL and migrations |
| Visibility | `private`, `unlisted`, `public` | Public discovery visibility | workout schedule SQL |
| Plan source | `source_global_plan_id` | Copied/adopted source template reference | workout_schedule_schema.sql |
| Exercise | `exercises.ExerciseID` | Exercise library primary identifier | exercises schema/queries |
| Exercise owner | `exercises.CreatedByUserID` | Custom exercise creator identity | exercises schema/migrations |
| Exercise scope | Repository migration/model evidence | Custom, shared, system scope ordering | ExerciseScope migration/package and backend tests |
| Session status | `in_progress`, `paused`, `completed`, `ended`, `cancelled` | Workout session lifecycle | paused migration and backend policy |
| Session date | `workout_log_sessions.workout_date` | Date-only performed workout date | workout_schedule_schema.sql |
| History | `workout_log.WorkoutLogID` | Legacy canonical performed exercise record identifier | workout schedule/migrations |
| Set number | `workout_log_sets.set_number` | Position of a performed set | workout_schedule_schema.sql |

Protected identifier: PlanID 5 — Stephen K – Lean Muscle — must not be modified by documentation or testing work.
