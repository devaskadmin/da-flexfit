-- WorkoutAtlas 0.85.131A
-- Extend workout plan classifications without rewriting historic records.
-- Manual execution target: hosting.com/phpMyAdmin (production).

START TRANSACTION;

ALTER TABLE workout_schedules
  MODIFY COLUMN workout_plan_type ENUM(
    'featured',
    'community_shared',
    'global',
    'personal',
    'trainer_shared',
    'community',
    'marketplace'
  ) NULL DEFAULT NULL;

-- Keep or add index used by global/personal partition queries.
SET @has_plan_type_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'workout_schedules'
    AND INDEX_NAME = 'idx_workout_schedules_plan_type'
);

SET @create_idx_sql := IF(
  @has_plan_type_index = 0,
  'CREATE INDEX idx_workout_schedules_plan_type ON workout_schedules (workout_plan_type)',
  'SELECT "idx_workout_schedules_plan_type already exists" AS info_message'
);

PREPARE stmt FROM @create_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
