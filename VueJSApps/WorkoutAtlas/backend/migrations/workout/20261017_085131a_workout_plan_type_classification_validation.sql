-- WorkoutAtlas 0.85.131A validation
-- Run after forward migration.

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'workout_schedules'
  AND COLUMN_NAME = 'workout_plan_type';

SELECT workout_plan_type, COUNT(*) AS total
FROM workout_schedules
GROUP BY workout_plan_type
ORDER BY total DESC, workout_plan_type ASC;

SELECT
  SUM(CASE WHEN workout_plan_type = 'global' THEN 1 ELSE 0 END) AS global_rows,
  SUM(CASE WHEN workout_plan_type = 'personal' THEN 1 ELSE 0 END) AS personal_rows,
  SUM(CASE WHEN workout_plan_type = 'trainer_shared' THEN 1 ELSE 0 END) AS trainer_shared_rows,
  SUM(CASE WHEN workout_plan_type = 'community' THEN 1 ELSE 0 END) AS community_rows,
  SUM(CASE WHEN workout_plan_type = 'marketplace' THEN 1 ELSE 0 END) AS marketplace_rows,
  SUM(CASE WHEN workout_plan_type = 'featured' THEN 1 ELSE 0 END) AS legacy_featured_rows,
  SUM(CASE WHEN workout_plan_type = 'community_shared' THEN 1 ELSE 0 END) AS legacy_community_shared_rows,
  SUM(CASE WHEN workout_plan_type IS NULL THEN 1 ELSE 0 END) AS null_type_rows
FROM workout_schedules;

SHOW INDEX FROM workout_schedules WHERE Key_name = 'idx_workout_schedules_plan_type';
