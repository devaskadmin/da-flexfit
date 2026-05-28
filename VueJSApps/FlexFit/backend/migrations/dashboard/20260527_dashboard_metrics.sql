-- =============================================================================
-- FlexFit v0.82.20 – Dashboard Live Metrics
-- Migration: 0.82.20_dashboard_metrics.sql
-- Date: 2026-05-26
--
-- Adds indexes to support the three live dashboard metric queries:
--   1. Workouts This Week  → workout_log_sessions (user_id, status, workout_date)
--   2. Current Streak      → workout_log_sessions (user_id, status, workout_date)
--   3. Calories Burned     → workout_log         (UserID, WorkoutType, WorkoutDate)
--
-- Safe to run multiple times – uses IF NOT EXISTS / CREATE INDEX ... IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- workout_log_sessions indexes
-- ---------------------------------------------------------------------------

-- Composite index: filters by user + status then scans by workout_date.
-- Used by both the "this week" count query and the streak date pull.
ALTER TABLE workout_log_sessions
  ADD INDEX IF NOT EXISTS idx_wls_user_status_date (user_id, status, workout_date);

-- ---------------------------------------------------------------------------
-- workout_log indexes
-- ---------------------------------------------------------------------------

-- Composite index: filters by user + WorkoutType then scans WorkoutDate.
-- Used by the cardio calories query.
ALTER TABLE workout_log
  ADD INDEX IF NOT EXISTS idx_wl_user_type_date (UserID, WorkoutType, WorkoutDate);

-- ---------------------------------------------------------------------------
-- Verify (optional, comment out in production)
-- ---------------------------------------------------------------------------
-- SHOW INDEX FROM workout_log_sessions WHERE Key_name = 'idx_wls_user_status_date';
-- SHOW INDEX FROM workout_log WHERE Key_name = 'idx_wl_user_type_date';
