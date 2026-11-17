-- WorkoutAtlas 0.85.297
-- Add `paused` to workout_log_sessions.status enum values without replacing table data.
--
-- Safety characteristics:
-- 1) Forward-only and idempotent: no-op if `paused` already exists.
-- 2) Preserves all currently defined enum values (including ended/cancelled/canceled variants).
-- 3) Does not drop/recreate table, reset rows, or alter keys.
--
-- Operational note:
-- ALTER TABLE ... MODIFY COLUMN can take metadata/DDL locks. Run during a low-traffic
-- deployment window and monitor for lock wait pressure on workout_log_sessions.

SET @db_name = DATABASE();

SET @status_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'workout_log_sessions'
    AND COLUMN_NAME = 'status'
);

SET @status_data_type = (
  SELECT DATA_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'workout_log_sessions'
    AND COLUMN_NAME = 'status'
  LIMIT 1
);

SET @status_column_type = (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'workout_log_sessions'
    AND COLUMN_NAME = 'status'
  LIMIT 1
);

SET @is_enum_status = IFNULL(@status_data_type, '') = 'enum';
SET @has_paused = IF(
  @is_enum_status,
  LOCATE("'paused'", LOWER(IFNULL(@status_column_type, ''))) > 0,
  0
);

SET @next_status_column_type = IF(
  @is_enum_status AND @has_paused = 0,
  REPLACE(@status_column_type, ')', ',''paused'')'),
  @status_column_type
);

SET @sql_status_upgrade = CASE
  WHEN @status_column_exists = 0 THEN
    'SELECT "workout_log_sessions.status column not found; paused status migration skipped"'
  WHEN @is_enum_status = 0 THEN
    'SELECT "workout_log_sessions.status is not an ENUM; manual review required before adding paused"'
  WHEN @has_paused = 1 THEN
    'SELECT "paused already present in workout_log_sessions.status"'
  ELSE
    CONCAT(
      'ALTER TABLE workout_log_sessions ',
      'MODIFY COLUMN status ', @next_status_column_type,
      ' NOT NULL DEFAULT ''in_progress''' 
    )
END;

PREPARE stmt FROM @sql_status_upgrade;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT
  @status_column_exists AS status_column_exists,
  @status_data_type AS status_data_type,
  @status_column_type AS previous_status_column_type,
  @next_status_column_type AS next_status_column_type,
  @has_paused AS had_paused_before;
