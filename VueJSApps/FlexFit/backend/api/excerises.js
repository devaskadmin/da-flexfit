//Varibles
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');

// ✅ DB Connect
const pool = require('../db');


// ✅ Fetch exercises
router.put('/get-exercise/:id', async (req, res) => {
    try {
      const id = req.params.id;
  
      // Sanitize and parse inputs
      const clean = {
        ExerciseTitle: sanitizeText(req.body.ExerciseTitle, 100),
        MuscleGroup: sanitizeText(req.body.MuscleGroup, 50),
        Equipment: sanitizeText(req.body.Equipment, 50),
        WorkoutType: sanitizeText(req.body.WorkoutType, 50),
        RecordingType: sanitizeText(req.body.RecordingType, 50),
        ImageURL: sanitizeText(req.body.ImageURL, 255),
        Instructions: sanitizeText(req.body.Instructions, 1000),
        ImageGallery: sanitizeText(req.body.ImageGallery, 1000),
        Duration: parseNumber(req.body.Duration),
        Calories: parseNumber(req.body.Calories),
        Distance: parseNumber(req.body.Distance, true),
        Speed: parseNumber(req.body.Speed, true),
        LapsReps: parseNumber(req.body['Laps-Rep'])
      };
  
      // Execute update with clean data
      await pool.query(
        `UPDATE Exercises SET 
          ExerciseTitle = ?, 
          MuscleGroup = ?, 
          Equipment = ?, 
          WorkoutType = ?, 
          RecordingType = ?, 
          ImageURL = ?, 
          Instructions = ?, 
          ImageGallery = ?, 
          Duration = ?, 
          Calories = ?, 
          Distance = ?, 
          Speed = ?, 
          \`Laps-Rep\` = ?
         WHERE ExerciseID = ?`,
        [
          clean.ExerciseTitle,
          clean.MuscleGroup,
          clean.Equipment,
          clean.WorkoutType,
          clean.RecordingType,
          clean.ImageURL,
          clean.Instructions,
          clean.ImageGallery,
          clean.Duration,
          clean.Calories,
          clean.Distance,
          clean.Speed,
          clean.LapsReps,
          id
        ]
      );
  
      res.status(200).json({ message: "Exercise updated successfully" });
  
    } catch (err) {
      console.error("❌ Update error:", err);
      res.status(500).json({ error: "Update failed" });
    }
  });

  // POST new exercise with image
router.post('/save-exercises', (req, res) => {
  upload(req, res, async function (err) {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const {
        ExerciseTitle, MuscleGroup, Equipment, WorkoutType, RecordingType, Instructions
      } = req.body;

      if (!ExerciseTitle || !MuscleGroup || !Equipment || !WorkoutType || !RecordingType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const [existing] = await pool.query("SELECT ExerciseID FROM Exercises WHERE ExerciseTitle = ?", [ExerciseTitle]);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Exercise title already exists" });
      }

      const folderName = ExerciseTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const imageGallery = (req.files && req.files.length > 0)
        ? req.files.map(f => `${folderName}/${f.filename}`)
        : ['default/default.jpg'];

      const ImageURL = `/assets/Excerises/${imageGallery[0]}`;

      await pool.query(`
        INSERT INTO Exercises 
        (ExerciseTitle, MuscleGroup, Equipment, WorkoutType, RecordingType, ImageURL, Instructions, ImageGallery)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        ExerciseTitle,
        MuscleGroup,
        Equipment,
        WorkoutType,
        RecordingType,
        ImageURL,
        Instructions || "",
        JSON.stringify(imageGallery)
      ]);

      res.status(201).json({ message: "Exercise created successfully" });
    } catch (err) {
      console.error("❌ Insert failed:", err);
      res.status(500).json({ error: "Server error" });
    }
  });
});


// ✅ Fetch exercises
router.get('/get-exercises', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Exercises');
    res.status(200).json(rows);
  } catch (err) {
    console.error("❌ Failed to fetch exercises:", err);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});



//Check exercises
router.get('/check-exercises', async (req, res) => {
  const { userId, exerciseId, date } = req.query;
  const [rows] = await pool.query(
    `SELECT * FROM workout_log WHERE UserID = ? AND ExerciseID = ? AND WorkoutDate = ?`,
    [userId, exerciseId, date]
  );
  res.json({ exists: rows.length > 0, data: rows[0] });
});
//End of Check exercises


//Delete Workout Log






module.exports = router;























module.exports = router;
