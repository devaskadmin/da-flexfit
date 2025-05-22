const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// ✅ DB Connect
const pool = require('../db');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');





//Get Workout Log
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
module.exports = router;
