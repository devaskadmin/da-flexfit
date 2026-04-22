//Varibles
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');
const ImageUpload = require('../Components/ImageUpload/ImageUpload');

// ✅ DB Connect
const pool = require('../db');

let exerciseSchemaReady = false;

const requireAuthUserId = (req, res) => {
  const userId = req?.session?.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
    return null;
  }
  return Number(userId);
};

const ensureExerciseSchema = async () => {
  if (exerciseSchemaReady) return;

  // Ensure exercises.CreatedByUserID exists for "My Exercises" filtering.
  const [createdByCol] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'exercises'
       AND COLUMN_NAME = 'CreatedByUserID'
     LIMIT 1`
  );

  if (!Array.isArray(createdByCol) || createdByCol.length === 0) {
    await pool.query(
      `ALTER TABLE exercises
       ADD COLUMN CreatedByUserID BIGINT UNSIGNED NULL AFTER ExerciseID`
    );
  }

  // Ensure favorites table exists for per-user exercise favorites.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_favorite_exercises (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      exercise_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY ux_user_favorite_exercise (user_id, exercise_id),
      KEY idx_ufe_user (user_id),
      KEY idx_ufe_exercise (exercise_id),
      CONSTRAINT fk_ufe_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (ExerciseID)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  exerciseSchemaReady = true;
};

const mapExerciseRowsWithUserFlags = (rows = [], userId = null) => {
  const currentUserId = Number(userId || 0);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    IsFavorite: Number(row.IsFavorite || 0),
    IsOwnedByCurrentUser: currentUserId > 0 && Number(row.CreatedByUserID || 0) === currentUserId ? 1 : 0,
  }));
};

const fetchExercisesForView = async ({ view = 'all', userId }) => {
  const normalizedView = String(view || 'all').toLowerCase();

  const baseSelect = `
    SELECT
      e.*,
      CASE WHEN ufe.user_id IS NULL THEN 0 ELSE 1 END AS IsFavorite
    FROM exercises e
    LEFT JOIN user_favorite_exercises ufe
      ON ufe.exercise_id = e.ExerciseID
      AND ufe.user_id = ?
  `;

  if (normalizedView === 'mine' || normalizedView === 'my') {
    const [rows] = await pool.query(
      `${baseSelect}
       WHERE e.CreatedByUserID = ?
       ORDER BY e.ExerciseTitle ASC`,
      [userId, userId]
    );
    return mapExerciseRowsWithUserFlags(rows, userId);
  }

  if (normalizedView === 'favorites' || normalizedView === 'favourites') {
    const [rows] = await pool.query(
      `${baseSelect}
       WHERE ufe.user_id = ?
       ORDER BY e.ExerciseTitle ASC`,
      [userId, userId]
    );
    return mapExerciseRowsWithUserFlags(rows, userId);
  }

  const [rows] = await pool.query(
    `${baseSelect}
     ORDER BY e.ExerciseTitle ASC`,
    [userId]
  );

  return mapExerciseRowsWithUserFlags(rows, userId);
};

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
    CreatedByUserID: null,
    IsFavorite: 0,
    IsOwnedByCurrentUser: 0,
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
      const currentUserId = requireAuthUserId(req, res);
      if (!currentUserId) return;
      await ensureExerciseSchema();

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

      const [updateResult] = await pool.query(
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

      if (!updateResult.affectedRows) {
        return res.status(404).json({ error: 'Exercise not found' });
      }

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
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

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
      (CreatedByUserID, ExerciseTitle, MuscleGroup, Equipment, WorkoutType, RecordingType, ImageURL, Instructions, ImageGallery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        currentUserId,
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
// Legacy endpoint kept for backward compatibility
router.get('/get-exercises', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const rows = await fetchExercisesForView({ view: req.query?.view || 'all', userId: currentUserId });
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

// New canonical endpoint: filtered exercise view for all / mine / favorites
router.get('/exercises', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const rows = await fetchExercisesForView({ view: req.query?.view || 'all', userId: currentUserId });
    if (Array.isArray(rows) && rows.length > 0) {
      return res.status(200).json(rows);
    }

    // Keep parity with legacy behavior: if DB is empty, show seeded JSON library for "all" view.
    const requestedView = String(req.query?.view || 'all').toLowerCase();
    if (requestedView === 'all') {
      const fallbackRows = readFallbackExercises();
      return res.status(200).json(fallbackRows);
    }

    return res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch /api/exercises:', err?.message || err);
    try {
      const requestedView = String(req.query?.view || 'all').toLowerCase();
      if (requestedView === 'all') {
        const fallbackRows = readFallbackExercises();
        return res.status(200).json(fallbackRows);
      }
    } catch (fallbackErr) {
      console.error('❌ Fallback exercise load failed for /api/exercises:', fallbackErr?.message || fallbackErr);
    }

    return res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

router.get('/exercises/my', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const rows = await fetchExercisesForView({ view: 'mine', userId: currentUserId });
    return res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch /api/exercises/my:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch my exercises' });
  }
});

router.get('/exercises/favorites', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const rows = await fetchExercisesForView({ view: 'favorites', userId: currentUserId });
    return res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch /api/exercises/favorites:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch favorite exercises' });
  }
});

router.post('/exercises/:id/favorite', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const exerciseId = Number(req.params.id || 0);
    if (!exerciseId) {
      return res.status(400).json({ error: 'Invalid exercise id' });
    }

    const [exists] = await pool.query('SELECT ExerciseID FROM exercises WHERE ExerciseID = ? LIMIT 1', [exerciseId]);
    if (!exists.length) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    await pool.query(
      `INSERT INTO user_favorite_exercises (user_id, exercise_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [currentUserId, exerciseId]
    );

    return res.status(200).json({ message: 'Exercise favorited' });
  } catch (err) {
    console.error('❌ Failed to favorite exercise:', err?.message || err);
    return res.status(500).json({ error: 'Failed to favorite exercise' });
  }
});

router.delete('/exercises/:id/favorite', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const exerciseId = Number(req.params.id || 0);
    if (!exerciseId) {
      return res.status(400).json({ error: 'Invalid exercise id' });
    }

    await pool.query(
      'DELETE FROM user_favorite_exercises WHERE user_id = ? AND exercise_id = ?',
      [currentUserId, exerciseId]
    );

    return res.status(200).json({ message: 'Exercise removed from favorites' });
  } catch (err) {
    console.error('❌ Failed to remove favorite exercise:', err?.message || err);
    return res.status(500).json({ error: 'Failed to remove favorite exercise' });
  }
});

router.delete('/delete-exercise/:id', async (req, res) => {
  try {
    const currentUserId = requireAuthUserId(req, res);
    if (!currentUserId) return;
    await ensureExerciseSchema();

    const exerciseId = Number(req.params.id || 0);
    if (!exerciseId) {
      return res.status(400).json({ error: 'Invalid exercise id' });
    }

    const [rows] = await pool.query(
      'SELECT ExerciseTitle, ImageGallery FROM exercises WHERE ExerciseID = ? LIMIT 1',
      [exerciseId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const [deleteResult] = await pool.query('DELETE FROM exercises WHERE ExerciseID = ?', [exerciseId]);
    if (!deleteResult.affectedRows) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    try {
      const imageList = JSON.parse(rows[0].ImageGallery || '[]');
      if (Array.isArray(imageList) && imageList.length) {
        ImageUpload.deleteImagesFromDisk(rows[0].ExerciseTitle, imageList);
      }
    } catch (_) {
      // No-op: image cleanup is best-effort.
    }

    return res.status(200).json({ message: 'Exercise deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete exercise:', err?.message || err);
    return res.status(500).json({ error: 'Failed to delete exercise' });
  }
});

// Check exercises
router.get('/check-exercises', async (req, res) => {
  const currentUserId = requireAuthUserId(req, res);
  if (!currentUserId) return;

  const { exerciseId, date } = req.query;
  const [rows] = await pool.query(
    `SELECT * FROM workout_log WHERE UserID = ? AND ExerciseID = ? AND WorkoutDate = ?`,
    [currentUserId, exerciseId, date]
  );
  res.json({ exists: rows.length > 0, data: rows[0] });
});

module.exports = router;
