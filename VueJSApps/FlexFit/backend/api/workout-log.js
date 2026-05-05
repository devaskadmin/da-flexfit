const express = require('express');
const router = express.Router();

// ✅ DB Connect
const pool = require('../db.js');
const { sanitizeText } = require('../utils/sanitize.js');





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
            (workout_log_id, set_number, reps, weight, duration_minutes, completed)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             reps = VALUES(reps),
             weight = VALUES(weight),
             duration_minutes = VALUES(duration_minutes),
             completed = VALUES(completed),
             updated_at = CURRENT_TIMESTAMP`,
          [
            workoutLogId,
            index + 1,
            Number(setEntry?.reps || 0) || null,
            Number(setEntry?.weight || 0) || null,
            Number(setEntry?.duration || 0) || null,
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

// ─── GET /history ── Completed workout logs for user on a given date ─────────
router.get('/history', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter (YYYY-MM-DD).' });
  }

  try {
    const [rows] = await pool.query(`
      SELECT
        wl.WorkoutLogID,
        wl.WorkoutDate,
        wl.WorkoutType,
        wl.Sets,
        wl.Reps,
        wl.Weight,
        wl.Duration,
        wl.Calories,
        wl.Distance,
        wl.performed_at,
        wl.source_schedule_group_label  AS workoutDayName,
        wls.notes                        AS planName,
        ex.ExerciseTitle                 AS exerciseName
      FROM workout_log wl
      LEFT JOIN workout_log_sessions wls ON wl.workout_log_session_id = wls.id
      LEFT JOIN exercises            ex  ON wl.ExerciseID = ex.ExerciseID
      WHERE wl.UserID = ? AND wl.WorkoutDate = ?
      ORDER BY wl.WorkoutLogID DESC
    `, [req.session.user.id, date]);

    res.status(200).json({
      date,
      username: req.session.user.username || '',
      records: rows,
    });
  } catch (err) {
    console.error('❌ History fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch workout history.' });
  }
});

module.exports = router;
