-- WorkoutAtlas 0.85.133 forward migration
-- Add optional YouTube URL support for exercises.
-- Manual execution target: hosting.com/phpMyAdmin (production).

START TRANSACTION;

SET @has_youtube_url_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'exercises'
    AND COLUMN_NAME = 'YouTubeVideoURL'
);

SET @forward_sql := IF(
  @has_youtube_url_col = 0,
  'ALTER TABLE exercises ADD COLUMN YouTubeVideoURL VARCHAR(255) NULL AFTER PrimaryImage',
  'SELECT "YouTubeVideoURL column already exists" AS info_message'
);

PREPARE stmt FROM @forward_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
