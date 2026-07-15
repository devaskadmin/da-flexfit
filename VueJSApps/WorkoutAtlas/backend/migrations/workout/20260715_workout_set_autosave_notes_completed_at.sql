-- WorkoutAtlas 0.84.bf2
-- Add per-set autosave support fields for "Complete Set" persistence.
-- Stores freeform notes and completion timestamp at set level.

ALTER TABLE `workout_log_sets`
  ADD COLUMN IF NOT EXISTS `notes` TEXT NULL AFTER `speed_mph`,
  ADD COLUMN IF NOT EXISTS `completed_at` DATETIME NULL AFTER `completed`;
