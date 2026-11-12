const express = require('express');
const router  = express.Router();
const pool    = require('../db.js');
const { sanitizeText } = require('../utils/sanitize.js');

const parseDraftPayload = (notes) => {
  if (!notes) return null;
  if (typeof notes === 'object') return notes;
  if (typeof notes !== 'string') return null;

  try {
    return JSON.parse(notes);
  } catch (_) {
    return null;
  }
};

const getDraftExerciseCount = (notes) => {
  const draft = parseDraftPayload(notes);
  return Array.isArray(draft?.exercises) ? draft.exercises.length : 0;
};

const normalizeSessionStatus = (session) => String(session?.sessionStatus || session?.status || '').trim().toLowerCase();

const isLiveSessionStatus = (status) =>
  status === 'in_progress' || status === 'in-progress' || status === 'active' || status === 'paused';

const normalizeSessionIds = (values) => Array.from(new Set(
  (Array.isArray(values) ? values : [])
    .map((value) => Number(value || 0))
    .filter((value) => Number.isInteger(value) && value > 0)
)).sort((left, right) => left - right);

const sessionIdSetsMatch = (left, right) => {
  const normalizedLeft = normalizeSessionIds(left);
  const normalizedRight = normalizeSessionIds(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const enrichSessionForConflict = async ({ connection, userId, session }) => {
  const normalized = {
    ...session,
    workoutPlanId: Number(session?.workoutPlanId || 0) || null,
    workoutDayId: session?.workoutDayId != null ? Number(session.workoutDayId) : null,
    workoutDayName: String(session?.workoutDayName || '').trim(),
  };

  const status = normalizeSessionStatus(normalized);
  const draftExerciseCount = getDraftExerciseCount(normalized.notes);
  const canResumeFromDraft = draftExerciseCount > 0;

  let orphanReason = null;
  let planAccessible = false;
  let planExists = false;
  let dayReferenceValid = true;

  if (!normalized.workoutPlanId) {
    orphanReason = 'missing_plan_reference';
  } else {
    const [planRows] = await connection.query(
      `SELECT id, user_id
       FROM workout_schedules
       WHERE id = ?
       LIMIT 1`,
      [normalized.workoutPlanId]
    );

    if (!planRows.length) {
      orphanReason = 'missing_plan';
    } else {
      planExists = true;
      const ownerId = Number(planRows[0]?.user_id || 0);
      if (ownerId !== Number(userId || 0)) {
        orphanReason = 'inaccessible_plan';
      } else {
        planAccessible = true;
      }
    }

    if (planAccessible) {
      if (normalized.workoutDayId) {
        const [groupByIdRows] = await connection.query(
          `SELECT id, label
           FROM workout_schedule_groups
           WHERE id = ? AND workout_schedule_id = ?
           LIMIT 1`,
          [normalized.workoutDayId, normalized.workoutPlanId]
        );

        if (!groupByIdRows.length) {
          dayReferenceValid = false;
        }
      }

      if (!dayReferenceValid && normalized.workoutDayName) {
        const [groupByLabelRows] = await connection.query(
          `SELECT id, label
           FROM workout_schedule_groups
           WHERE workout_schedule_id = ?
             AND LOWER(label) = LOWER(?)
           LIMIT 1`,
          [normalized.workoutPlanId, normalized.workoutDayName]
        );

        if (groupByLabelRows.length) {
          dayReferenceValid = true;
        }
      }

      if (!dayReferenceValid) {
        orphanReason = orphanReason || 'missing_day_reference';
      }
    }
  }

  const isOrphaned = Boolean(orphanReason);

  return {
    ...normalized,
    planExists,
    planAccessible,
    dayReferenceValid,
    isOrphaned,
    orphanReason,
    draftExerciseCount,
    canResumeFromDraft,
    continuationPossible: !isOrphaned || canResumeFromDraft,
    isLive: isLiveSessionStatus(status),
  };
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
// Returns the most recent in_progress session for the current user, if any.
router.get('/workout-sessions/active', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session.user.id;

    const [rows] = await connection.query(
      `SELECT
         id,
         user_id                    AS userId,
         source_workout_schedule_id AS workoutPlanId,
         workout_day_id             AS workoutDayId,
         workout_day_name           AS workoutDayName,
         workout_date               AS workoutDate,
         status                     AS sessionStatus,
         started_at                 AS startedAt,
         ended_at                   AS endedAt,
         duration_seconds           AS durationSeconds,
         completed_at               AS completedAt,
         notes                      AS notes
       FROM workout_log_sessions
       WHERE user_id = ? AND status = 'in_progress'
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ session: null });
    }

    const session = await enrichSessionForConflict({ connection, userId, session: rows[0] });

    return res.status(200).json({ session });
  } catch (err) {
    console.error('❌ GET /workout-sessions/active:', err);
    return res.status(500).json({ error: 'Failed to check active session.' });
  } finally {
    connection.release();
  }
});

// ─── GET /api/workout-sessions/in-progress ────────────────────────────────
// Returns all in_progress sessions for the current user (newest first).
router.get('/workout-sessions/in-progress', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session.user.id;

    const [rows] = await connection.query(
      `SELECT
         id,
         user_id                    AS userId,
         source_workout_schedule_id AS workoutPlanId,
         workout_day_id             AS workoutDayId,
         workout_day_name           AS workoutDayName,
         workout_date               AS workoutDate,
         status                     AS sessionStatus,
         started_at                 AS startedAt,
         ended_at                   AS endedAt,
         duration_seconds           AS durationSeconds,
         completed_at               AS completedAt,
         notes                      AS notes
       FROM workout_log_sessions
       WHERE user_id = ? AND status = 'in_progress'
       ORDER BY started_at DESC, id DESC`,
      [userId]
    );

    const sessions = [];
    for (const row of rows) {
      sessions.push(await enrichSessionForConflict({ connection, userId, session: row }));
    }

    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('❌ GET /workout-sessions/in-progress:', err);
    return res.status(500).json({ error: 'Failed to load active workout sessions.' });
  } finally {
    connection.release();
  }
});

// ─── POST /api/workout-sessions/start ──────────────────────────────────────
// Creates a new in_progress session.
router.post('/workout-sessions/start', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session.user.id;
    const {
      workoutPlanId,
      workoutDayId,
      workoutDayName,
      workoutDate,
      endSessionIds,
      confirmMultipleEnd,
    } = req.body;

    if (!workoutPlanId || !workoutDayName || !workoutDate) {
      return res.status(400).json({
        error: 'workoutPlanId, workoutDayName, and workoutDate are required.',
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `SELECT id FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );

    const [activeRows] = await connection.query(
      `SELECT
         id,
         user_id                    AS userId,
         source_workout_schedule_id AS workoutPlanId,
         workout_day_id             AS workoutDayId,
         workout_day_name           AS workoutDayName,
         workout_date               AS workoutDate,
         status                     AS sessionStatus,
         started_at                 AS startedAt,
         ended_at                   AS endedAt,
         duration_seconds           AS durationSeconds,
         completed_at               AS completedAt,
         notes                      AS notes
       FROM workout_log_sessions
       WHERE user_id = ? AND status = 'in_progress'
       ORDER BY started_at DESC, id DESC
       FOR UPDATE`,
      [userId]
    );

    const requestedEndIds = normalizeSessionIds(endSessionIds);
    const activeSessionIds = normalizeSessionIds(activeRows.map((session) => session.id));

    if (activeRows.length && requestedEndIds.length === 0) {
      const activeSessions = [];
      for (const row of activeRows) {
        activeSessions.push(await enrichSessionForConflict({ connection, userId, session: row }));
      }
      await connection.rollback();
      return res.status(409).json({
        code: 'WORKOUT_SESSION_CONFLICT',
        error: 'You have an unfinished workout.',
        activeSessions,
      });
    }

    if (requestedEndIds.length > 0 && !sessionIdSetsMatch(requestedEndIds, activeSessionIds)) {
      const activeSessions = [];
      for (const row of activeRows) {
        activeSessions.push(await enrichSessionForConflict({ connection, userId, session: row }));
      }
      await connection.rollback();
      return res.status(409).json({
        code: 'STALE_WORKOUT_SESSION_CONFLICT',
        error: 'Your unfinished workouts changed. Review the current sessions before starting a new workout.',
        activeSessions,
      });
    }

    if (requestedEndIds.length > 1 && confirmMultipleEnd !== true) {
      await connection.rollback();
      return res.status(409).json({
        code: 'MULTIPLE_WORKOUT_CONFIRMATION_REQUIRED',
        error: 'Explicit confirmation is required before ending multiple unfinished workouts.',
        activeSessions: activeRows,
      });
    }

    for (const sessionId of requestedEndIds) {
      const [endResult] = await connection.query(
        `UPDATE workout_log_sessions
         SET status = 'ended',
             ended_at = NOW(),
             completed_at = COALESCE(completed_at, NOW()),
             duration_seconds = CASE
               WHEN started_at IS NULL THEN 0
               ELSE GREATEST(TIMESTAMPDIFF(SECOND, started_at, NOW()), 0)
             END
         WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
        [sessionId, userId]
      );

      if (Number(endResult?.affectedRows || 0) !== 1) {
        await connection.rollback();
        return res.status(409).json({
          code: 'STALE_WORKOUT_SESSION_CONFLICT',
          error: 'An unfinished workout changed before it could be ended. No new workout was started.',
        });
      }
    }

    // Create new session
    const [result] = await connection.query(
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

    await connection.commit();

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
        endedAt:        null,
        durationSeconds: 0,
        completedAt:    null,
        notes:          '',
      },
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    console.error('❌ POST /workout-sessions/start:', err);
    return res.status(500).json({ error: 'Failed to start workout session.' });
  } finally {
    connection.release();
  }
});

// ─── POST /api/workout-sessions/:sessionId/end ───────────────────────────
// Ends a user's active session without deleting history so a new workout can start.
router.post('/workout-sessions/:sessionId/end', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session.user.id;
    const sessionId = Number(req.params.sessionId || 0);

    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid sessionId.' });
    }

    await connection.beginTransaction();

    await connection.query(
      `SELECT id FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );

    const [rows] = await connection.query(
      `SELECT id, status
       FROM workout_log_sessions
       WHERE id = ? AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [sessionId, userId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }

    const status = normalizeSessionStatus(rows[0]);
    if (status !== 'in_progress' && status !== 'in-progress' && status !== 'active' && status !== 'paused') {
      await connection.rollback();
      return res.status(409).json({ error: 'Session is not active.' });
    }

    await connection.query(
      `UPDATE workout_log_sessions
       SET status = 'ended',
           ended_at = NOW(),
           completed_at = COALESCE(completed_at, NOW()),
           duration_seconds = CASE
             WHEN started_at IS NULL THEN 0
             ELSE GREATEST(TIMESTAMPDIFF(SECOND, started_at, NOW()), 0)
           END
       WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
      [sessionId, userId]
    );

    await connection.commit();

    return res.status(200).json({
      message: 'Workout session ended.',
      endedSessionId: sessionId,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    console.error('❌ POST /workout-sessions/:sessionId/end:', err);
    return res.status(500).json({ error: 'Failed to end workout session.' });
  } finally {
    connection.release();
  }
});

// ─── PUT /api/workout-sessions/:sessionId/draft ────────────────────────────
// Saves the current in-progress workout state for restore after navigation.
router.put('/workout-sessions/:sessionId/draft', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = Number(req.params.sessionId);
    const draftExercises = Array.isArray(req.body?.exercises) ? req.body.exercises : null;

    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid sessionId.' });
    }

    if (!draftExercises) {
      return res.status(400).json({ error: 'Draft exercises are required.' });
    }

    const draftNotes = JSON.stringify({
      version: 1,
      exercises: draftExercises,
      updatedAt: new Date().toISOString(),
    });

    const [result] = await pool.query(
      `UPDATE workout_log_sessions
       SET notes = ?
       WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
      [draftNotes, sessionId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Active workout session not found.' });
    }

    return res.status(200).json({ message: 'Workout draft saved.' });
  } catch (err) {
    console.error('❌ PUT /workout-sessions/:sessionId/draft:', err);
    return res.status(500).json({ error: 'Failed to save workout draft.' });
  }
});

// ─── POST /api/workout-sessions/active/add-exercise ────────────────────────
// Adds an exercise from the existing exercise DB into the authenticated user's
// active workout day and persists it to the user's workout plan copy.
router.post('/workout-sessions/active/add-exercise', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.session.user.id || 0);
    const exerciseId = Number(req.body?.exerciseId || 0);
    const sessionId = Number(req.body?.sessionId || 0) || null;

    if (!exerciseId) {
      return res.status(400).json({ error: 'exerciseId is required.' });
    }

    const [activeRows] = sessionId
      ? await connection.query(
          `SELECT
             id,
             source_workout_schedule_id AS workoutPlanId,
             workout_day_id             AS workoutDayId,
             workout_day_name           AS workoutDayName,
             status
           FROM workout_log_sessions
           WHERE id = ? AND user_id = ? AND status = 'in_progress'
           LIMIT 1`,
          [sessionId, userId]
        )
      : await connection.query(
          `SELECT
             id,
             source_workout_schedule_id AS workoutPlanId,
             workout_day_id             AS workoutDayId,
             workout_day_name           AS workoutDayName,
             status
           FROM workout_log_sessions
           WHERE user_id = ? AND status = 'in_progress'
           ORDER BY started_at DESC
           LIMIT 1`,
          [userId]
        );

    if (!activeRows.length) {
      return res.status(404).json({ error: 'Active in-progress workout session not found for this user.' });
    }

    const activeSession = activeRows[0] || {};
    const workoutPlanId = Number(activeSession.workoutPlanId || 0);
    const activeDayId = activeSession.workoutDayId != null ? Number(activeSession.workoutDayId) : null;
    const activeDayName = String(activeSession.workoutDayName || '').trim();

    if (!workoutPlanId || !activeDayName) {
      return res.status(400).json({ error: 'Active workout session is missing plan/day context.' });
    }

    const [scheduleRows] = await connection.query(
      `SELECT id, user_id
       FROM workout_schedules
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [workoutPlanId, userId]
    );

    if (!scheduleRows.length) {
      return res.status(404).json({ error: 'Active workout plan not found for this user.' });
    }

    let groupRow = null;
    if (activeDayId) {
      const [rowsById] = await connection.query(
        `SELECT id, label
         FROM workout_schedule_groups
         WHERE id = ? AND workout_schedule_id = ?
         LIMIT 1`,
        [activeDayId, workoutPlanId]
      );
      groupRow = rowsById[0] || null;
    }

    if (!groupRow) {
      const [rowsByLabel] = await connection.query(
        `SELECT id, label
         FROM workout_schedule_groups
         WHERE workout_schedule_id = ? AND LOWER(label) = LOWER(?)
         ORDER BY sort_order ASC, id ASC
         LIMIT 1`,
        [workoutPlanId, activeDayName]
      );
      groupRow = rowsByLabel[0] || null;
    }

    if (!groupRow) {
      return res.status(400).json({ error: 'Unable to resolve the active workout day for this plan.' });
    }

    const [exerciseRows] = await connection.query(
      `SELECT
         ExerciseID,
         ExerciseTitle,
         ImageURL,
         WorkoutType,
         MuscleGroup,
         Equipment
       FROM exercises
       WHERE ExerciseID = ?
       LIMIT 1`,
      [exerciseId]
    );

    if (!exerciseRows.length) {
      return res.status(404).json({ error: 'Exercise not found in Exercise Database.' });
    }

    const exercise = exerciseRows[0] || {};
    const normalizedWorkoutType = String(exercise.WorkoutType || '').trim().toLowerCase();
    const isCardio = normalizedWorkoutType === 'cardio';

    const [sortRows] = await connection.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS maxSortOrder
       FROM workout_schedule_exercises
       WHERE workout_schedule_id = ? AND workout_schedule_group_id = ?`,
      [workoutPlanId, Number(groupRow.id)]
    );
    const nextSortOrder = Number(sortRows?.[0]?.maxSortOrder || 0) + 1;

    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      `INSERT INTO workout_schedule_exercises
        (
          workout_schedule_id,
          workout_schedule_group_id,
          exercise_id,
          exercise_name,
          exercise_image_url,
          workout_type,
          muscle_group,
          equipment,
          sort_order,
          notes,
          target_sets,
          target_reps,
          target_weight,
          target_duration_minutes,
          target_rest_seconds
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workoutPlanId,
        Number(groupRow.id),
        Number(exercise.ExerciseID),
        sanitizeText(exercise.ExerciseTitle || '', 150),
        sanitizeText(exercise.ImageURL || '', 255),
        sanitizeText(exercise.WorkoutType || 'Strength', 50),
        sanitizeText(exercise.MuscleGroup || '', 80),
        sanitizeText(exercise.Equipment || '', 80),
        nextSortOrder,
        '',
        isCardio ? 1 : 3,
        isCardio ? 0 : 10,
        0,
        isCardio ? 20 : 0,
        isCardio ? 0 : 60,
      ]
    );

    await connection.query(
      `UPDATE workout_schedules
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [workoutPlanId, userId]
    );

    await connection.commit();

    const insertedId = Number(insertResult?.insertId || 0);

    return res.status(201).json({
      message: 'Exercise added to active workout day and saved to your workout plan.',
      exercise: {
        id: `wse-${insertedId}`,
        exerciseId: Number(exercise.ExerciseID),
        name: String(exercise.ExerciseTitle || '').trim(),
        image: String(exercise.ImageURL || '').trim(),
        workoutType: String(exercise.WorkoutType || 'Strength').trim(),
        muscleGroup: String(exercise.MuscleGroup || '').trim(),
        equipment: String(exercise.Equipment || '').trim(),
        sets: isCardio ? 1 : 3,
        reps: isCardio ? 0 : 10,
        weight: 0,
        duration: isCardio ? 20 : 0,
        distance: 0,
        restTime: isCardio ? 0 : 60,
        notes: '',
        scheduleGroup: String(groupRow.label || activeDayName).trim() || activeDayName,
        sortOrder: nextSortOrder,
      },
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    console.error('❌ POST /workout-sessions/active/add-exercise:', err);
    return res.status(500).json({ error: 'Failed to add exercise to active workout.' });
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
      `SELECT id, started_at AS startedAt
       FROM workout_log_sessions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    await pool.query(
      `UPDATE workout_log_sessions
       SET status = 'completed',
           ended_at = NOW(),
           completed_at = NOW(),
           duration_seconds = CASE
             WHEN started_at IS NULL THEN 0
             ELSE GREATEST(TIMESTAMPDIFF(SECOND, started_at, NOW()), 0)
           END
       WHERE id = ? AND user_id = ?`,
      [sessionId, userId]
    );

    const [[session]] = await pool.query(
      `SELECT
         id,
         user_id                    AS userId,
         source_workout_schedule_id AS workoutPlanId,
         workout_day_id             AS workoutDayId,
         workout_day_name           AS workoutDayName,
         workout_date               AS workoutDate,
         status                     AS sessionStatus,
         started_at                 AS startedAt,
         ended_at                   AS endedAt,
         duration_seconds           AS durationSeconds,
         completed_at               AS completedAt
       FROM workout_log_sessions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );

    return res.status(200).json({ message: 'Workout session completed.', session });
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

    const [rows] = await pool.query(
      `SELECT id
       FROM workout_log_sessions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    await pool.query(
      `UPDATE workout_log_sessions
       SET status = 'ended',
           ended_at = NOW(),
           completed_at = NOW(),
           duration_seconds = CASE
             WHEN started_at IS NULL THEN 0
             ELSE GREATEST(TIMESTAMPDIFF(SECOND, started_at, NOW()), 0)
           END
       WHERE id = ? AND user_id = ?`,
      [sessionId, userId]
    );

    const [[session]] = await pool.query(
      `SELECT
         id,
         user_id                    AS userId,
         source_workout_schedule_id AS workoutPlanId,
         workout_day_id             AS workoutDayId,
         workout_day_name           AS workoutDayName,
         workout_date               AS workoutDate,
         status                     AS sessionStatus,
         started_at                 AS startedAt,
         ended_at                   AS endedAt,
         duration_seconds           AS durationSeconds,
         completed_at               AS completedAt
       FROM workout_log_sessions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );

    return res.status(200).json({ message: 'Workout session ended.', session });
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
module.exports._private = {
  parseDraftPayload,
  getDraftExerciseCount,
  normalizeSessionIds,
  sessionIdSetsMatch,
};
