//Varibles
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');
const ImageUpload = require('../Components/ImageUpload/ImageUpload');

// ✅ DB Connect
const pool = require('../db');

const normalizeFallbackExercises = (rawList = []) => {
  if (!Array.isArray(rawList)) return [];

  return rawList.map((item, index) => ({
    ExerciseID: index + 1,
    ExerciseTitle: item?.name || 'Exercise',
    MuscleGroup: Array.isArray(item?.primaryMuscles) && item.primaryMuscles.length ? item.primaryMuscles[0] : 'General',
    Equipment: item?.equipment || 'body only',
    WorkoutType: item?.category || 'general',
    RecordingType: item?.category === 'cardio' ? 'Cardio' : 'Strength',
    Instructions: Array.isArray(item?.instructions) ? item.instructions.join(' ') : '',
    ImageGallery: JSON.stringify(item?.images || []),
    ImageURL: Array.isArray(item?.images) && item.images[0]
      ? `/assets/Excerises/${item.images[0]}`
      : '/assets/Excerises/default/default.jpg',
  }));
};

const readFallbackExercises = () => {
  const fallbackPath = path.resolve(__dirname, '..', 'data', 'exercises.json');
  const content = fs.readFileSync(fallbackPath, 'utf8');
  const parsed = JSON.parse(content);
  return normalizeFallbackExercises(parsed);
};

// PUT update exercise with image support
router.put('/get-exercise/:id', (req, res) => {
  ImageUpload.upload(req, res, async function (err) {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const id = req.params.id;
      const {
        ExerciseTitle = '',
        MuscleGroup = '',
        Equipment = '',
        WorkoutType = '',
        RecordingType = '',
        Instructions = '',
        Duration = null,
        Calories = null,
        Distance = null,
        Speed = null,
        'Laps-Rep': LapsRep = null
      } = req.body;

      let existingImages = [];
      let imagesToDelete = [];
      try { existingImages = JSON.parse(req.body.existingImages || '[]'); } catch {}
      try { imagesToDelete = JSON.parse(req.body.imagesToDelete || '[]'); } catch {}

      if (imagesToDelete.length > 0) {
        ImageUpload.deleteImagesFromDisk(ExerciseTitle, imagesToDelete);
      }

      const folderName = ExerciseTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const newImages = (req.files && req.files.length > 0)
        ? req.files.map(f => `${folderName}/${f.filename}`)
        : [];

      const imageGallery = [...existingImages, ...newImages].slice(0, 2);
      const ImageURL = `/assets/Excerises/${imageGallery[0] || 'default/default.jpg'}`;

      const clean = {
        ExerciseTitle: sanitizeText(ExerciseTitle, 100),
        MuscleGroup: sanitizeText(MuscleGroup, 50),
        Equipment: sanitizeText(Equipment, 50),
        WorkoutType: sanitizeText(WorkoutType, 50),
        RecordingType: sanitizeText(RecordingType, 50),
        ImageURL: sanitizeText(ImageURL, 255),
        Instructions: sanitizeText(Instructions, 1000),
        ImageGallery: JSON.stringify(imageGallery),
        Duration: parseNumber(Duration),
        Calories: parseNumber(Calories),
        Distance: parseNumber(Distance, true),
        Speed: parseNumber(Speed, true),
        LapsReps: parseNumber(LapsRep)
      };

      await pool.query(
        `UPDATE exercises SET
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

      res.status(200).json({ message: 'Exercise updated successfully' });
    } catch (updateErr) {
      console.error('❌ Update error:', updateErr);
      res.status(500).json({ error: 'Update failed' });
    }
  });
});

// POST new exercise with image
router.post('/save-exercises', ImageUpload.upload, async (req, res) => {
  try {
    const {
      ExerciseTitle, MuscleGroup, Equipment, WorkoutType, RecordingType, Instructions
    } = req.body;

    if (!ExerciseTitle || !MuscleGroup || !Equipment || !WorkoutType || !RecordingType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [existing] = await pool.query('SELECT ExerciseID FROM exercises WHERE ExerciseTitle = ?', [ExerciseTitle]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Exercise title already exists' });
    }

    const folderName = ExerciseTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const imageGallery = (req.files && req.files.length > 0)
      ? req.files.map(f => `${folderName}/${f.filename}`)
      : ['default/default.jpg'];

    const ImageURL = `/assets/Excerises/${imageGallery[0]}`;

    await pool.query(
      `INSERT INTO exercises
      (ExerciseTitle, MuscleGroup, Equipment, WorkoutType, RecordingType, ImageURL, Instructions, ImageGallery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ExerciseTitle,
        MuscleGroup,
        Equipment,
        WorkoutType,
        RecordingType,
        ImageURL,
        Instructions || '',
        JSON.stringify(imageGallery)
      ]
    );

    res.status(201).json({ message: 'Exercise created successfully' });
  } catch (insertErr) {
    console.error('❌ Insert failed:', insertErr);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Fetch exercises with fallback
router.get('/get-exercises', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM exercises');
    if (Array.isArray(rows) && rows.length > 0) {
      return res.status(200).json(rows);
    }

    const fallbackRows = readFallbackExercises();
    return res.status(200).json(fallbackRows);
  } catch (err) {
    console.error('❌ Failed to fetch exercises from DB. Falling back to JSON:', err?.message || err);
    try {
      const fallbackRows = readFallbackExercises();
      return res.status(200).json(fallbackRows);
    } catch (fallbackErr) {
      console.error('❌ Fallback exercise load failed:', fallbackErr?.message || fallbackErr);
      return res.status(500).json({ error: 'Failed to fetch exercises' });
    }
  }
});

// Check exercises
router.get('/check-exercises', async (req, res) => {
  const { userId, exerciseId, date } = req.query;
  const [rows] = await pool.query(
    `SELECT * FROM workout_log WHERE UserID = ? AND ExerciseID = ? AND WorkoutDate = ?`,
    [userId, exerciseId, date]
  );
  res.json({ exists: rows.length > 0, data: rows[0] });
});

module.exports = router;
