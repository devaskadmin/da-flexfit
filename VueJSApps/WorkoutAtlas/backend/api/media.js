const express = require('express');
const pool = require('../db');
const {
  ensureExerciseMediaColumns,
  resolveExerciseMediaRow,
  streamExerciseImage,
  toSafeRelativePath,
} = require('../services/mediaResolver');
const {
  normalizePositivePlanId,
  WORKOUT_PLAN_CANONICAL_COVER_FILE,
  WORKOUT_PLAN_DEFAULT_IMAGE_FILE,
  WORKOUT_PLAN_STORAGE_ROOT,
} = require('../services/workoutPlanCoverStorage');
const {
  getWorkoutPlanCoverRow,
  canReadWorkoutPlanCover,
  getWorkoutPlanCoverDescriptor,
  getWorkoutPlanCoverPlaceholderDescriptor,
  resolveCanonicalCoverStorageKeyForPlan,
} = require('../services/workoutPlanCoverService');
const { canReadExerciseForUser } = require('./excerises');

const router = express.Router();

router.get('/media/default-exercise-image', async (req, res) => {
  const requestedName = toSafeRelativePath(req.query?.name || 'default.JPG') || 'default.JPG';

  try {
    await streamExerciseImage(res, {
      ExerciseID: 0,
      MediaProvider: 'LOCAL',
      MediaPath: 'APP/exercise-library',
      PrimaryImage: requestedName,
    }, requestedName);
    return;
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('Default exercise media stream failed:', error?.message || error);
    return res.status(status).json({
      error: status === 404 ? 'Default exercise image not found.' : 'Failed to resolve the default exercise image.',
      detail: error?.message || null,
    });
  }
});

router.get('/media/default-workout-plan-image', async (req, res) => {
  const requestedName = toSafeRelativePath(req.query?.name || WORKOUT_PLAN_DEFAULT_IMAGE_FILE) || WORKOUT_PLAN_DEFAULT_IMAGE_FILE;

  try {
    await streamExerciseImage(res, {
      ExerciseID: 0,
      MediaProvider: 'LOCAL',
      MediaPath: WORKOUT_PLAN_STORAGE_ROOT,
      PrimaryImage: requestedName,
    }, requestedName);
    return;
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('Default workout plan media stream failed:', error?.message || error);
    return res.status(status).json({
      error: status === 404 ? 'Default workout plan image not found.' : 'Failed to resolve the default workout plan image.',
      detail: error?.message || null,
    });
  }
});

router.get('/media/exercises/:exerciseId/image', async (req, res) => {
  const exerciseId = Number(req.params.exerciseId || 0);
  if (!exerciseId) {
    return res.status(400).json({ error: 'Invalid exercise id.' });
  }

  const currentUserId = Number(req?.session?.user?.id || 0);
  if (!currentUserId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const requestedName = toSafeRelativePath(req.query?.name || '');

  try {
    await ensureExerciseMediaColumns(pool);

    const [rows] = await pool.query(
      `SELECT ExerciseID, ImageURL, ImageGallery, MediaProvider, MediaPath, PrimaryImage,
              CreatedByUserID, OwnerTrainerID, SourceExerciseID,
              ExerciseScope, ExercisePublicationState, IsGlobalExercise,
              COALESCE(IsSystemExercise, 0) AS IsSystemExercise
       FROM exercises
       WHERE ExerciseID = ?
       LIMIT 1`,
      [exerciseId]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Exercise not found.' });
    }

    if (!canReadExerciseForUser({ req, exercise: rows[0] })) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this exercise media.' });
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

router.get('/media/workout-plans/:planId/cover', async (req, res) => {
  let planId = 0;

  try {
    planId = normalizePositivePlanId(req.params?.planId);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid plan id.' });
  }

  try {
    const plan = await getWorkoutPlanCoverRow(pool, planId);
    if (!plan) {
      return res.status(404).json({ error: 'Workout plan cover not found.' });
    }

    const readAccess = await canReadWorkoutPlanCover({ req, pool, plan });
    if (!readAccess.ok) {
      return res.status(readAccess.statusCode).json({ error: readAccess.error });
    }

    const coverStorageKey = String(plan.cover_image_storage_key || '').trim();
    if (!coverStorageKey) {
      const placeholder = getWorkoutPlanCoverPlaceholderDescriptor();
      await streamExerciseImage(res, {
        ExerciseID: 0,
        MediaProvider: placeholder.mediaProvider,
        MediaPath: placeholder.mediaPath,
        PrimaryImage: placeholder.imageName,
      }, placeholder.imageName);
      return;
    }

    resolveCanonicalCoverStorageKeyForPlan(planId, coverStorageKey);

    const coverDescriptor = getWorkoutPlanCoverDescriptor(planId);
    await streamExerciseImage(res, {
      ExerciseID: planId,
      MediaProvider: coverDescriptor.mediaProvider,
      MediaPath: coverDescriptor.mediaPath,
      PrimaryImage: WORKOUT_PLAN_CANONICAL_COVER_FILE,
    }, WORKOUT_PLAN_CANONICAL_COVER_FILE);
    return;
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('Workout plan cover media stream failed:', error?.message || error);
    return res.status(status).json({
      error: status === 404
        ? 'Workout plan cover not found.'
        : 'Failed to resolve workout plan cover image.',
      detail: error?.message || null,
    });
  }
});

module.exports = router;
