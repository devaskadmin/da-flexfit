/**
 * dashboard.js
 * FlexFit v0.82.21 – Dashboard Metric Integration
 *
 * GET /api/dashboard/metrics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns live values for the three dashboard metric cards:
 *   - workoutsThisWeek  (completed workout_log_sessions in the selected range)
 *   - workoutsLastWeek  (same, equivalent prior period – for comparison)
 *   - weekDiff          (workoutsThisWeek - workoutsLastWeek)
 *   - streak            (consecutive workout days, via StreakCalculator)
 *   - caloriesBurned    (all workout_log Calories in the selected range)
 *   - weeklyTarget      (workout days in user's active schedule, or 0)
 *
 * startDate/endDate default to the current ISO week (Mon–Sun) when omitted.
 */

const express = require('express');
const router = express.Router();
const pool = require('../db.js');
// ─── Helpers ─────────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate a YYYY-MM-DD string and confirm it is a real calendar date. */
function isValidIsoDate(str) {
  if (!ISO_DATE_RE.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

/** Return { start, end } ISO strings for the current ISO week (Mon–Sun). */
function currentIsoWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

/** Shift a YYYY-MM-DD string by `days` days. */
function shiftDate(isoStr, days) {
  const d = new Date(isoStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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

    // ── Resolve date range ──────────────────────────────────────────────────
    const week = currentIsoWeek();
    const rawStart = req.query.startDate;
    const rawEnd = req.query.endDate;

    const startDate = isValidIsoDate(rawStart) ? rawStart : week.start;
    const endDate   = isValidIsoDate(rawEnd)   ? rawEnd   : week.end;

    // Prior period of the same length for comparison
    const rangeDays = Math.round(
      (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
    ) + 1;
    const priorEnd   = shiftDate(startDate, -1);
    const priorStart = shiftDate(priorEnd, -(rangeDays - 1));

    // ── Card 1: Workouts This Week (real user data, selected week range) ────
    const [[thisWeekRow]] = await pool.query(
      `SELECT COUNT(DISTINCT DATE(wl.WorkoutDate)) AS cnt
       FROM workout_log wl
       LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
       WHERE wl.UserID = ?
         AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
         AND DATE(wl.WorkoutDate) BETWEEN ? AND ?`,
      [userId, startDate, endDate]
    );
    const workoutsThisWeek = Number(thisWeekRow?.cnt ?? 0);

    // Prior period count for +/- comparison subtext
    const [[lastWeekRow]] = await pool.query(
      `SELECT COUNT(DISTINCT DATE(wl.WorkoutDate)) AS cnt
       FROM workout_log wl
       LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
       WHERE wl.UserID = ?
         AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
         AND DATE(wl.WorkoutDate) BETWEEN ? AND ?`,
      [userId, priorStart, priorEnd]
    );
    const workoutsLastWeek = Number(lastWeekRow?.cnt ?? 0);
    const weekDiff = workoutsThisWeek - workoutsLastWeek;

    // ── Weekly target from user's most-recent active schedule ───────────────
    const [[targetRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM workout_schedule_groups
       WHERE workout_schedule_id = (
         SELECT id FROM workout_schedules
         WHERE user_id = ? AND status = 'active'
         ORDER BY updated_at DESC
         LIMIT 1
       )`,
      [userId]
    );
    const weeklyTarget = Number(targetRow?.cnt ?? 0);

    // ── Card 2: Current Streak (strict: today must have a workout) ─────────
    const [dateRows] = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(workout_date, '%Y-%m-%d') AS d
       FROM workout_log_sessions
       WHERE user_id = ? AND status = 'completed'
       ORDER BY d DESC
       LIMIT 365`,
      [userId]
    );

    let streak = 0;
    if (dateRows.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);
      const firstDate = String(dateRows[0]?.d || '').slice(0, 10);

      if (firstDate === todayStr) {
        let expected = new Date(today);
        for (const row of dateRows) {
          const currentDate = String(row?.d || '').slice(0, 10);
          const expectedStr = expected.toISOString().slice(0, 10);
          if (currentDate !== expectedStr) break;
          streak += 1;
          expected.setDate(expected.getDate() - 1);
        }
      }
    }

    // ── Card 3: Calories Burned (all workout types, selected range) ─────────
    const [[calRow]] = await pool.query(
      `SELECT COALESCE(SUM(Calories), 0) AS total
       FROM workout_log
       WHERE UserID = ?
         AND WorkoutDate BETWEEN ? AND ?`,
      [userId, startDate, endDate]
    );
    const caloriesBurned = Number(calRow?.total ?? 0);

    // ── Card 4: Protein Today (real user nutrition log data) ────────────────
    let proteinToday = 0;
    try {
      const [[proteinRow]] = await pool.query(
        `SELECT COALESCE(SUM(protein_g), 0) AS total
         FROM food_nutrition_logs
         WHERE user_id = ?
           AND log_date = CURDATE()`,
        [userId]
      );
      proteinToday = Number(proteinRow?.total ?? 0);
    } catch (proteinErr) {
      // Keep dashboard functional if nutrition table has not been applied yet.
      console.warn('⚠️ Protein Today fallback to 0:', proteinErr?.message || proteinErr);
    }

    const stats = {
      userId,
      workoutsThisWeek,
      proteinToday,
      caloriesBurned,
      currentStreak: streak,
      streak,
      weeklyTarget,
      workoutsLastWeek,
      weekDiff,
      weekStart: startDate,
      weekEnd: endDate,
      startDate,
      endDate,
    };

    console.log('DASHBOARD STATS', stats);

    return res.status(200).json(stats);
  } catch (err) {
    console.error('❌ GET /api/dashboard/metrics:', err);
    return res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

module.exports = router;
