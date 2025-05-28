const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// ✅ DB Connect
const pool = require('../db.js');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');





//Saves Workout Log
  router.post('/workout-log', async (req, res) => {
    try {
      const { ExerciseTitle, ExerciseType, Reps, Sets, Weight, Duration, WorkoutDate } = req.body;
  
      if (!req.session || !req.session.user || !req.session.user.id) {
        return res.status(401).json({ error: "Unauthorized. Please log in." });
      }
  
      const userID = req.session.user.id;
  
      // Lookup ExerciseID from title
      const [exercise] = await pool.query('SELECT ExerciseID FROM Exercises WHERE ExerciseTitle = ?', [ExerciseTitle]);
  
      if (exercise.length === 0) {
        return res.status(404).json({ error: 'Exercise not found' });
      }
  
      const exerciseID = exercise[0].ExerciseID;
  
      // Insert into workout_logs
      await pool.query(
        `INSERT INTO workout_logs 
          (UserID, ExerciseID, WorkoutDate, ExerciseTitle, ExerciseType, Reps, Sets, Weight, Duration) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userID, exerciseID, WorkoutDate, ExerciseTitle, ExerciseType, Reps, Sets, Weight, Duration]
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

  try {
    const [result] = await pool.query(`
      INSERT INTO workout_log 
      (UserID, ExerciseID, WorkoutDate, WorkoutType, Duration, Reps, Sets, Weight, Calories, Distance, Speed, \`Laps-Rep\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      UserID, ExerciseID, WorkoutDate, WorkoutType,
      Duration, Reps, Sets, Weight, Calories, Distance, Speed, LapsRep
    ]);

    res.status(200).json({ message: 'Workout log saved', logId: result.insertId });
  } catch (err) {
    console.error('❌ DB Error:', err);
    res.status(500).json({ error: 'Failed to save workout log.' });
  }
});


router.get('/workout-check-exists', async (req, res) => {
  const { userId, exerciseId, date } = req.query;

  if (!userId || !exerciseId || !date) {
    return res.status(400).json({ error: 'Missing userId, exerciseId, or date' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM workout_log WHERE UserID = ? AND ExerciseID = ? AND WorkoutDate = ? LIMIT 1`,
      [userId, exerciseId, date]
    );

    res.status(200).json({ exists: rows.length > 0 });
  } catch (err) {
    console.error("❌ Error checking workout log existence:", err);
    res.status(500).json({ error: "Failed to check workout log." });
  }
});


// GET: Get workout logs by user and date
router.get('/get-workout-log', async (req, res) => {
  const { userId, date } = req.query;

  if (!userId || !date) {
    return res.status(400).json({ error: 'Missing userId or date' });
  }

  try {
    const [rows] = await pool.query(`
      SELECT wl.*, ex.ExerciseTitle, ex.ImageGallery
      FROM workout_log wl
      JOIN exercises ex ON wl.ExerciseID = ex.ExerciseID
      WHERE wl.UserID = ? AND wl.WorkoutDate = ?
    `, [userId, date]);

    res.status(200).json(rows);
  } catch (err) {
    console.error('❌ DB Fetch Error:', err);
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
});




//Update workout log
router.put('/update-workout-log', async (req, res) => {
  console.log("A")
  const {
    WorkoutLogID, Reps, Sets, Weight, Duration, Calories, Distance, Speed, ['Laps-Rep']: LapsRep
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE workout_log SET 
        Reps = ?, Sets = ?, Weight = ?, Duration = ?, Calories = ?, Distance = ?, Speed = ?, \`Laps-Rep\` = ?
        WHERE WorkoutLogID = ?`,
      [Reps, Sets, Weight, Duration, Calories, Distance, Speed, LapsRep, WorkoutLogID]
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
  try {
    const [result] = await pool.query(`DELETE FROM workout_log WHERE WorkoutLogID = ?`, [id]);
    res.status(200).json({ message: 'Deleted', deleted: result.affectedRows });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: 'Failed to delete workout.' });
  }
});

module.exports = router;
