-- WorkoutAtlas 0.85.131A rollback
-- Manual execution target: hosting.com/phpMyAdmin (production).
-- Safety guard: this rollback is blocked if any new 0.85.131A types are in use.

START TRANSACTION;

SET @unsupported_count := (
  SELECT COUNT(*)
  FROM workout_schedules
  WHERE workout_plan_type IN ('global', 'personal', 'trainer_shared', 'community', 'marketplace')
);

SET @rollback_sql := IF(
  @unsupported_count = 0,
  "ALTER TABLE workout_schedules MODIFY COLUMN workout_plan_type ENUM('featured','community_shared') NULL DEFAULT NULL",
  "SELECT 'ROLLBACK_BLOCKED: New workout_plan_type values exist. Migrate or clear those rows before rollback.' AS error_message"
);

PREPARE stmt FROM @rollback_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
