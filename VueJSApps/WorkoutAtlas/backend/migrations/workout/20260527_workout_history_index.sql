-- FlexFit v0.82.38 - Workout history lookup index
-- Supports fast latest-history lookups by user + exercise.

CREATE INDEX idx_workout_history_lookup
  ON workout_log (UserID, ExerciseID, WorkoutDate);
