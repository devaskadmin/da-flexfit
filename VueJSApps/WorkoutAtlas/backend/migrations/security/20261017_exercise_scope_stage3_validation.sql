-- WorkoutAtlas 0.85.124
-- ExerciseScope 2.0 - Stage 3 validation
--
-- Read-only checks only.

SELECT
  c.TABLE_NAME,
  c.COLUMN_NAME,
  c.COLUMN_TYPE,
  c.IS_NULLABLE,
  c.COLUMN_DEFAULT
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.TABLE_NAME = 'exercises'
  AND c.COLUMN_NAME IN (
    'ExerciseID',
    'CreatedByUserID',
    'IsGlobalExercise',
    'IsSystemExercise',
    'ExerciseScope',
    'ExercisePublicationState',
    'OwnerTrainerID',
    'SourceExerciseID',
    'ExerciseTitle'
  )
ORDER BY c.ORDINAL_POSITION;

SELECT
  COUNT(*) AS total_exercises,
  SUM(CASE WHEN COALESCE(IsSystemExercise, 0) = 1 THEN 1 ELSE 0 END) AS system_rows,
  SUM(CASE WHEN ExerciseScope = 'SHARED' THEN 1 ELSE 0 END) AS shared_rows,
  SUM(CASE WHEN ExerciseScope = 'CUSTOM' THEN 1 ELSE 0 END) AS custom_rows,
  SUM(CASE WHEN ExerciseScope = 'TRAINER_SHARED' THEN 1 ELSE 0 END) AS legacy_trainer_shared_rows,
  SUM(CASE WHEN ExerciseScope = 'PRIVATE' THEN 1 ELSE 0 END) AS legacy_private_rows,
  SUM(CASE WHEN ExercisePublicationState = 'DISCOVERABLE' THEN 1 ELSE 0 END) AS discoverable_rows,
  SUM(CASE WHEN ExercisePublicationState = 'RESTRICTED' THEN 1 ELSE 0 END) AS restricted_rows
FROM exercises;

SELECT
  ExerciseScope,
  ExercisePublicationState,
  COUNT(*) AS row_count
FROM exercises
GROUP BY ExerciseScope, ExercisePublicationState
ORDER BY ExerciseScope, ExercisePublicationState;

SELECT
  COUNT(*) AS workout_log_links
FROM workout_log
WHERE ExerciseID IS NOT NULL;

SELECT
  COUNT(*) AS schedule_links
FROM workout_schedule_exercises
WHERE exercise_id IS NOT NULL;

SELECT
  COUNT(*) AS favorite_links
FROM user_favorite_exercises;

SELECT
  COUNT(*) AS orphaned_workout_log_rows
FROM workout_log wl
LEFT JOIN exercises e ON e.ExerciseID = wl.ExerciseID
WHERE wl.ExerciseID IS NOT NULL
  AND e.ExerciseID IS NULL;
