-- WorkoutAtlas 0.85.124
-- ExerciseScope 2.0 - Stage 2 forward compatibility
--
-- Purpose:
--   - Separate discoverability from ownership with a dedicated publication flag.
--   - Prepare the schema for SYSTEM / SHARED / CUSTOM while keeping legacy
--     TRAINER_SHARED and PRIVATE values intact.
--   - Preserve existing ExerciseIDs, ownership links, media references, and
--     workout history.
--
-- SAFETY:
--   - No rows are deleted.
--   - No existing columns are dropped.
--   - Legacy PRIVATE rows remain restricted.

SET @db_name = DATABASE();

SET @has_publication_state := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND column_name = 'ExercisePublicationState'
);

SET @sql_add_publication_state := IF(
  @has_publication_state = 0,
  'ALTER TABLE exercises ADD COLUMN ExercisePublicationState ENUM(''RESTRICTED'',''DISCOVERABLE'') NOT NULL DEFAULT ''RESTRICTED'' AFTER ExerciseScope',
  'SELECT ''ExercisePublicationState already exists'''
);

PREPARE stmt_add_publication_state FROM @sql_add_publication_state;
EXECUTE stmt_add_publication_state;
DEALLOCATE PREPARE stmt_add_publication_state;

SET @has_scope_custom := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND column_name = 'ExerciseScope'
    AND column_type LIKE '%CUSTOM%'
);

SET @sql_expand_scope := IF(
  @has_scope_custom = 0,
  'ALTER TABLE exercises MODIFY ExerciseScope ENUM(''SYSTEM'',''SHARED'',''CUSTOM'',''TRAINER_SHARED'',''PRIVATE'') NULL',
  'SELECT ''ExerciseScope already includes CUSTOM'''
);

PREPARE stmt_expand_scope FROM @sql_expand_scope;
EXECUTE stmt_expand_scope;
DEALLOCATE PREPARE stmt_expand_scope;

SET @has_publication_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db_name
    AND table_name = 'exercises'
    AND index_name = 'idx_exercises_publication_state'
);

SET @sql_add_publication_index := IF(
  @has_publication_index = 0,
  'ALTER TABLE exercises ADD INDEX idx_exercises_publication_state (ExercisePublicationState)',
  'SELECT ''idx_exercises_publication_state already exists'''
);

PREPARE stmt_add_publication_index FROM @sql_add_publication_index;
EXECUTE stmt_add_publication_index;
DEALLOCATE PREPARE stmt_add_publication_index;

UPDATE exercises
SET ExercisePublicationState = 'DISCOVERABLE'
WHERE COALESCE(IsSystemExercise, 0) = 1
   OR ExerciseScope IN ('SYSTEM', 'SHARED', 'TRAINER_SHARED');

UPDATE exercises
SET ExercisePublicationState = 'RESTRICTED'
WHERE COALESCE(IsSystemExercise, 0) = 0
  AND ExerciseScope = 'PRIVATE';
