const express = require('express');
const router  = express.Router();
const pool    = require('../db.js');
const notificationService = require('../services/notificationService');

const sanitizeText = (value, maxLength = 500) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.slice(0, maxLength);
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toSetNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

// ─── Auth guard helper ──────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
};

// ─── NOTE: Uses the existing `workout_log_sessions` table.
// Required ALTER before deploying:
//   ALTER TABLE `workout_log_sessions`
//     ADD COLUMN `workout_day_id`   INT UNSIGNED NULL        AFTER `source_workout_schedule_id`,
//     ADD COLUMN `workout_day_name` VARCHAR(120) NOT NULL DEFAULT '' AFTER `workout_day_id`;

// ─── GET /api/workout-sessions/active ──────────────────────────────────────
// Returns the single in_progress session for the current user, if any.
router.get('/workout-sessions/active', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await pool.query(
      `SELECT
         id,
         user_id                    AS userId,
         source_workout_schedule_id AS workoutPlanId,
         workout_day_id             AS workoutDayId,
         workout_day_name           AS workoutDayName,
         workout_date               AS workoutDate,
         status                     AS sessionStatus,
         started_at                 AS startedAt,
         completed_at               AS completedAt
       FROM workout_log_sessions
       WHERE user_id = ? AND status = 'in_progress'
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ session: null });
    }

    return res.status(200).json({ session: rows[0] });
  } catch (err) {
    console.error('❌ GET /workout-sessions/active:', err);
    return res.status(500).json({ error: 'Failed to check active session.' });
  }
});

// ─── GET /api/workout-sessions/:sessionId/progress ─────────────────────────
// Returns persisted set-level progress for an in-progress/completed session.
router.get('/workout-sessions/:sessionId/progress', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = Number(req.params.sessionId || 0);

    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid sessionId.' });
    }

    const [sessionRows] = await pool.query(
      `SELECT id, source_workout_schedule_id AS workoutPlanId, status
       FROM workout_log_sessions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );

    if (!sessionRows.length) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const [rows] = await pool.query(
      `SELECT
         wl.WorkoutLogID                         AS workoutLogId,
         wl.ExerciseID                           AS exerciseId,
         wl.WorkoutType                          AS workoutType,
         wl.source_schedule_group_label          AS scheduleGroup,
         wl.source_workout_schedule_exercise_id  AS sourceScheduleExerciseId,
         wls.set_number                          AS setNumber,
         wls.reps                                AS reps,
         wls.weight                              AS weight,
         wls.duration_minutes                    AS duration,
         wls.calories_burned                     AS caloriesBurned,
         wls.distance_miles                      AS distanceMiles,
         wls.speed_mph                           AS speedMph,
         wls.notes                               AS notes,
         wls.completed                           AS completed,
         wls.completed_at                        AS completedAt,
         wls.updated_at                          AS updatedAt
       FROM workout_log wl
       INNER JOIN workout_log_sets wls ON wls.workout_log_id = wl.WorkoutLogID
       WHERE wl.workout_log_session_id = ?
         AND wl.UserID = ?
       ORDER BY wl.WorkoutLogID ASC, wls.set_number ASC`,
      [sessionId, userId]
    );

    return res.status(200).json({
      sessionId,
      workoutPlanId: sessionRows[0].workoutPlanId,
      sets: rows,
    });
  } catch (err) {
    console.error('❌ GET /workout-sessions/:sessionId/progress:', err);
    return res.status(500).json({ error: 'Failed to load session progress.' });
  }
});

// ─── POST /api/workout-sessions/start ──────────────────────────────────────
// Creates a new in_progress session.
// Returns 409 if user already has an in_progress session.
router.post('/workout-sessions/start', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { workoutPlanId, workoutDayId, workoutDayName, workoutDate } = req.body;

    if (!workoutPlanId || !workoutDayName || !workoutDate) {
      return res.status(400).json({
        error: 'workoutPlanId, workoutDayName, and workoutDate are required.',
      });
    }

    // Check for existing in_progress session
    const [existing] = await pool.query(
      `SELECT id,
              source_workout_schedule_id AS workoutPlanId,
              workout_day_name           AS workoutDayName
       FROM workout_log_sessions
       WHERE user_id = ? AND status = 'in_progress'
       LIMIT 1`,
      [userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'You already have a workout in progress. Please finish or end the current workout before starting another.',
        activeSession: existing[0],
      });
    }

    // Create new session
    const [result] = await pool.query(
      `INSERT INTO workout_log_sessions
         (user_id, source_workout_schedule_id, workout_day_id, workout_day_name, workout_date, status, started_at, notes)
       VALUES (?, ?, ?, ?, ?, 'in_progress', NOW(), '')`,
      [
        userId,
        Number(workoutPlanId),
        workoutDayId ? Number(workoutDayId) : null,
        String(workoutDayName).trim().substring(0, 120),
        workoutDate,
      ]
    );

    const sessionId = result.insertId;

    return res.status(201).json({
      message: 'Workout session started.',
      session: {
        id:             sessionId,
        userId,
        workoutPlanId:  Number(workoutPlanId),
        workoutDayId:   workoutDayId ? Number(workoutDayId) : null,
        workoutDayName: String(workoutDayName).trim(),
        workoutDate,
        sessionStatus:  'in_progress',
        startedAt:      new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('❌ POST /workout-sessions/start:', err);
    return res.status(500).json({ error: 'Failed to start workout session.' });
  }
});

// ─── POST /api/workout-sessions/:sessionId/set ─────────────────────────────
// Upserts a single set for immediate autosave when "Complete Set" is clicked.
router.post('/workout-sessions/:sessionId/set', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session.user.id;
    const sessionId = Number(req.params.sessionId || 0);

    const {
      workoutPlanId,
      workoutDate,
      exerciseId,
      exerciseName,
      exerciseInstanceId,
      scheduleGroup,
      workoutType,
      setNumber,
      reps,
      weight,
      duration,
      caloriesBurned,
      distanceMiles,
      speedMph,
      notes,
      completed,
      completedAt,
    } = req.body || {};

    const normalizedExerciseId = Number(exerciseId || 0);
    const normalizedSetNumber = toSetNumber(setNumber);

    if (!sessionId || !normalizedExerciseId || !normalizedSetNumber) {
      return res.status(400).json({ error: 'sessionId, exerciseId, and setNumber are required.' });
    }

    await connection.beginTransaction();

    const [[sessionRow]] = await connection.query(
      `SELECT
         id,
         user_id,
         source_workout_schedule_id AS sourceWorkoutScheduleId,
         workout_date               AS workoutDate,
         status
       FROM workout_log_sessions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );

    if (!sessionRow) {
      await connection.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }

    const sourceScheduleId = Number(workoutPlanId || sessionRow.sourceWorkoutScheduleId || 0) || null;
    const normalizedWorkoutDate = String(workoutDate || sessionRow.workoutDate || '').trim() || null;
    const normalizedScheduleGroup = sanitizeText(scheduleGroup || '', 120) || null;
    const normalizedWorkoutType = sanitizeText(workoutType || 'Strength', 50) || 'Strength';
    const normalizedExerciseName = sanitizeText(exerciseName || '', 255);
    const normalizedNotes = sanitizeText(notes || '', 1000) || null;
    const normalizedCompleted = Boolean(completed);
    const normalizedCompletedAt = normalizedCompleted
      ? (completedAt ? new Date(completedAt) : new Date())
      : null;

    let sourceScheduleExerciseId = null;
    const matchByEmbeddedId = String(exerciseInstanceId || '').match(/^wse-(\d+)$/i);
    if (matchByEmbeddedId && sourceScheduleId) {
      const candidateId = Number(matchByEmbeddedId[1] || 0);
      if (candidateId) {
        const [byIdRows] = await connection.query(
          `SELECT id
           FROM workout_schedule_exercises
           WHERE id = ? AND workout_schedule_id = ?
           LIMIT 1`,
          [candidateId, sourceScheduleId]
        );
        if (byIdRows.length > 0) {
          sourceScheduleExerciseId = byIdRows[0].id;
        }
      }
    }

    if (!sourceScheduleExerciseId && sourceScheduleId) {
      const [byExerciseRows] = await connection.query(
        `SELECT id
         FROM workout_schedule_exercises
         WHERE workout_schedule_id = ? AND exercise_id = ?
         ORDER BY sort_order ASC, id ASC
         LIMIT 1`,
        [sourceScheduleId, normalizedExerciseId]
      );
      if (byExerciseRows.length > 0) {
        sourceScheduleExerciseId = byExerciseRows[0].id;
      }
    }

    let existingLogRow = null;
    if (sourceScheduleExerciseId) {
      const [rowsByScheduleExercise] = await connection.query(
        `SELECT WorkoutLogID
         FROM workout_log
         WHERE workout_log_session_id = ?
           AND UserID = ?
           AND source_workout_schedule_exercise_id = ?
         ORDER BY WorkoutLogID ASC
         LIMIT 1`,
        [sessionId, userId, sourceScheduleExerciseId]
      );
      existingLogRow = rowsByScheduleExercise[0] || null;
    }

    if (!existingLogRow) {
      const [rowsByExercise] = await connection.query(
        `SELECT WorkoutLogID
         FROM workout_log
         WHERE workout_log_session_id = ?
           AND UserID = ?
           AND ExerciseID = ?
           AND (source_schedule_group_label <=> ?)
         ORDER BY WorkoutLogID ASC
         LIMIT 1`,
        [sessionId, userId, normalizedExerciseId, normalizedScheduleGroup]
      );
      existingLogRow = rowsByExercise[0] || null;
    }

    let workoutLogId = Number(existingLogRow?.WorkoutLogID || 0);
    if (!workoutLogId) {
      const [insertLogResult] = await connection.query(
        `INSERT INTO workout_log
          (
            workout_log_session_id,
            UserID,
            ExerciseID,
            source_workout_schedule_id,
            source_workout_schedule_exercise_id,
            source_schedule_group_label,
            WorkoutDate,
            performed_at,
            WorkoutType,
            Duration,
            Reps,
            Sets,
            Weight
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, 0, 0, 0, 0)`,
        [
          sessionId,
          userId,
          normalizedExerciseId,
          sourceScheduleId,
          sourceScheduleExerciseId,
          normalizedScheduleGroup,
          normalizedWorkoutDate,
          normalizedWorkoutType,
        ]
      );
      workoutLogId = insertLogResult.insertId;
    }

    await connection.query(
      `UPDATE workout_log
       SET source_workout_schedule_id = COALESCE(?, source_workout_schedule_id),
           source_workout_schedule_exercise_id = COALESCE(?, source_workout_schedule_exercise_id),
           source_schedule_group_label = COALESCE(?, source_schedule_group_label),
           WorkoutType = COALESCE(?, WorkoutType),
           WorkoutDate = COALESCE(?, WorkoutDate),
           performed_at = NOW()
       WHERE WorkoutLogID = ? AND UserID = ?`,
      [
        sourceScheduleId,
        sourceScheduleExerciseId,
        normalizedScheduleGroup,
        normalizedWorkoutType,
        normalizedWorkoutDate,
        workoutLogId,
        userId,
      ]
    );

    await connection.query(
      `INSERT INTO workout_log_sets
        (
          workout_log_id,
          set_number,
          reps,
          weight,
          duration_minutes,
          calories_burned,
          distance_miles,
          speed_mph,
          notes,
          completed,
          completed_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reps             = VALUES(reps),
         weight           = VALUES(weight),
         duration_minutes = VALUES(duration_minutes),
         calories_burned  = VALUES(calories_burned),
         distance_miles   = VALUES(distance_miles),
         speed_mph        = VALUES(speed_mph),
         notes            = VALUES(notes),
         completed        = VALUES(completed),
         completed_at     = VALUES(completed_at),
         updated_at       = CURRENT_TIMESTAMP`,
      [
        workoutLogId,
        normalizedSetNumber,
        toNumberOrNull(reps),
        toNumberOrNull(weight),
        toNumberOrNull(duration),
        toNumberOrNull(caloriesBurned),
        toNumberOrNull(distanceMiles),
        toNumberOrNull(speedMph),
        normalizedNotes,
        normalizedCompleted ? 1 : 0,
        normalizedCompletedAt,
      ]
    );

    const [aggregateRows] = await connection.query(
      `SELECT
         COUNT(*)                                         AS totalSets,
         AVG(COALESCE(weight, 0))                         AS avgWeight,
         AVG(COALESCE(reps, 0))                           AS avgReps,
         SUM(COALESCE(duration_minutes, 0))               AS totalDuration,
         SUM(COALESCE(calories_burned, 0))                AS totalCalories,
         AVG(COALESCE(distance_miles, 0))                 AS avgDistance,
         AVG(COALESCE(speed_mph, 0))                      AS avgSpeed
       FROM workout_log_sets
       WHERE workout_log_id = ?
         AND completed = 1`,
      [workoutLogId]
    );

    const aggregates = aggregateRows[0] || {};

    await connection.query(
      `UPDATE workout_log
       SET Weight   = ?,
           Reps     = ?,
           Sets     = ?,
           Duration = ?,
           Calories = ?,
           Distance = ?,
           Speed    = ?,
           performed_at = NOW()
       WHERE WorkoutLogID = ? AND UserID = ?`,
      [
        Math.round(Number(aggregates.avgWeight || 0)),
        Math.round(Number(aggregates.avgReps || 0)),
        Number(aggregates.totalSets || 0),
        Math.round(Number(aggregates.totalDuration || 0)),
        Number(aggregates.totalCalories || 0),
        Number(aggregates.avgDistance || 0),
        Number(aggregates.avgSpeed || 0),
        workoutLogId,
        userId,
      ]
    );

    await connection.commit();

    return res.status(200).json({
      message: 'Set autosaved successfully.',
      sessionId,
      workoutLogId,
      exerciseId: normalizedExerciseId,
      exerciseName: normalizedExerciseName || null,
      setNumber: normalizedSetNumber,
      completed: normalizedCompleted,
      completedAt: normalizedCompletedAt,
      userId,
    });
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    console.error('❌ POST /workout-sessions/:sessionId/set:', err);
    return res.status(500).json({ error: 'Failed to autosave workout set.' });
  } finally {
    connection.release();
  }
});

// ─── POST /api/workout-sessions/complete/:sessionId ────────────────────────
// Marks a session as completed.
router.post('/workout-sessions/complete/:sessionId', requireAuth, async (req, res) => {
  try {
    const userId    = req.session.user.id;
    const sessionId = Number(req.params.sessionId);

    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid sessionId.' });
    }

    const [rows] = await pool.query(
      `SELECT id FROM workout_log_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
      [sessionId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    await pool.query(
      `UPDATE workout_log_sessions
       SET status = 'completed', completed_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [sessionId, userId]
    );

    // Check for progress milestones (best-effort, does not affect response)
    try {
      const MILESTONES = [1, 10, 25, 50, 100, 250, 500];
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM workout_log_sessions WHERE user_id = ? AND status = 'completed'`,
        [userId]
      );
      const total = Number(countRow?.total || 0);
      if (MILESTONES.includes(total)) {
        const milestoneMsg = total === 1
          ? 'You completed your first workout!'
          : `You completed ${total} workouts!`;
        await notificationService.createProgressNotification(userId, milestoneMsg);
      }
    } catch { /* best-effort — milestone check must never break the response */ }

    return res.status(200).json({ message: 'Workout session completed.' });
  } catch (err) {
    console.error('❌ POST /workout-sessions/complete:', err);
    return res.status(500).json({ error: 'Failed to complete workout session.' });
  }
});

// ─── POST /api/workout-sessions/cancel/:sessionId ──────────────────────────
// Cancels (ends without completing) a session.
router.post('/workout-sessions/cancel/:sessionId', requireAuth, async (req, res) => {
  try {
    const userId    = req.session.user.id;
    const sessionId = Number(req.params.sessionId);

    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid sessionId.' });
    }

    await pool.query(
      `UPDATE workout_log_sessions
       SET status = 'cancelled', completed_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [sessionId, userId]
    );

    return res.status(200).json({ message: 'Workout session cancelled.' });
  } catch (err) {
    console.error('❌ POST /workout-sessions/cancel:', err);
    return res.status(500).json({ error: 'Failed to cancel workout session.' });
  }
});

// ─── GET /api/workouts/history/latest/:exerciseId ─────────────────────────
// Returns the most recent completed workout-set values for a specific exercise.
router.get('/workouts/history/latest/:exerciseId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const exerciseId = Number(req.params.exerciseId || 0);

    if (!exerciseId) {
      return res.status(400).json({ error: 'Invalid exerciseId.' });
    }

    const [latestRows] = await pool.query(
      `SELECT
         wl.WorkoutLogID                 AS workoutLogId,
         wl.ExerciseID                   AS exerciseId,
         wl.WorkoutDate                  AS workoutDate,
         wls.workout_date                AS sessionWorkoutDate,
         wls.completed_at                AS completedAt
       FROM workout_log wl
       INNER JOIN workout_log_sessions wls ON wls.id = wl.workout_log_session_id
       WHERE wl.UserID = ?
         AND wl.ExerciseID = ?
         AND wls.status = 'completed'
       ORDER BY wls.workout_date DESC, wls.completed_at DESC, wl.WorkoutLogID DESC
       LIMIT 1`,
      [userId, exerciseId]
    );

    if (!latestRows.length) {
      return res.status(200).json({
        exerciseId,
        lastPerformed: null,
        sets: [],
      });
    }

    const latest = latestRows[0];

    const [setRows] = await pool.query(
      `SELECT
         set_number       AS setNumber,
         weight,
         reps,
         duration_minutes AS duration,
         distance_miles   AS distance,
         calories_burned  AS calories,
         speed_mph        AS speed
       FROM workout_log_sets
       WHERE workout_log_id = ?
         AND completed = 1
       ORDER BY set_number ASC`,
      [latest.workoutLogId]
    );

    return res.status(200).json({
      exerciseId,
      lastPerformed: latest.sessionWorkoutDate || latest.workoutDate || null,
      sets: setRows,
    });
  } catch (err) {
    console.error('❌ GET /workouts/history/latest/:exerciseId:', err);
    return res.status(500).json({ error: 'Failed to fetch latest workout history.' });
  }
});

module.exports = router;
