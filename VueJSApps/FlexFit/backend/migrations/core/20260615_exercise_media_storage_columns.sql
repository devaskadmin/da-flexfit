-- FlexFit v0.83.8
-- Exercise content storage abstraction columns and backfill.
-- Supports future provider changes (LOCAL, MINIO, AWS, AZURE) without another schema migration.
-- NOTE: Canonical source of truth is MediaProvider + MediaPath + PrimaryImage.
-- NOTE: This migration avoids INFORMATION_SCHEMA reads so it works with restricted DB users.

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS MediaProvider VARCHAR(20) NOT NULL DEFAULT 'LOCAL' AFTER IsGlobalExercise;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS MediaPath VARCHAR(255) NOT NULL DEFAULT 'APP/exercise-library/0/images' AFTER MediaProvider;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS PrimaryImage VARCHAR(255) NULL AFTER MediaPath;

UPDATE exercises
SET MediaProvider = 'LOCAL'
WHERE MediaProvider IS NULL OR TRIM(MediaProvider) = '';

UPDATE exercises
SET MediaPath = CONCAT('APP/exercise-library/', ExerciseID, '/images')
WHERE MediaPath IS NULL OR TRIM(MediaPath) = '';

UPDATE exercises
SET PrimaryImage = CASE
  WHEN PrimaryImage IS NOT NULL AND TRIM(PrimaryImage) <> '' THEN PrimaryImage
  WHEN ImageGallery IS NOT NULL AND JSON_VALID(ImageGallery) AND JSON_LENGTH(ImageGallery) > 0
    THEN JSON_UNQUOTE(JSON_EXTRACT(ImageGallery, '$[0]'))
  WHEN ImageURL IS NOT NULL AND TRIM(ImageURL) <> ''
    THEN SUBSTRING_INDEX(SUBSTRING_INDEX(ImageURL, '?', 1), '/', -1)
  ELSE '1.jpg'
END;

-- ImageURL intentionally left unchanged as a legacy compatibility field.
