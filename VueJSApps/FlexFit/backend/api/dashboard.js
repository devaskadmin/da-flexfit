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
const VALID_GROUP_BY = new Set(['day', 'month', 'year']);

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

function resolveGroupBy(rawValue) {
  return VALID_GROUP_BY.has(String(rawValue || '').toLowerCase())
    ? String(rawValue).toLowerCase()
    : 'day';
}

function getChartGrouping(groupBy) {
  if (groupBy === 'month') {
    return {
      groupExpr: `DATE_FORMAT(wl.WorkoutDate, '%Y-%m')`,
      labelExpr: `DATE_FORMAT(wl.WorkoutDate, '%b %Y')`,
      orderExpr: `DATE_FORMAT(wl.WorkoutDate, '%Y-%m')`,
    };
  }

  if (groupBy === 'year') {
    return {
      groupExpr: `YEAR(wl.WorkoutDate)`,
      labelExpr: `CAST(YEAR(wl.WorkoutDate) AS CHAR)`,
      orderExpr: `YEAR(wl.WorkoutDate)`,
    };
  }

  return {
    groupExpr: `DATE(wl.WorkoutDate)`,
    labelExpr: `DATE_FORMAT(wl.WorkoutDate, '%b %e')`,
    orderExpr: `DATE(wl.WorkoutDate)`,
  };
}

async function loadActivityFeed(userId, startDate = null, endDate = null, limit = 5) {
  const whereParts = [
    'wl.UserID = ?',
    '(wl.workout_log_session_id IS NULL OR wls.status = \'completed\')',
  ];
  const params = [userId];

  if (startDate && endDate) {
    whereParts.push('DATE(wl.WorkoutDate) BETWEEN ? AND ?');
    params.push(startDate, endDate);
  }

  params.push(limit);

  const [rows] = await pool.query(
    `SELECT
       DATE(wl.WorkoutDate) AS activityDate,
       COUNT(DISTINCT wl.WorkoutLogID) AS exerciseCount,
       GROUP_CONCAT(DISTINCT ex.ExerciseTitle ORDER BY ex.ExerciseTitle SEPARATOR ', ') AS exerciseNames
     FROM workout_log wl
     LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
     LEFT JOIN exercises ex ON wl.ExerciseID = ex.ExerciseID
     WHERE ${whereParts.join(' AND ')}
     GROUP BY DATE(wl.WorkoutDate)
     ORDER BY activityDate DESC
     LIMIT ?`,
    params
  );

  return rows.map((row) => ({
    date: row.activityDate instanceof Date
      ? row.activityDate.toISOString().slice(0, 10)
      : String(row.activityDate).slice(0, 10),
    activityType: 'workout_logged',
    exerciseCount: Number(row.exerciseCount || 0),
    summary: 'Recorded workout activity',
    exerciseNames: String(row.exerciseNames || '').trim(),
  }));
}

async function loadNutritionActivity(userId, limit = 5) {
  const [columnRows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'food_nutrition_logs'`
  );

  if (!Array.isArray(columnRows) || columnRows.length === 0) {
    return [];
  }

  const columns = new Set(columnRows.map((row) => String(row.COLUMN_NAME || '').trim()));
  const pickColumn = (candidates) => candidates.find((name) => columns.has(name)) || null;

  const userCol = pickColumn(['user_id', 'UserID', 'userId']);
  const dateCol = pickColumn(['log_date', 'date', 'logged_at', 'created_at']);
  if (!userCol || !dateCol) {
    return [];
  }

  const mealTypeCol = pickColumn(['meal_type', 'mealType', 'meal_name', 'MealType']);
  const summaryCol = pickColumn(['summary', 'food_name', 'foodName', 'meal_summary', 'meal_title', 'name']);
  const caloriesCol = pickColumn(['calories', 'calories_kcal', 'kcal', 'energy_kcal']);
  const idCol = pickColumn(['id', 'nutrition_log_id', 'log_id']);

  const mealTypeExpr = mealTypeCol
    ? `NULLIF(TRIM(${mealTypeCol}), '')`
    : `'Meal'`;
  const summaryExpr = summaryCol
    ? `NULLIF(TRIM(${summaryCol}), '')`
    : `'Meal entry'`;
  const caloriesExpr = caloriesCol
    ? `CAST(${caloriesCol} AS DECIMAL(10,2))`
    : `NULL`;

  const orderBy = [
    `DATE(${dateCol}) DESC`,
    ...(idCol ? [`${idCol} DESC`] : []),
  ].join(', ');

  const [rows] = await pool.query(
    `SELECT
       DATE(${dateCol}) AS entryDate,
       ${mealTypeExpr} AS mealType,
       ${summaryExpr} AS summary,
       ${caloriesExpr} AS calories
     FROM food_nutrition_logs
     WHERE ${userCol} = ?
     ORDER BY ${orderBy}
     LIMIT ?`,
    [userId, limit]
  );

  return rows.map((row) => ({
    mealType: String(row.mealType || 'Meal').trim() || 'Meal',
    summary: String(row.summary || 'Meal entry').trim() || 'Meal entry',
    date: row.entryDate instanceof Date
      ? row.entryDate.toISOString().slice(0, 10)
      : String(row.entryDate || '').slice(0, 10),
    calories: row.calories == null ? null : Number(row.calories),
  }));
}

async function loadRecentWorkout(userId) {
  const [rows] = await pool.query(
    `SELECT
       wls.id AS sessionId,
       DATE(wls.workout_date) AS workoutDate,
       COALESCE(NULLIF(TRIM(wls.workout_day_name), ''), 'Workout Session') AS workoutName,
       COALESCE(workoutAgg.totalDurationMinutes, 0) AS totalDurationMinutes,
       COALESCE(workoutAgg.exerciseCount, 0) AS exerciseCount
     FROM workout_log_sessions wls
     LEFT JOIN (
       SELECT
         wl.workout_log_session_id AS sessionId,
         COUNT(DISTINCT wl.WorkoutLogID) AS exerciseCount,
         COALESCE(SUM(wl.Duration), 0) AS totalDurationMinutes
       FROM workout_log wl
       WHERE wl.UserID = ?
       GROUP BY wl.workout_log_session_id
     ) workoutAgg ON workoutAgg.sessionId = wls.id
     WHERE wls.user_id = ?
       AND wls.status = 'completed'
     ORDER BY COALESCE(wls.completed_at, wls.workout_date) DESC, wls.id DESC
     LIMIT 1`,
    [userId, userId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    sessionId: Number(row.sessionId || 0),
    workoutName: String(row.workoutName || 'Workout Session').trim() || 'Workout Session',
    workoutDate: row.workoutDate instanceof Date
      ? row.workoutDate.toISOString().slice(0, 10)
      : String(row.workoutDate || '').slice(0, 10),
    durationMinutes: Math.max(0, Math.round(Number(row.totalDurationMinutes || 0))),
    exerciseCount: Math.max(0, Number(row.exerciseCount || 0)),
  };
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
    const groupBy = resolveGroupBy(req.query.groupBy);

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

    // ── Training Progress chart: workouts logged by selected grouping ───────
    const { groupExpr, labelExpr, orderExpr } = getChartGrouping(groupBy);
    const [chartRows] = await pool.query(
      `SELECT
         ${groupExpr} AS chartDate,
         ${labelExpr} AS label,
         COUNT(DISTINCT wl.WorkoutLogID) AS value
       FROM workout_log wl
       LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
       WHERE wl.UserID = ?
         AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
         AND DATE(wl.WorkoutDate) BETWEEN ? AND ?
       GROUP BY ${groupExpr}
       ORDER BY ${orderExpr} ASC`,
      [userId, startDate, endDate]
    );

    const workoutsLoggedChart = chartRows.map((row) => ({
      date: String(row.chartDate),
      label: String(row.label),
      value: Number(row.value || 0),
    }));

    const activityFeed = await loadActivityFeed(userId, startDate, endDate, 5);

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
      groupBy,
      workoutsLoggedChart,
      activityFeed,
    };

    console.log('DASHBOARD STATS', stats);

    return res.status(200).json(stats);
  } catch (err) {
    console.error('❌ GET /api/dashboard/metrics:', err);
    return res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

router.get('/dashboard/activity', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const week = currentIsoWeek();
    const rawStart = req.query.startDate;
    const rawEnd = req.query.endDate;

    const startDate = isValidIsoDate(rawStart) ? rawStart : week.start;
    const endDate = isValidIsoDate(rawEnd) ? rawEnd : week.end;

    const activityFeed = await loadActivityFeed(userId, startDate, endDate, 5);
    return res.status(200).json(activityFeed);
  } catch (err) {
    console.error('❌ GET /api/dashboard/activity:', err);
    return res.status(500).json({ error: 'Failed to load dashboard activity.' });
  }
});

router.get('/dashboard/nutrition-activity', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const nutritionActivity = await loadNutritionActivity(userId, 5);
    return res.status(200).json(nutritionActivity);
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(200).json([]);
    }

    console.error('❌ GET /api/dashboard/nutrition-activity:', err);
    return res.status(500).json({ error: 'Failed to load nutrition activity.' });
  }
});

router.get('/dashboard/recent-workout', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const recentWorkout = await loadRecentWorkout(userId);
    return res.status(200).json(recentWorkout || null);
  } catch (err) {
    console.error('❌ GET /api/dashboard/recent-workout:', err);
    return res.status(500).json({ error: 'Failed to load recent workout.' });
  }
});

module.exports = router;
