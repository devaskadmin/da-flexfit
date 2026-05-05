-- FlexFit 0.77 - Required Database Changes
-- workout_log_sessions already exists. Just add the two missing columns.

ALTER TABLE `workout_log_sessions`
  ADD COLUMN `workout_day_id`   INT UNSIGNED NULL        AFTER `source_workout_schedule_id`,
  ADD COLUMN `workout_day_name` VARCHAR(120) NOT NULL DEFAULT '' AFTER `workout_day_id`;
