-- FlexFit Exercises schema updates
-- Version: 0.82.41
-- Date: 2026-05-27
-- Purpose:
--   1) Support per-user exercise ownership (My Exercises view)
--   2) Support per-user favorite exercises (Favorites view)
--   3) Support global vs custom exercise visibility and permissions

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS CreatedByUserID BIGINT UNSIGNED NULL AFTER ExerciseID,
  ADD COLUMN IF NOT EXISTS IsGlobalExercise TINYINT(1) NOT NULL DEFAULT 1 AFTER CreatedByUserID,
  ADD INDEX IF NOT EXISTS idx_exercises_created_by_user (CreatedByUserID),
  ADD INDEX IF NOT EXISTS idx_exercises_global_visibility (IsGlobalExercise, CreatedByUserID);

-- Preserve existing custom exercises as non-global after column creation/backfill.
UPDATE exercises
SET IsGlobalExercise = 0
WHERE CreatedByUserID IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_favorite_exercises (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_user_favorite_exercise (user_id, exercise_id),
  KEY idx_ufe_user (user_id),
  KEY idx_ufe_exercise (exercise_id),
  CONSTRAINT fk_ufe_exercise
    FOREIGN KEY (exercise_id) REFERENCES exercises (ExerciseID)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
