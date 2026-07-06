-- FlexFit v0.82.40 - Guarded workout planner ordering columns migration
-- Adds missing ordering columns only when they do not already exist.

SET @db_name = DATABASE();

SET @has_use_custom := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'workout_schedules'
    AND column_name = 'use_custom_workout_log_order'
);

SET @has_log_display_order := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'workout_schedule_groups'
    AND column_name = 'workout_log_display_order'
);

SET @sql_use_custom := IF(
  @has_use_custom = 0,
  'ALTER TABLE workout_schedules ADD COLUMN use_custom_workout_log_order TINYINT(1) NOT NULL DEFAULT 0 AFTER schedule_mode',
  'SELECT ''use_custom_workout_log_order already exists'''
);

PREPARE stmt_use_custom FROM @sql_use_custom;
EXECUTE stmt_use_custom;
DEALLOCATE PREPARE stmt_use_custom;

SET @sql_log_display_order := IF(
  @has_log_display_order = 0,
  'ALTER TABLE workout_schedule_groups ADD COLUMN workout_log_display_order INT(11) NULL DEFAULT NULL AFTER sort_order',
  'SELECT ''workout_log_display_order already exists'''
);

PREPARE stmt_log_display_order FROM @sql_log_display_order;
EXECUTE stmt_log_display_order;
DEALLOCATE PREPARE stmt_log_display_order;
