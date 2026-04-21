-- FlexFit workout schedule relational schema (v1)
-- Supports draft schedules with zero exercises and zero custom groups.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS workout_schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  workout_type VARCHAR(50) NOT NULL DEFAULT 'Strength',
  estimated_duration_minutes INT(11) NOT NULL DEFAULT 0,
  status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
  visibility ENUM('private', 'unlisted', 'public') NOT NULL DEFAULT 'private',
  notes TEXT DEFAULT NULL,
  schedule_mode ENUM('day', 'week') NOT NULL DEFAULT 'day',
  settings_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(settings_json)),
  export_metadata_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(export_metadata_json)),
  export_version INT(11) NOT NULL DEFAULT 1,
  last_exported_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workout_schedules_user (user_id),
  KEY idx_workout_schedules_status (status),
  KEY idx_workout_schedules_visibility (visibility),
  KEY idx_workout_schedules_updated (updated_at),
  CONSTRAINT fk_workout_schedules_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS workout_schedule_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_schedule_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  group_type ENUM('day', 'week', 'any', 'section') NOT NULL DEFAULT 'day',
  sort_order INT(11) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wsg_schedule (workout_schedule_id),
  KEY idx_wsg_schedule_order (workout_schedule_id, sort_order),
  CONSTRAINT fk_wsg_schedule
    FOREIGN KEY (workout_schedule_id) REFERENCES workout_schedules (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS workout_schedule_exercises (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_schedule_id BIGINT UNSIGNED NOT NULL,
  workout_schedule_group_id BIGINT UNSIGNED DEFAULT NULL,
  exercise_id INT(11) DEFAULT NULL,
  exercise_name VARCHAR(150) DEFAULT NULL,
  exercise_image_url VARCHAR(255) DEFAULT NULL,
  workout_type VARCHAR(50) DEFAULT NULL,
  muscle_group VARCHAR(80) DEFAULT NULL,
  equipment VARCHAR(80) DEFAULT NULL,
  sort_order INT(11) NOT NULL DEFAULT 1,
  notes VARCHAR(500) DEFAULT NULL,
  target_sets INT(11) DEFAULT NULL,
  target_reps INT(11) DEFAULT NULL,
  target_weight DECIMAL(8,2) DEFAULT NULL,
  target_duration_minutes INT(11) DEFAULT NULL,
  target_rest_seconds INT(11) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wse_schedule (workout_schedule_id),
  KEY idx_wse_schedule_order (workout_schedule_id, sort_order),
  KEY idx_wse_group (workout_schedule_group_id),
  KEY idx_wse_exercise (exercise_id),
  CONSTRAINT fk_wse_schedule
    FOREIGN KEY (workout_schedule_id) REFERENCES workout_schedules (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wse_group
    FOREIGN KEY (workout_schedule_group_id) REFERENCES workout_schedule_groups (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_wse_exercise
    FOREIGN KEY (exercise_id) REFERENCES exercises (ExerciseID)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------------------------
-- workout_log integration (performed sessions/history)
--
-- IMPORTANT ARCHITECTURE:
-- - workout_schedules* tables = templates/plans
-- - workout_log* tables       = performed history
--
-- We keep workout_log as the performed exercise record table and add optional
-- links back to schedule/template sources.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workout_log_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  source_workout_schedule_id BIGINT UNSIGNED DEFAULT NULL,
  workout_date DATE NOT NULL,
  status ENUM('in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'completed',
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wls_user_date (user_id, workout_date),
  KEY idx_wls_source_schedule (source_workout_schedule_id),
  CONSTRAINT fk_wls_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wls_source_schedule
    FOREIGN KEY (source_workout_schedule_id) REFERENCES workout_schedules (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Existing table workout_log remains the canonical performed exercise row.
-- Add nullable linkage columns for schedule/template traceability.
ALTER TABLE workout_log
  ADD COLUMN IF NOT EXISTS workout_log_session_id BIGINT UNSIGNED DEFAULT NULL AFTER WorkoutLogID,
  ADD COLUMN IF NOT EXISTS source_workout_schedule_id BIGINT UNSIGNED DEFAULT NULL AFTER ExerciseID,
  ADD COLUMN IF NOT EXISTS source_workout_schedule_exercise_id BIGINT UNSIGNED DEFAULT NULL AFTER source_workout_schedule_id,
  ADD COLUMN IF NOT EXISTS source_schedule_group_label VARCHAR(120) DEFAULT NULL AFTER source_workout_schedule_exercise_id,
  ADD COLUMN IF NOT EXISTS performed_at DATETIME DEFAULT NULL AFTER WorkoutDate;

ALTER TABLE workout_log
  ADD INDEX IF NOT EXISTS idx_wl_session (workout_log_session_id),
  ADD INDEX IF NOT EXISTS idx_wl_source_schedule (source_workout_schedule_id),
  ADD INDEX IF NOT EXISTS idx_wl_source_schedule_exercise (source_workout_schedule_exercise_id),
  ADD INDEX IF NOT EXISTS idx_wl_user_date (UserID, WorkoutDate);

-- Optional performed-set detail table (future-safe for detailed set logging).
CREATE TABLE IF NOT EXISTS workout_log_sets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_log_id INT(11) NOT NULL,
  set_number INT(11) NOT NULL,
  reps INT(11) DEFAULT NULL,
  weight DECIMAL(8,2) DEFAULT NULL,
  duration_minutes INT(11) DEFAULT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_wls_log_setnum (workout_log_id, set_number),
  KEY idx_wls_workout_log (workout_log_id),
  CONSTRAINT fk_workout_log_sets_log
    FOREIGN KEY (workout_log_id) REFERENCES workout_log (WorkoutLogID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- NOTE:
-- The FK additions below may fail if they already exist in environments where
-- this migration was manually applied. Keep them in a single migration run.
ALTER TABLE workout_log
  ADD CONSTRAINT fk_wl_session
    FOREIGN KEY (workout_log_session_id) REFERENCES workout_log_sessions (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_wl_source_schedule
    FOREIGN KEY (source_workout_schedule_id) REFERENCES workout_schedules (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_wl_source_schedule_exercise
    FOREIGN KEY (source_workout_schedule_exercise_id) REFERENCES workout_schedule_exercises (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
