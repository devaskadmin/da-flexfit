-- ─────────────────────────────────────────────────────────────────────────────
-- FlexFit 0.77 – workout_sessions table
-- Tracks in-progress and completed workout sessions per user/plan/day.
-- Run once against your MySQL database.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `workout_sessions` (
  `id`                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `user_id`             INT UNSIGNED     NOT NULL,
  `workout_plan_id`     INT UNSIGNED     NOT NULL COMMENT 'FK to workout_schedules.id',
  `workout_day_id`      INT UNSIGNED     NULL      COMMENT 'FK to workout_schedule_groups.id (nullable)',
  `workout_day_name`    VARCHAR(120)     NOT NULL  DEFAULT '' COMMENT 'Human-readable day label, e.g. Monday',
  `workout_date`        DATE             NOT NULL,
  `session_status`      ENUM('in_progress','completed','cancelled') NOT NULL DEFAULT 'in_progress',
  `started_at`          DATETIME         NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `completed_at`        DATETIME         NULL,
  `created_at`          DATETIME         NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME         NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ws_user_status`    (`user_id`, `session_status`),
  INDEX `idx_ws_plan`           (`workout_plan_id`),
  INDEX `idx_ws_date`           (`workout_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Optional: add workout_session_id to workout_log if the column does not exist.
-- Uncomment the ALTER TABLE if you want logs linked to sessions.
-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE `workout_log`
--   ADD COLUMN `workout_session_id` INT UNSIGNED NULL AFTER `workout_log_session_id`,
--   ADD INDEX  `idx_wl_session` (`workout_session_id`);
