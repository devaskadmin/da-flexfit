const express = require('express');
const router  = express.Router();
const pool    = require('../db.js');

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

module.exports = router;
