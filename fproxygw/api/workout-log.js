const express = require('express');
const router = express.Router();

// ✅ DB Connect
const pool = require('../db.js');
const { sanitizeText } = require('../utils/sanitize.js');

const buildNormalizedGroupOrder = (builderOrder = [], preferredOrder = []) => {
  const normalizedBuilder = Array.isArray(builderOrder)
    ? builderOrder.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const preferredKeys = new Set();
  const ordered = [];

  for (const value of Array.isArray(preferredOrder) ? preferredOrder : []) {
    const label = String(value || '').trim();
    const key = label.toLowerCase();
    if (!label || preferredKeys.has(key)) {
      continue;
    }

    if (normalizedBuilder.some((group) => group.toLowerCase() === key)) {
      preferredKeys.add(key);
      ordered.push(label);
    }
  }

  for (const value of normalizedBuilder) {
    const key = value.toLowerCase();
    if (!preferredKeys.has(key)) {
      preferredKeys.add(key);
      ordered.push(value);
    }
  }

  return ordered;
};

const getWorkoutLogDayOrdering = async (userId, planId) => {
  const [[scheduleRow]] = await pool.query(
    `SELECT id, use_custom_workout_log_order
     FROM workout_schedules
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [planId, userId]
  );

  if (!scheduleRow) {
    return null;
  }

  const [groupRows] = await pool.query(
    `SELECT label, sort_order, workout_log_display_order
     FROM workout_schedule_groups
     WHERE workout_schedule_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [planId]
  );

  const builderOrder = groupRows
    .map((row) => String(row?.label || '').trim())
    .filter(Boolean);

  const customOrder = groupRows
    .filter((row) => Number(row?.workout_log_display_order || 0) > 0)
    .sort((left, right) => {
      const leftOrder = Number(left?.workout_log_display_order || 0);
      const rightOrder = Number(right?.workout_log_display_order || 0);
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return Number(left?.sort_order || 0) - Number(right?.sort_order || 0);
    })
    .map((row) => String(row?.label || '').trim())
    .filter(Boolean);

  const useCustomWorkoutLogOrder = Number(scheduleRow.use_custom_workout_log_order || 0) === 1;
  const orderedGroups = useCustomWorkoutLogOrder
    ? buildNormalizedGroupOrder(builderOrder, customOrder)
    : [...builderOrder];

  return {
    planId: String(planId),
    useCustomWorkoutLogOrder,
    builderOrder,
    customOrder,
    orderedGroups,
  };
};





//Saves Workout Log
  router.post('/workout-log', async (req, res) => {
    try {
      const { ExerciseTitle, ExerciseType, Reps, Sets, Weight, Duration, WorkoutDate } = req.body;
  
      if (!req.session || !req.session.user || !req.session.user.id) {
        return res.status(401).json({ error: "Unauthorized. Please log in." });
      }
  
      const userID = req.session.user.id;
  
      // Lookup ExerciseID from title
      const [exercise] = await pool.query('SELECT ExerciseID FROM exercises WHERE ExerciseTitle = ?', [ExerciseTitle]);
  
      if (exercise.length === 0) {
        return res.status(404).json({ error: 'Exercise not found' });
      }
  
      const exerciseID = exercise[0].ExerciseID;
  
      // Insert into workout_log
      await pool.query(
        `INSERT INTO workout_log 
          (UserID, ExerciseID, WorkoutDate, WorkoutType, Reps, Sets, Weight, Duration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userID,
          exerciseID,
          WorkoutDate,
          sanitizeText(ExerciseType || 'Strength'),
          Reps,
          Sets,
          Weight,
          Duration,
        ]
      );
  
      res.status(201).json({ message: 'Workout log saved successfully' });
    } catch (err) {
      console.error("❌ Failed to log workout:", err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });





  // ✅ POST: Saves workout log by date
router.post('/add-workout-log', async (req, res) => {
  const {
    UserID, ExerciseID, WorkoutDate, WorkoutType,
    Duration, Reps, Sets, Weight, Calories, Distance, Speed, ['Laps-Rep']: LapsRep
  } = req.body;

  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const currentUserId = req.session.user.id;

  try {
    const [result] = await pool.query(`
      INSERT INTO workout_log 
      (UserID, ExerciseID, WorkoutDate, WorkoutType, Duration, Reps, Sets, Weight, Calories, Distance, Speed, \`Laps-Rep\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      currentUserId, ExerciseID, WorkoutDate, WorkoutType,
      Duration, Reps, Sets, Weight, Calories, Distance, Speed, LapsRep
    ]);

    res.status(200).json({ message: 'Workout log saved', logId: result.insertId });
  } catch (err) {
    console.error('❌ DB Error:', err);
    res.status(500).json({ error: 'Failed to save workout log.' });
  }
});


router.get('/workout-check-exists', async (req, res) => {
  const { exerciseId, date } = req.query;

  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  if (!exerciseId || !date) {
    return res.status(400).json({ error: 'Missing exerciseId or date' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM workout_log WHERE UserID = ? AND ExerciseID = ? AND WorkoutDate = ? LIMIT 1`,
      [req.session.user.id, exerciseId, date]
    );

    res.status(200).json({ exists: rows.length > 0 });
  } catch (err) {
    console.error("❌ Error checking workout log existence:", err);
    res.status(500).json({ error: "Failed to check workout log." });
  }
});


// GET: Get workout logs by user and date
router.get('/get-workout-log', async (req, res) => {
  const { date } = req.query;

  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  if (!date) {
    return res.status(400).json({ error: 'Missing date' });
  }

  try {
    const [rows] = await pool.query(`
      SELECT wl.*, ex.ExerciseTitle, ex.ImageGallery
      FROM workout_log wl
      JOIN exercises ex ON wl.ExerciseID = ex.ExerciseID
      WHERE wl.UserID = ? AND wl.WorkoutDate = ?
    `, [req.session.user.id, date]);

    res.status(200).json(rows);
  } catch (err) {
    console.error('❌ DB Fetch Error:', err);
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
});




//Update workout log
router.put('/update-workout-log', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const {
    WorkoutLogID, Reps, Sets, Weight, Duration, Calories, Distance, Speed, ['Laps-Rep']: LapsRep
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE workout_log SET 
        Reps = ?, Sets = ?, Weight = ?, Duration = ?, Calories = ?, Distance = ?, Speed = ?, \`Laps-Rep\` = ?
        WHERE WorkoutLogID = ? AND UserID = ?`,
      [Reps, Sets, Weight, Duration, Calories, Distance, Speed, LapsRep, WorkoutLogID, req.session.user.id]
    );
    res.status(200).json({ message: 'Workout updated', changed: result.affectedRows });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: 'Failed to update workout.' });
  }
});

//update workout log


//Delete workout log
router.delete('/delete-workout-log/:id', async (req, res) => {
  const { id } = req.params;
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    const [result] = await pool.query(
      `DELETE FROM workout_log WHERE WorkoutLogID = ? AND UserID = ?`,
      [id, req.session.user.id]
    );
    res.status(200).json({ message: 'Deleted', deleted: result.affectedRows });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: 'Failed to delete workout.' });
  }
});

// ✅ GET: Check if user has any workouts (for sidebar unlock logic)
router.get('/has-workouts', async (req, res) => {
  try {
    if (!req.session || !req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const userID = req.session.user.id;

    // Primary unlock rule: relational workout schedules with mapped exercises
    const [scheduleRows] = await pool.query(
      `SELECT 1
       FROM workout_schedules ws
       INNER JOIN workout_schedule_exercises wse ON wse.workout_schedule_id = ws.id
       WHERE ws.user_id = ?
       LIMIT 1`,
      [userID]
    );
    const hasSavedWorkoutExerciseList = scheduleRows.length > 0;

    if (hasSavedWorkoutExerciseList) {
      return res.status(200).json({
        hasWorkouts: true,
        hasSavedWorkoutExerciseList: true,
        message: 'User has saved workout planner exercises',
      });
    }

    // Backward-compatible fallback: check if user has at least one workout log entry
    const [rows] = await pool.query(
      `SELECT 1 FROM workout_log WHERE UserID = ? LIMIT 1`,
      [userID]
    );

    const hasWorkouts = rows.length > 0;

    res.status(200).json({ 
      hasWorkouts: hasWorkouts,
      hasSavedWorkoutExerciseList: hasWorkouts,
      message: hasWorkouts ? 'User has workouts' : 'User has no workouts'
    });
  } catch (err) {
    console.error("❌ Error checking user workouts:", err);
    res.status(500).json({ error: 'Failed to check workouts.' });
  }
});

// ✅ GET: Resolve workout-log day order mode and active ordering for a plan
router.get('/day-order', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const planId = Number(req.query?.planId || 0);
  if (!planId) {
    return res.status(400).json({ error: 'planId is required.' });
  }

  try {
    const payload = await getWorkoutLogDayOrdering(req.session.user.id, planId);
    if (!payload) {
      return res.status(404).json({ error: 'Workout plan not found.' });
    }
    return res.status(200).json(payload);
  } catch (err) {
    console.error('❌ Failed to fetch workout-log day order:', err);
    return res.status(500).json({ error: 'Failed to fetch workout-log day order.' });
  }
});

// ✅ PUT: Save custom workout-log day order for a plan
router.put('/day-order', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const planId = Number(req.body?.planId || 0);
  if (!planId) {
    return res.status(400).json({ error: 'planId is required.' });
  }

  const requestedOrder = Array.isArray(req.body?.orderedGroups) ? req.body.orderedGroups : [];
  if (!requestedOrder.length) {
    return res.status(400).json({ error: 'orderedGroups must be a non-empty array.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[scheduleRow]] = await connection.query(
      `SELECT id
       FROM workout_schedules
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [planId, req.session.user.id]
    );

    if (!scheduleRow) {
      await connection.rollback();
      return res.status(404).json({ error: 'Workout plan not found.' });
    }

    const [groupRows] = await connection.query(
      `SELECT id, label, sort_order
       FROM workout_schedule_groups
       WHERE workout_schedule_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [planId]
    );

    if (!groupRows.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'Workout plan has no groups to order.' });
    }

    const groupByLabel = new Map();
    for (const row of groupRows) {
      const label = String(row?.label || '').trim();
      if (!label) {
        continue;
      }
      groupByLabel.set(label.toLowerCase(), {
        id: Number(row.id),
        label,
      });
    }

    const dedupedRequested = [];
    const seen = new Set();
    for (const entry of requestedOrder) {
      const label = String(entry || '').trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) {
        continue;
      }
      if (groupByLabel.has(key)) {
        dedupedRequested.push(groupByLabel.get(key).label);
        seen.add(key);
      }
    }

    if (!dedupedRequested.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'orderedGroups does not contain valid group labels for this plan.' });
    }

    const builderOrder = groupRows
      .map((row) => String(row?.label || '').trim())
      .filter(Boolean);
    const finalOrder = buildNormalizedGroupOrder(builderOrder, dedupedRequested);

    await connection.query(
      `UPDATE workout_schedules
       SET use_custom_workout_log_order = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [planId, req.session.user.id]
    );

    for (let index = 0; index < finalOrder.length; index += 1) {
      const label = finalOrder[index];
      const row = groupByLabel.get(label.toLowerCase());
      if (!row?.id) {
        continue;
      }
      await connection.query(
        `UPDATE workout_schedule_groups
         SET workout_log_display_order = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND workout_schedule_id = ?`,
        [index + 1, row.id, planId]
      );
    }

    await connection.commit();

    const payload = await getWorkoutLogDayOrdering(req.session.user.id, planId);
    return res.status(200).json({
      message: 'Workout log day order saved.',
      ...payload,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    console.error('❌ Failed to save workout-log day order:', err);
    return res.status(500).json({ error: 'Failed to save workout-log day order.' });
  } finally {
    connection.release();
  }
});

// ✅ POST: Reset workout-log ordering back to builder order
router.post('/day-order/reset', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const planId = Number(req.body?.planId || 0);
  if (!planId) {
    return res.status(400).json({ error: 'planId is required.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [scheduleResult] = await connection.query(
      `UPDATE workout_schedules
       SET use_custom_workout_log_order = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [planId, req.session.user.id]
    );

    if (!scheduleResult.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Workout plan not found.' });
    }

    await connection.query(
      `UPDATE workout_schedule_groups
       SET workout_log_display_order = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE workout_schedule_id = ?`,
      [planId]
    );

    await connection.commit();

    const payload = await getWorkoutLogDayOrdering(req.session.user.id, planId);
    return res.status(200).json({
      message: 'Workout log order reset to builder order.',
      ...payload,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    console.error('❌ Failed to reset workout-log day order:', err);
    return res.status(500).json({ error: 'Failed to reset workout-log day order.' });
  } finally {
    connection.release();
  }
});

// ─── POST /session ── Save a full workout session (multiple exercises) ─────────
router.post('/session', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const userID = req.session.user.id;
    const { planId, planName, workoutDate, exercises } = req.body;

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'exercises array is required.' });
    }

    const date = workoutDate || new Date().toISOString().split('T')[0];
    const sourceScheduleId = Number(planId || 0) || null;

    await connection.beginTransaction();

    const [sessionResult] = await connection.query(
      `INSERT INTO workout_log_sessions
        (user_id, source_workout_schedule_id, workout_date, status, started_at, completed_at, notes)
       VALUES (?, ?, ?, 'completed', NOW(), NOW(), ?)`,
      [userID, sourceScheduleId, date, sanitizeText(planName || '', 255)]
    );

    const workoutLogSessionId = sessionResult.insertId;
    let insertedExerciseLogs = 0;

    for (const ex of exercises) {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      const doneSets = sets.filter((s) => s.done);
      if (doneSets.length === 0) continue; // skip uncompleted exercises

      // Lookup ExerciseID – fall back to provided exerciseId or skip
      let exerciseID = ex.exerciseId || null;
      if (!exerciseID) {
        const [found] = await connection.query(
          'SELECT ExerciseID FROM exercises WHERE ExerciseTitle = ? LIMIT 1',
          [ex.name || '']
        );
        if (found.length > 0) exerciseID = found[0].ExerciseID;
      }

      let sourceScheduleExerciseId = null;
      if (sourceScheduleId) {
        const matchByEmbeddedId = String(ex?.id || '').match(/^wse-(\d+)$/i);
        if (matchByEmbeddedId) {
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

        if (!sourceScheduleExerciseId && exerciseID) {
          const [byExerciseRows] = await connection.query(
            `SELECT id
             FROM workout_schedule_exercises
             WHERE workout_schedule_id = ? AND exercise_id = ?
             ORDER BY sort_order ASC, id ASC
             LIMIT 1`,
            [sourceScheduleId, exerciseID]
          );
          if (byExerciseRows.length > 0) {
            sourceScheduleExerciseId = byExerciseRows[0].id;
          }
        }
      }

      const totalSets = doneSets.length;
      const avgWeight = doneSets.reduce((a, s) => a + Number(s.weight || 0), 0) / totalSets;
      const avgReps   = doneSets.reduce((a, s) => a + Number(s.reps || 0), 0)   / totalSets;
      const totalDur  = doneSets.reduce((a, s) => a + Number(s.duration || 0), 0);

      const [logResult] = await connection.query(
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
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [
          workoutLogSessionId,
          userID,
          exerciseID || null,
          sourceScheduleId,
          sourceScheduleExerciseId,
          sanitizeText(ex.scheduleGroup || '', 120) || null,
          date,
          sanitizeText(ex.workoutType || 'Strength'),
          Math.round(totalDur),
          Math.round(avgReps),
          totalSets,
          Math.round(avgWeight),
        ]
      );

      insertedExerciseLogs += 1;

      const workoutLogId = logResult.insertId;
      for (let index = 0; index < sets.length; index += 1) {
        const setEntry = sets[index] || {};
        await connection.query(
          `INSERT INTO workout_log_sets
            (workout_log_id, set_number, reps, weight, duration_minutes, calories_burned, distance_miles, speed_mph, completed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             reps             = VALUES(reps),
             weight           = VALUES(weight),
             duration_minutes = VALUES(duration_minutes),
             calories_burned  = VALUES(calories_burned),
             distance_miles   = VALUES(distance_miles),
             speed_mph        = VALUES(speed_mph),
             completed        = VALUES(completed),
             updated_at       = CURRENT_TIMESTAMP`,
          [
            workoutLogId,
            index + 1,
            Number(setEntry?.reps || 0) || null,
            Number(setEntry?.weight || 0) || null,
            Number(setEntry?.duration || 0) || null,
            Number(setEntry?.caloriesBurned || 0) || null,
            Number(setEntry?.distanceMiles || 0) || null,
            Number(setEntry?.speedMph || 0) || null,
            setEntry?.done ? 1 : 0,
          ]
        );
      }
    }

    await connection.commit();

    return res.status(201).json({
      message: 'Session saved successfully.',
      workoutLogSessionId,
      insertedExerciseLogs,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    console.error('❌ Failed to save workout session:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

// ─── GET /history ── Completed workout sessions for user on a given STARTED date
// Filters by wl.WorkoutDate (= the date the user intended/started the workout).
// Returns a structured sessions array with exercises and per-set details.
router.get('/history', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter (YYYY-MM-DD).' });
  }

  try {
    const userId = req.session.user.id;

    // ── Step 1: fetch exercise-level rows filtered by started/workout date ──
    // WorkoutDate is set to the workout's intended start date, making it the
    // correct filter key. Only include rows that either have no session (legacy)
    // or belong to a completed session.
    const [exerciseRows] = await pool.query(`
      SELECT
        wl.WorkoutLogID                   AS workoutLogId,
        wl.workout_log_session_id         AS sessionId,
        wl.WorkoutDate                    AS workoutDate,
        wl.WorkoutType                    AS workoutType,
        wl.Sets                           AS totalSets,
        wl.Reps                           AS avgReps,
        wl.Weight                         AS avgWeight,
        wl.Duration                       AS totalDuration,
        wl.Calories                       AS calories,
        wl.Distance                       AS distance,
        wl.Speed                          AS speed,
        wl.source_schedule_group_label    AS scheduleGroup,
        wls.started_at                    AS sessionStartedAt,
        wls.completed_at                  AS sessionCompletedAt,
        wls.workout_date                  AS sessionWorkoutDate,
        ws.title                          AS planName,
        ex.ExerciseTitle                  AS exerciseName,
        ex.ImageGallery                   AS exerciseImage,
        ex.MuscleGroup                    AS muscleGroup,
        ex.Equipment                      AS equipment
      FROM workout_log wl
      LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
      LEFT JOIN workout_schedules    ws  ON ws.id = wls.source_workout_schedule_id
      LEFT JOIN exercises            ex  ON ex.ExerciseID = wl.ExerciseID
      WHERE wl.UserID = ?
        AND wl.WorkoutDate = ?
        AND (wl.workout_log_session_id IS NULL OR wls.status = 'completed')
      ORDER BY wl.workout_log_session_id ASC, wl.WorkoutLogID ASC
    `, [userId, date]);

    if (exerciseRows.length === 0) {
      return res.status(200).json({
        date,
        username: req.session.user.username || '',
        sessions: [],
      });
    }

    // ── Step 2: fetch per-set data for all exercise logs ──────────────────
    const workoutLogIds = exerciseRows.map((r) => r.workoutLogId);
    let setRows = [];
    if (workoutLogIds.length > 0) {
      [setRows] = await pool.query(`
        SELECT
          workout_log_id   AS workoutLogId,
          set_number       AS setNumber,
          weight,
          reps,
          duration_minutes AS duration,
          calories_burned  AS caloriesBurned,
          distance_miles   AS distanceMiles,
          speed_mph        AS speedMph,
          completed
        FROM workout_log_sets
        WHERE workout_log_id IN (?)
        ORDER BY workout_log_id ASC, set_number ASC
      `, [workoutLogIds]);
    }

    // ── Step 3: group sets by workoutLogId ────────────────────────────────
    const setsByLog = {};
    for (const set of setRows) {
      if (!setsByLog[set.workoutLogId]) setsByLog[set.workoutLogId] = [];
      setsByLog[set.workoutLogId].push(set);
    }

    // ── Step 4: group exercises into sessions ─────────────────────────────
    // Use sessionId as the key; null-session rows each form their own group.
    const sessionMap = new Map();
    for (const ex of exerciseRows) {
      const key = ex.sessionId != null ? String(ex.sessionId) : `legacy-${ex.workoutLogId}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          sessionId:          ex.sessionId,
          workoutDate:        ex.workoutDate,
          workoutDayName:     ex.scheduleGroup || '',
          sessionStartedAt:   ex.sessionStartedAt || null,
          sessionCompletedAt: ex.sessionCompletedAt || null,
          planName:           ex.planName || '',
          exercises:          [],
        });
      }
      sessionMap.get(key).exercises.push({
        workoutLogId:  ex.workoutLogId,
        exerciseName:  ex.exerciseName || 'Unknown Exercise',
        exerciseImage: ex.exerciseImage || null,
        muscleGroup:   ex.muscleGroup  || '',
        equipment:     ex.equipment    || '',
        workoutType:   ex.workoutType  || 'Strength',
        scheduleGroup: ex.scheduleGroup || '',
        totalSets:     ex.totalSets,
        avgReps:       ex.avgReps,
        avgWeight:     ex.avgWeight,
        totalDuration: ex.totalDuration,
        calories:      ex.calories,
        distance:      ex.distance,
        speed:         ex.speed,
        sets:          setsByLog[ex.workoutLogId] || [],
      });
    }

    const sessions = [...sessionMap.values()];

    return res.status(200).json({
      date,
      username: req.session.user.username || '',
      sessions,
    });
  } catch (err) {
    console.error('❌ History fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch workout history.' });
  }
});

// ─── PUT /history/session/:sessionId ── Update completed workout history sets
// Accepts updated per-set values for exercises in the session.
// Only completed sessions owned by the logged-in user can be updated.
router.put('/history/session/:sessionId', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const sessionId = Number(req.params.sessionId);
  if (!sessionId || isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId.' });
  }

  const { exercises } = req.body;
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ error: 'exercises array is required.' });
  }

  const userId = req.session.user.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify ownership and completed status
    const [[session]] = await connection.query(
      `SELECT id, user_id, status FROM workout_log_sessions WHERE id = ? LIMIT 1`,
      [sessionId]
    );
    if (!session) {
      await connection.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (session.user_id !== userId) {
      await connection.rollback();
      return res.status(403).json({ error: 'You do not have permission to edit this session.' });
    }
    if (session.status === 'in_progress') {
      await connection.rollback();
      return res.status(409).json({ error: 'Cannot edit an in-progress workout.' });
    }

    let updatedExercises = 0;
    for (const ex of exercises) {
      const workoutLogId = Number(ex.workoutLogId);
      if (!workoutLogId) continue;

      // Verify this workout_log row belongs to the session + user
      const [[logRow]] = await connection.query(
        `SELECT WorkoutLogID FROM workout_log
         WHERE WorkoutLogID = ? AND workout_log_session_id = ? AND UserID = ?
         LIMIT 1`,
        [workoutLogId, sessionId, userId]
      );
      if (!logRow) continue;

      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      for (const s of sets) {
        const setNumber = Number(s.setNumber);
        if (!setNumber) continue;
        await connection.query(
          `UPDATE workout_log_sets
           SET reps             = ?,
               weight           = ?,
               duration_minutes = ?,
               calories_burned  = ?,
               distance_miles   = ?,
               speed_mph        = ?,
               updated_at       = CURRENT_TIMESTAMP
           WHERE workout_log_id = ? AND set_number = ?`,
          [
            Number(s.reps  || 0) || null,
            Number(s.weight || 0) || null,
            Number(s.duration || 0) || null,
            Number(s.caloriesBurned || 0) || null,
            Number(s.distanceMiles || 0) || null,
            Number(s.speedMph || 0) || null,
            workoutLogId,
            setNumber,
          ]
        );
      }

      // Update workout_log summary aggregates from the new set values
      if (sets.length > 0) {
        const n          = sets.length;
        const avgWeight  = sets.reduce((a, s) => a + Number(s.weight  || 0), 0) / n;
        const avgReps    = sets.reduce((a, s) => a + Number(s.reps    || 0), 0) / n;
        const totalDur   = sets.reduce((a, s) => a + Number(s.duration       || 0), 0);
        const totalCals  = sets.reduce((a, s) => a + Number(s.caloriesBurned || 0), 0);
        const avgDist    = sets.reduce((a, s) => a + Number(s.distanceMiles  || 0), 0) / n;
        const avgSpeed   = sets.reduce((a, s) => a + Number(s.speedMph       || 0), 0) / n;
        await connection.query(
          `UPDATE workout_log
           SET Weight   = ?,
               Reps     = ?,
               Duration = ?,
               Calories = ?,
               Distance = ?,
               Speed    = ?
           WHERE WorkoutLogID = ? AND UserID = ?`,
          [
            Math.round(avgWeight),
            Math.round(avgReps),
            Math.round(totalDur),
            Math.round(totalCals),
            Number(avgDist.toFixed(3)),
            Number(avgSpeed.toFixed(2)),
            workoutLogId,
            userId,
          ]
        );
      }
      updatedExercises++;
    }

    await connection.commit();
    return res.status(200).json({ message: 'Session updated successfully.', sessionId, updatedExercises });
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    console.error('\u274c History update error:', err);
    return res.status(500).json({ error: 'Failed to update workout history.' });
  } finally {
    connection.release();
  }
});

// ─── DELETE /history/session/:sessionId ──────────────────────────────────
// Deletes a completed workout session owned by the logged-in user:
//   1. Verifies session exists, belongs to user, and is NOT in_progress.
//   2. Deletes workout_log_sets rows for all workout_log rows in this session.
//   3. Deletes workout_log rows for this session.
//   4. Deletes the workout_log_sessions row.
router.delete('/history/session/:sessionId', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const sessionId = Number(req.params.sessionId);
  if (!sessionId || isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId.' });
  }

  const userId = req.session.user.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify session ownership and that it is not in_progress
    const [[session]] = await connection.query(
      `SELECT id, user_id, status FROM workout_log_sessions WHERE id = ? LIMIT 1`,
      [sessionId]
    );

    if (!session) {
      await connection.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (session.user_id !== userId) {
      await connection.rollback();
      return res.status(403).json({ error: 'You do not have permission to delete this session.' });
    }
    if (session.status === 'in_progress') {
      await connection.rollback();
      return res.status(409).json({ error: 'Cannot delete an in-progress workout. Please complete or end it first.' });
    }

    // Get all workout_log IDs for this session
    const [logRows] = await connection.query(
      `SELECT WorkoutLogID FROM workout_log WHERE workout_log_session_id = ? AND UserID = ?`,
      [sessionId, userId]
    );
    const logIds = logRows.map((r) => r.WorkoutLogID);

    // Delete sets for those logs
    if (logIds.length > 0) {
      await connection.query(
        `DELETE FROM workout_log_sets WHERE workout_log_id IN (?)`,
        [logIds]
      );
    }

    // Delete workout_log rows
    await connection.query(
      `DELETE FROM workout_log WHERE workout_log_session_id = ? AND UserID = ?`,
      [sessionId, userId]
    );

    // Delete the session itself
    await connection.query(
      `DELETE FROM workout_log_sessions WHERE id = ? AND user_id = ?`,
      [sessionId, userId]
    );

    await connection.commit();
    return res.status(200).json({ message: 'Session deleted successfully.', sessionId });
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    console.error('❌ DELETE /history/session error:', err);
    return res.status(500).json({ error: 'Failed to delete session.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
