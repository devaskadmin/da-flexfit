-- FlexFit Exercises schema updates
-- Version: 0.7.1-beta
-- Date: 2026-04-22
-- Purpose:
--   1) Support per-user exercise ownership (My Exercises view)
--   2) Support per-user favorite exercises (Favorites view)

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS CreatedByUserID BIGINT UNSIGNED NULL AFTER ExerciseID,
  ADD INDEX IF NOT EXISTS idx_exercises_created_by_user (CreatedByUserID);

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
