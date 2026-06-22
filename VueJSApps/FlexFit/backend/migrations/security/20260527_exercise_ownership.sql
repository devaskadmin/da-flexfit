-- FlexFit v0.82.41 - Exercise ownership columns
-- Adds CreatedByUserID and IsGlobalExercise only when missing.

SET @db_name = DATABASE();

SET @has_created_by := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND column_name = 'CreatedByUserID'
);

SET @has_global_flag := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND column_name = 'IsGlobalExercise'
);

SET @has_idx_created_by := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND index_name = 'idx_exercises_created_by_user'
);

SET @has_idx_global_visibility := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND index_name = 'idx_exercises_global_visibility'
);

SET @sql_created_by := IF(
  @has_created_by = 0,
  'ALTER TABLE exercises ADD COLUMN CreatedByUserID BIGINT UNSIGNED NULL AFTER ExerciseID',
  'SELECT ''CreatedByUserID already exists'''
);

PREPARE stmt_created_by FROM @sql_created_by;
EXECUTE stmt_created_by;
DEALLOCATE PREPARE stmt_created_by;

SET @sql_global_flag := IF(
  @has_global_flag = 0,
  'ALTER TABLE exercises ADD COLUMN IsGlobalExercise TINYINT(1) NOT NULL DEFAULT 1 AFTER CreatedByUserID',
  'SELECT ''IsGlobalExercise already exists'''
);

PREPARE stmt_global_flag FROM @sql_global_flag;
EXECUTE stmt_global_flag;
DEALLOCATE PREPARE stmt_global_flag;

SET @sql_idx_created_by := IF(
  @has_idx_created_by = 0,
  'ALTER TABLE exercises ADD INDEX idx_exercises_created_by_user (CreatedByUserID)',
  'SELECT ''idx_exercises_created_by_user already exists'''
);

PREPARE stmt_idx_created_by FROM @sql_idx_created_by;
EXECUTE stmt_idx_created_by;
DEALLOCATE PREPARE stmt_idx_created_by;

SET @sql_idx_global_visibility := IF(
  @has_idx_global_visibility = 0,
  'ALTER TABLE exercises ADD INDEX idx_exercises_global_visibility (IsGlobalExercise, CreatedByUserID)',
  'SELECT ''idx_exercises_global_visibility already exists'''
);

PREPARE stmt_idx_global_visibility FROM @sql_idx_global_visibility;
EXECUTE stmt_idx_global_visibility;
DEALLOCATE PREPARE stmt_idx_global_visibility;

-- Convert existing user-created rows to custom exercises.
UPDATE exercises
SET IsGlobalExercise = 0
WHERE CreatedByUserID IS NOT NULL;
