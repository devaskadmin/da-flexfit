const express = require('express');
const pool = require('../db');
const {
  ensureExerciseMediaColumns,
  resolveExerciseMediaRow,
  streamExerciseImage,
  toSafeRelativePath,
} = require('../services/mediaResolver');

const router = express.Router();

router.get('/media/exercises/:exerciseId/image', async (req, res) => {
  const exerciseId = Number(req.params.exerciseId || 0);
  if (!exerciseId) {
    return res.status(400).json({ error: 'Invalid exercise id.' });
  }

  const requestedName = toSafeRelativePath(req.query?.name || '');

  try {
    await ensureExerciseMediaColumns(pool);

    const [rows] = await pool.query(
      `SELECT ExerciseID, ImageURL, ImageGallery, MediaProvider, MediaPath, PrimaryImage
       FROM exercises
       WHERE ExerciseID = ?
       LIMIT 1`,
      [exerciseId]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Exercise not found.' });
    }

    const mediaRow = resolveExerciseMediaRow(rows[0]);
    await streamExerciseImage(res, mediaRow, requestedName || mediaRow.PrimaryImage);
    return;
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('Exercise media stream failed:', error?.message || error);
    return res.status(status).json({
      error: status === 404 ? 'Exercise image not found.' : 'Failed to resolve exercise image.',
      detail: error?.message || null,
    });
  }
});

module.exports = router;
