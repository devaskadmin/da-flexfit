-- FlexFit v0.82.35 - Custom Workout Log Day Ordering
-- Adds a per-plan toggle plus per-group custom display order for Workout Log.

ALTER TABLE `workout_schedules`
  ADD COLUMN `use_custom_workout_log_order` TINYINT(1) NOT NULL DEFAULT 0 AFTER `schedule_mode`;

ALTER TABLE `workout_schedule_groups`
  ADD COLUMN `workout_log_display_order` INT(11) NULL DEFAULT NULL AFTER `sort_order`;
