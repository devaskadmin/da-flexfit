/**
 * dashboard.js
 * FlexFit v0.82.20 – Dashboard Live Metrics
 *
 * GET /api/dashboard/metrics
 * Returns live values for the three dashboard metric cards:
 *   - workoutsThisWeek  (completed workout_log_sessions this ISO week)
 *   - workoutsLastWeek  (same, prior ISO week – for comparison display)
 *   - weekDiff          (workoutsThisWeek - workoutsLastWeek)
 *   - streak            (consecutive workout days, via StreakCalculator)
 *   - caloriesBurned    (Cardio-only Calories in workout_log this ISO week)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db.js');
const { calculateStreak } = require('../utils/StreakCalculator.js');

// ─── Auth guard ─────────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
};

// ─── GET /api/dashboard/metrics ─────────────────────────────────────────────
router.get('/dashboard/metrics', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // ── Card 1: Workouts This Week ──────────────────────────────────────────
    // Count completed sessions in the current ISO week (week starts Monday).
    const [[thisWeekRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM workout_log_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND YEARWEEK(workout_date, 1) = YEARWEEK(CURDATE(), 1)`,
      [userId]
    );
    const workoutsThisWeek = Number(thisWeekRow?.cnt ?? 0);

    // Count last week for the +/- comparison subtext
    const [[lastWeekRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM workout_log_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND YEARWEEK(workout_date, 1) = YEARWEEK(CURDATE() - INTERVAL 7 DAY, 1)`,
      [userId]
    );
    const workoutsLastWeek = Number(lastWeekRow?.cnt ?? 0);
    const weekDiff = workoutsThisWeek - workoutsLastWeek;

    // ── Card 2: Current Streak ──────────────────────────────────────────────
    // Pull up to 365 distinct workout dates (descending) and calculate streak.
    const [dateRows] = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(workout_date, '%Y-%m-%d') AS d
       FROM workout_log_sessions
       WHERE user_id = ? AND status = 'completed'
       ORDER BY d DESC
       LIMIT 365`,
      [userId]
    );
    const streak = calculateStreak(dateRows.map((r) => r.d));

    // ── Card 3: Calories Burned (Cardio only, this week) ───────────────────
    const [[calRow]] = await pool.query(
      `SELECT COALESCE(SUM(Calories), 0) AS total
       FROM workout_log
       WHERE UserID = ?
         AND WorkoutType = 'Cardio'
         AND YEARWEEK(WorkoutDate, 1) = YEARWEEK(CURDATE(), 1)`,
      [userId]
    );
    const caloriesBurned = Number(calRow?.total ?? 0);

    return res.status(200).json({
      workoutsThisWeek,
      workoutsLastWeek,
      weekDiff,
      streak,
      caloriesBurned,
    });
  } catch (err) {
    console.error('❌ GET /api/dashboard/metrics:', err);
    return res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

module.exports = router;
