-- WorkoutAtlas 0.85.133 rollback
-- Manual execution target: hosting.com/phpMyAdmin (production).
-- Safety guard: rollback is blocked when non-empty YouTubeVideoURL values exist.

START TRANSACTION;

SET @has_youtube_url_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'exercises'
    AND COLUMN_NAME = 'YouTubeVideoURL'
);

SET @count_rows_sql := IF(
  @has_youtube_url_col = 1,
  'SELECT COUNT(*) INTO @youtube_rows_in_use FROM exercises WHERE COALESCE(TRIM(YouTubeVideoURL), "") <> ""',
  'SELECT 0 INTO @youtube_rows_in_use'
);

PREPARE stmt_count FROM @count_rows_sql;
EXECUTE stmt_count;
DEALLOCATE PREPARE stmt_count;

SET @rollback_sql := IF(
  @has_youtube_url_col = 0,
  'SELECT "ROLLBACK_SKIPPED: YouTubeVideoURL column does not exist." AS info_message',
  IF(
    @youtube_rows_in_use = 0,
    'ALTER TABLE exercises DROP COLUMN YouTubeVideoURL',
    'SELECT "ROLLBACK_BLOCKED: Non-empty YouTubeVideoURL values exist. Clear or migrate them before rollback." AS error_message'
  )
);

PREPARE stmt_rollback FROM @rollback_sql;
EXECUTE stmt_rollback;
DEALLOCATE PREPARE stmt_rollback;

COMMIT;
