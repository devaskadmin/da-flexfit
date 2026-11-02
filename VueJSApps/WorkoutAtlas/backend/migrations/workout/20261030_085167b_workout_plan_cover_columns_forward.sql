-- WorkoutAtlas 0.85.167-B
-- Add nullable workout plan cover metadata columns.
-- Safe for hosts that do not support ADD COLUMN IF NOT EXISTS.
-- Manual execution target: hosted phpMyAdmin / MySQL client.

START TRANSACTION;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'workout_schedules'
    AND COLUMN_NAME = 'cover_image_storage_key'
);

SET @sql_stmt := IF(
  @col_exists = 0,
  'ALTER TABLE workout_schedules ADD COLUMN cover_image_storage_key VARCHAR(512) NULL AFTER global_plan_adopted_at',
  'SELECT "cover_image_storage_key already exists" AS info_message'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'workout_schedules'
    AND COLUMN_NAME = 'cover_image_content_type'
);

SET @sql_stmt := IF(
  @col_exists = 0,
  'ALTER TABLE workout_schedules ADD COLUMN cover_image_content_type VARCHAR(100) NULL AFTER cover_image_storage_key',
  'SELECT "cover_image_content_type already exists" AS info_message'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'workout_schedules'
    AND COLUMN_NAME = 'cover_image_updated_at'
);

SET @sql_stmt := IF(
  @col_exists = 0,
  'ALTER TABLE workout_schedules ADD COLUMN cover_image_updated_at DATETIME NULL AFTER cover_image_content_type',
  'SELECT "cover_image_updated_at already exists" AS info_message'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
