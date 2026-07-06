-- ============================================================
-- FlexFit v0.82 — Progress Stats & Workout Log Analytics
-- Migration: flexfit_0_82_progress_stats.sql
-- Purpose:   Add indexes, a helper view, and document the
--            queries used by the new /api/progress/* routes.
--            No destructive changes are made to existing tables.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- SECTION 1: PERFORMANCE INDEXES
-- Add indexes on workout_log and workout_log_sessions for the
-- date-range and user-scoped queries used by the progress page.
-- All indexes use IF NOT EXISTS equivalents via CREATE INDEX
-- with error suppression guards where MySQL supports it.
-- ─────────────────────────────────────────────────────────────

-- Index: workout_log.UserID  (already likely present, safe duplicate guard)
ALTER TABLE workout_log
  ADD INDEX IF NOT EXISTS idx_wl_user            (UserID),
  ADD INDEX IF NOT EXISTS idx_wl_user_date       (UserID, WorkoutDate),
  ADD INDEX IF NOT EXISTS idx_wl_user_type       (UserID, WorkoutType),
  ADD INDEX IF NOT EXISTS idx_wl_exercise        (ExerciseID),
  ADD INDEX IF NOT EXISTS idx_wl_session         (workout_log_session_id),
  ADD INDEX IF NOT EXISTS idx_wl_date            (WorkoutDate);

-- Index: workout_log_sessions for completed-session queries
ALTER TABLE workout_log_sessions
  ADD INDEX IF NOT EXISTS idx_wls_user_date      (user_id, workout_date),
  ADD INDEX IF NOT EXISTS idx_wls_user_status    (user_id, status),
  ADD INDEX IF NOT EXISTS idx_wls_status_date    (status, workout_date);

-- Index: workout_log_sets.completed flag for set-level filtering
ALTER TABLE workout_log_sets
  ADD INDEX IF NOT EXISTS idx_wlsets_log         (workout_log_id),
  ADD INDEX IF NOT EXISTS idx_wlsets_completed   (workout_log_id, completed);

-- ─────────────────────────────────────────────────────────────
-- SECTION 2: HELPER VIEW — completed_workout_log
-- Provides a clean, pre-filtered view of workout_log rows that
-- belong to completed sessions only (or are legacy standalone
-- logs without a session). Backend queries may JOIN this view
-- instead of applying the same WHERE filter repeatedly.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW completed_workout_log AS
SELECT
  wl.WorkoutLogID,
  wl.UserID,
  wl.ExerciseID,
  wl.workout_log_session_id         AS SessionID,
  wl.WorkoutDate,
  wl.WorkoutType,
  wl.Reps,
  wl.Sets,
  wl.Weight,
  wl.Duration,
  wl.Calories,
  wl.Distance,
  wl.Speed,
  wl.`Laps-Rep`                     AS LapsRep,
  ex.ExerciseTitle,
  ex.MuscleGroup,
  ex.Equipment
FROM workout_log wl
LEFT JOIN workout_log_sessions wls  ON wl.workout_log_session_id = wls.id
LEFT JOIN exercises            ex   ON wl.ExerciseID = ex.ExerciseID
WHERE
  -- Include legacy rows that have no session (old direct-log entries)
  wl.workout_log_session_id IS NULL
  OR
  -- Include rows that belong to a completed session
  wls.status = 'completed';

-- ─────────────────────────────────────────────────────────────
-- SECTION 3: REFERENCE QUERIES (documentation only)
-- These are the logical queries the backend API uses.
-- They are shown here as comments for DBA review.
-- ─────────────────────────────────────────────────────────────

/*
-- 3a. WORKOUTS THIS WEEK (completed sessions in the current calendar week)
SELECT COUNT(DISTINCT id) AS workoutsThisWeek
FROM workout_log_sessions
WHERE user_id = :userId
  AND status = 'completed'
  AND YEARWEEK(workout_date, 1) = YEARWEEK(CURDATE(), 1);

-- 3b. CURRENT STREAK (consecutive days with at least one completed workout log)
-- The backend computes this in Node.js by fetching distinct completed dates
-- in descending order and walking backward until a gap is found.
-- Equivalent SQL for the raw date list:
SELECT DISTINCT DATE(WorkoutDate) AS wdate
FROM completed_workout_log
WHERE UserID = :userId
  AND WorkoutDate >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
ORDER BY wdate DESC;

-- 3c. CALORIES BURNED (sum from workout_log.Calories for date range)
SELECT IFNULL(SUM(wl.Calories), 0) AS totalCalories
FROM completed_workout_log wl
WHERE UserID = :userId
  AND WorkoutDate BETWEEN :startDate AND :endDate;

-- 3d. CHART DATA — group by day
SELECT
  DATE(WorkoutDate)            AS dateGroup,
  DATE_FORMAT(WorkoutDate, '%b %e') AS label,
  -- metric examples:
  IFNULL(SUM(Calories), 0)     AS calories,
  COUNT(DISTINCT WorkoutDate)  AS completedWorkouts,
  IFNULL(SUM(Sets * Reps * Weight), 0) AS totalVolume,
  IFNULL(SUM(Duration), 0)     AS duration
FROM completed_workout_log
WHERE UserID = :userId
  AND WorkoutDate BETWEEN :startDate AND :endDate
  AND (:workoutType = 'all' OR WorkoutType = :workoutType)
  AND (:exerciseId IS NULL OR ExerciseID = :exerciseId)
GROUP BY DATE(WorkoutDate)
ORDER BY DATE(WorkoutDate) ASC;

-- 3e. CHART DATA — group by month
SELECT
  DATE_FORMAT(WorkoutDate, '%Y-%m')   AS dateGroup,
  DATE_FORMAT(WorkoutDate, '%b %Y')   AS label,
  IFNULL(SUM(Calories), 0)            AS calories,
  COUNT(DISTINCT DATE(WorkoutDate))   AS completedWorkouts,
  IFNULL(SUM(Sets * Reps * Weight), 0) AS totalVolume,
  IFNULL(SUM(Duration), 0)            AS duration
FROM completed_workout_log
WHERE UserID = :userId
  AND WorkoutDate BETWEEN :startDate AND :endDate
GROUP BY DATE_FORMAT(WorkoutDate, '%Y-%m')
ORDER BY dateGroup ASC;

-- 3f. CHART DATA — group by year
SELECT
  YEAR(WorkoutDate)                   AS dateGroup,
  YEAR(WorkoutDate)                   AS label,
  IFNULL(SUM(Calories), 0)            AS calories,
  COUNT(DISTINCT DATE(WorkoutDate))   AS completedWorkouts,
  IFNULL(SUM(Sets * Reps * Weight), 0) AS totalVolume,
  IFNULL(SUM(Duration), 0)            AS duration
FROM completed_workout_log
WHERE UserID = :userId
  AND WorkoutDate BETWEEN :startDate AND :endDate
GROUP BY YEAR(WorkoutDate)
ORDER BY dateGroup ASC;

-- 3g. COMPLETED EXERCISES for the logged-in user (exercise picker dropdown)
SELECT DISTINCT
  ex.ExerciseID   AS exerciseId,
  ex.ExerciseTitle AS exerciseTitle,
  wl.WorkoutType
FROM completed_workout_log wl
JOIN exercises ex ON wl.ExerciseID = ex.ExerciseID
WHERE wl.UserID = :userId
ORDER BY ex.ExerciseTitle ASC;
*/

-- ─────────────────────────────────────────────────────────────
-- SECTION 4: NOTES ON workout_log COMPLETION FIELD
-- workout_log does NOT have a standalone IsCompleted flag.
-- Completion is determined by:
--   a) workout_log_session_id IS NULL  → legacy standalone log (treat as completed)
--   b) workout_log_sessions.status = 'completed'
-- The completed_workout_log view above encapsulates this logic.
-- Do NOT add a redundant IsCompleted column — use the session status instead.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- END OF MIGRATION: flexfit_0_82_progress_stats.sql
-- ─────────────────────────────────────────────────────────────
