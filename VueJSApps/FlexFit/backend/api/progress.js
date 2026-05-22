/**
 * FlexFit v0.82 — Progress / Stats API
 * Routes:
 *   GET /api/progress/summary   — workoutsThisWeek, currentStreak, caloriesBurned
 *   GET /api/progress/chart     — time-series chart data with filters
 *   GET /api/progress/exercises — distinct exercises completed by the logged-in user
 *
 * All routes require an authenticated session.
 * All queries are scoped to the logged-in user's ID.
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../db.js');

// ─── Allowed values for validation ────────────────────────────────────────────
const VALID_GROUP_BY     = new Set(['day', 'month', 'year']);
const VALID_WORKOUT_TYPE = new Set(['all', 'strength', 'cardio', 'other']);

const VALID_METRICS_BY_TYPE = {
  strength: new Set(['totalVolume', 'weight', 'reps', 'sets', 'calories', 'duration']),
  cardio:   new Set(['duration', 'calories', 'distance', 'speed']),
  other:    new Set(['duration', 'calories', 'count']),
  all:      new Set(['calories', 'duration', 'completedWorkouts', 'completedExercises']),
};

// ─── Auth guard helper ────────────────────────────────────────────────────────
function requireAuth(req, res) {
  if (!req.session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
    return false;
  }
  return true;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

function defaultDateRange() {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29); // last 30 days
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate:   end.toISOString().slice(0, 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/progress/summary
// Returns: workoutsThisWeek, currentStreak, caloriesBurned (current week default)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  if (!requireAuth(req, res)) return;

  const userId = req.session.user.id;

  try {
    // ── 1. Workouts this week: completed sessions in current ISO calendar week ──
    const [[weekRow]] = await pool.query(`
      SELECT COUNT(DISTINCT id) AS workoutsThisWeek
      FROM workout_log_sessions
      WHERE user_id = ?
        AND status  = 'completed'
        AND YEARWEEK(workout_date, 1) = YEARWEEK(CURDATE(), 1)
    `, [userId]);

    // ── 2. Current streak: consecutive workout days ending today ──────────────
    // Fetch distinct completed workout dates for the last year, descending.
    const [datePairs] = await pool.query(`
      SELECT DISTINCT DATE(wl.WorkoutDate) AS wdate
      FROM workout_log wl
      LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
      WHERE wl.UserID = ?
        AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
        AND wl.WorkoutDate >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      ORDER BY wdate DESC
    `, [userId]);

    let streak = 0;
    if (datePairs.length > 0) {
      // Strict rule: streak > 0 only if today has a completed workout.
      const today     = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr  = today.toISOString().slice(0, 10);
      const firstDate = datePairs[0].wdate instanceof Date
        ? datePairs[0].wdate.toISOString().slice(0, 10)
        : String(datePairs[0].wdate).slice(0, 10);

      if (firstDate === todayStr) {
        // Walk backward through consecutive days
        let expected = new Date(today);
        for (const row of datePairs) {
          const d = row.wdate instanceof Date
            ? row.wdate.toISOString().slice(0, 10)
            : String(row.wdate).slice(0, 10);
          const expectedStr = expected.toISOString().slice(0, 10);
          if (d === expectedStr) {
            streak++;
            expected.setDate(expected.getDate() - 1);
          } else {
            break; // gap found
          }
        }
      }
      // If today has no workout, streak stays 0 (strict logic per spec).
    }

    // ── 3. Calories burned this week ──────────────────────────────────────────
    const [[calRow]] = await pool.query(`
      SELECT IFNULL(SUM(wl.Calories), 0) AS caloriesBurned
      FROM workout_log wl
      LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
      WHERE wl.UserID = ?
        AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
        AND YEARWEEK(wl.WorkoutDate, 1) = YEARWEEK(CURDATE(), 1)
    `, [userId]);

    return res.status(200).json({
      workoutsThisWeek: weekRow.workoutsThisWeek || 0,
      currentStreak:    streak,
      caloriesBurned:   Math.round(calRow.caloriesBurned || 0),
    });
  } catch (err) {
    console.error('❌ [progress/summary]', err);
    return res.status(500).json({ error: 'Failed to load progress summary.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/progress/chart
// Query params: startDate, endDate, groupBy, workoutType, exerciseId, metric
// Returns: [{ dateGroup, value, label }]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/chart', async (req, res) => {
  if (!requireAuth(req, res)) return;

  const userId = req.session.user.id;
  const range  = defaultDateRange();

  // ── Validate & extract params ─────────────────────────────────────────────
  let { startDate, endDate, groupBy, workoutType, exerciseId, metric } = req.query;

  startDate   = isValidDate(startDate)   ? startDate   : range.startDate;
  endDate     = isValidDate(endDate)     ? endDate     : range.endDate;
  groupBy     = VALID_GROUP_BY.has(groupBy)           ? groupBy     : 'day';
  workoutType = VALID_WORKOUT_TYPE.has((workoutType || '').toLowerCase())
    ? workoutType.toLowerCase() : 'all';

  const allowedMetrics = VALID_METRICS_BY_TYPE[workoutType] || VALID_METRICS_BY_TYPE['all'];
  if (!metric || !allowedMetrics.has(metric)) {
    // default metric per type
    metric = workoutType === 'strength' ? 'totalVolume'
           : workoutType === 'cardio'   ? 'duration'
           : workoutType === 'other'    ? 'duration'
           : 'calories';
  }

  // exerciseId must belong to this user's completed logs
  let safeExerciseId = null;
  if (exerciseId && /^\d+$/.test(exerciseId)) {
    const [[exCheck]] = await pool.query(`
      SELECT 1 FROM workout_log wl
      LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
      WHERE wl.UserID = ?
        AND wl.ExerciseID = ?
        AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
      LIMIT 1
    `, [userId, exerciseId]);
    if (exCheck) safeExerciseId = Number(exerciseId);
  }

  // ── Build GROUP BY expression and label format ───────────────────────────
  let groupExpr, labelExpr, orderExpr;
  if (groupBy === 'month') {
    groupExpr = `DATE_FORMAT(wl.WorkoutDate, '%Y-%m')`;
    labelExpr = `DATE_FORMAT(wl.WorkoutDate, '%b %Y')`;
    orderExpr = groupExpr;
  } else if (groupBy === 'year') {
    groupExpr = `YEAR(wl.WorkoutDate)`;
    labelExpr = `CAST(YEAR(wl.WorkoutDate) AS CHAR)`;
    orderExpr = `YEAR(wl.WorkoutDate)`;
  } else {
    // day (default)
    groupExpr = `DATE(wl.WorkoutDate)`;
    labelExpr = `DATE_FORMAT(wl.WorkoutDate, '%b %e')`;
    orderExpr = `DATE(wl.WorkoutDate)`;
  }

  // ── Build metric expression ───────────────────────────────────────────────
  let valueExpr;
  switch (metric) {
    case 'totalVolume':       valueExpr = 'IFNULL(SUM(wl.Sets * wl.Reps * wl.Weight), 0)'; break;
    case 'weight':            valueExpr = 'IFNULL(AVG(wl.Weight), 0)';                      break;
    case 'reps':              valueExpr = 'IFNULL(SUM(wl.Reps), 0)';                        break;
    case 'sets':              valueExpr = 'IFNULL(SUM(wl.Sets), 0)';                        break;
    case 'calories':          valueExpr = 'IFNULL(SUM(wl.Calories), 0)';                    break;
    case 'duration':          valueExpr = 'IFNULL(SUM(wl.Duration), 0)';                    break;
    case 'distance':          valueExpr = 'IFNULL(SUM(wl.Distance), 0)';                    break;
    case 'speed':             valueExpr = 'IFNULL(AVG(wl.Speed), 0)';                       break;
    case 'count':             valueExpr = 'COUNT(wl.WorkoutLogID)';                          break;
    case 'completedWorkouts': valueExpr = `COUNT(DISTINCT ${groupExpr})`;                    break;
    case 'completedExercises':valueExpr = 'COUNT(wl.WorkoutLogID)';                          break;
    default:                  valueExpr = 'IFNULL(SUM(wl.Calories), 0)';
  }

  // ── Build WHERE clauses ───────────────────────────────────────────────────
  const whereParts = [
    'wl.UserID = ?',
    '(wl.workout_log_session_id IS NULL OR wls.status = \'completed\')',
    'wl.WorkoutDate BETWEEN ? AND ?',
  ];
  const params = [userId, startDate, endDate];

  if (workoutType !== 'all') {
    whereParts.push('LOWER(wl.WorkoutType) = ?');
    params.push(workoutType);
  }
  if (safeExerciseId) {
    whereParts.push('wl.ExerciseID = ?');
    params.push(safeExerciseId);
  }

  const whereSQL = whereParts.join(' AND ');

  try {
    const [rows] = await pool.query(`
      SELECT
        ${groupExpr}  AS dateGroup,
        ${labelExpr}  AS label,
        ${valueExpr}  AS value
      FROM workout_log wl
      LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
      WHERE ${whereSQL}
      GROUP BY ${groupExpr}
      ORDER BY ${orderExpr} ASC
    `, params);

    const data = rows.map((r) => ({
      dateGroup: String(r.dateGroup),
      label:     String(r.label),
      value:     Number(r.value) || 0,
    }));

    return res.status(200).json(data);
  } catch (err) {
    console.error('❌ [progress/chart]', err);
    return res.status(500).json({ error: 'Failed to load chart data.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/progress/exercises
// Returns exercises completed by the logged-in user (for filter dropdown).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/exercises', async (req, res) => {
  if (!requireAuth(req, res)) return;

  const userId = req.session.user.id;

  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT
        ex.ExerciseID   AS exerciseId,
        ex.ExerciseTitle AS exerciseTitle,
        wl.WorkoutType
      FROM workout_log wl
      LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
      JOIN exercises ex ON wl.ExerciseID = ex.ExerciseID
      WHERE wl.UserID = ?
        AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
      ORDER BY ex.ExerciseTitle ASC
    `, [userId]);

    // De-duplicate by exerciseId (keep first WorkoutType encountered)
    const seen = new Set();
    const deduped = [];
    for (const r of rows) {
      if (!seen.has(r.exerciseId)) {
        seen.add(r.exerciseId);
        deduped.push({
          exerciseId:    r.exerciseId,
          exerciseTitle: r.exerciseTitle,
          workoutType:   r.WorkoutType || 'Strength',
        });
      }
    }

    return res.status(200).json(deduped);
  } catch (err) {
    console.error('❌ [progress/exercises]', err);
    return res.status(500).json({ error: 'Failed to load exercises.' });
  }
});

module.exports = router;
