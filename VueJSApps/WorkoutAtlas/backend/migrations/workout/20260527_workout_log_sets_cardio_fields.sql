-- FlexFit 0.78.f - Add cardio per-set fields to workout_log_sets
-- Adds calories_burned, distance_miles, speed_mph so cardio/other sessions
-- store full per-set detail that can be replayed in Workout History.

ALTER TABLE `workout_log_sets`
  ADD COLUMN `calories_burned` DECIMAL(7,2)  NULL DEFAULT NULL AFTER `duration_minutes`,
  ADD COLUMN `distance_miles`  DECIMAL(7,3)  NULL DEFAULT NULL AFTER `calories_burned`,
  ADD COLUMN `speed_mph`       DECIMAL(6,2)  NULL DEFAULT NULL AFTER `distance_miles`;
