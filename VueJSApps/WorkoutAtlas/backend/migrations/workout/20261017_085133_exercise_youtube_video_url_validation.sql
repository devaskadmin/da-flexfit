-- WorkoutAtlas 0.85.133 validation
-- Run after forward migration.

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'exercises'
  AND COLUMN_NAME = 'YouTubeVideoURL';

SELECT
  COUNT(*) AS total_exercises,
  SUM(CASE WHEN COALESCE(TRIM(YouTubeVideoURL), '') <> '' THEN 1 ELSE 0 END) AS exercises_with_youtube_url,
  SUM(CASE WHEN COALESCE(TRIM(YouTubeVideoURL), '') = '' THEN 1 ELSE 0 END) AS exercises_without_youtube_url
FROM exercises;

SELECT ExerciseID, ExerciseTitle, YouTubeVideoURL
FROM exercises
WHERE COALESCE(TRIM(YouTubeVideoURL), '') <> ''
ORDER BY ExerciseID DESC
LIMIT 25;
