-- WorkoutAtlas 0.85.124
-- ExerciseScope 2.0 - Stage 4 rollback
--
-- Use only if the forward migration must be reverted before any new-model
-- records are introduced.
--
-- If rows have already been written with SHARED or CUSTOM values, restore from
-- a database backup instead of relying on this SQL alone.

SET @db_name = DATABASE();

SET @has_publication_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND index_name = 'idx_exercises_publication_state'
);

SET @sql_drop_publication_index := IF(
  @has_publication_index = 1,
  'ALTER TABLE exercises DROP INDEX idx_exercises_publication_state',
  'SELECT ''idx_exercises_publication_state does not exist'''
);

PREPARE stmt_drop_publication_index FROM @sql_drop_publication_index;
EXECUTE stmt_drop_publication_index;
DEALLOCATE PREPARE stmt_drop_publication_index;

SET @has_publication_state := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND column_name = 'ExercisePublicationState'
);

SET @sql_drop_publication_state := IF(
  @has_publication_state = 1,
  'ALTER TABLE exercises DROP COLUMN ExercisePublicationState',
  'SELECT ''ExercisePublicationState does not exist'''
);

PREPARE stmt_drop_publication_state FROM @sql_drop_publication_state;
EXECUTE stmt_drop_publication_state;
DEALLOCATE PREPARE stmt_drop_publication_state;

SET @has_scope_custom := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND column_name = 'ExerciseScope'
    AND column_type LIKE '%CUSTOM%'
);

SET @sql_restore_scope := IF(
  @has_scope_custom = 1,
  'ALTER TABLE exercises MODIFY ExerciseScope ENUM(''SYSTEM'',''TRAINER_SHARED'',''PRIVATE'') NULL',
  'SELECT ''ExerciseScope already matches the legacy enum'''
);

PREPARE stmt_restore_scope FROM @sql_restore_scope;
EXECUTE stmt_restore_scope;
DEALLOCATE PREPARE stmt_restore_scope;
