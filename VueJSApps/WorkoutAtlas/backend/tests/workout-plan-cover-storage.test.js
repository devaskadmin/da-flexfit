const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWorkoutPlanImagesPrefix,
  buildWorkoutPlanCanonicalCoverStorageKey,
  normalizePositivePlanId,
  isCanonicalWorkoutPlanCoverStorageKeyForPlan,
  assertCanonicalWorkoutPlanCoverStorageKeyForPlan,
  resolveWorkoutPlanCoverImageReference,
  getWorkoutPlanCoverStorageConfig,
} = require('../services/workoutPlanCoverStorage');

test('normalizePositivePlanId accepts valid plan id values', () => {
  assert.equal(normalizePositivePlanId(42), 42);
  assert.equal(normalizePositivePlanId('7'), 7);
});

test('normalizePositivePlanId rejects invalid plan id values', () => {
  assert.throws(() => normalizePositivePlanId(0), /positive integer/i);
  assert.throws(() => normalizePositivePlanId(-10), /positive integer/i);
  assert.throws(() => normalizePositivePlanId('abc'), /positive integer/i);
  assert.throws(() => normalizePositivePlanId(1.5), /positive integer/i);
});

test('buildWorkoutPlanImagesPrefix and canonical cover key use required structure', () => {
  assert.equal(
    buildWorkoutPlanImagesPrefix(321),
    'APP/workout-plans/321/images'
  );

  assert.equal(
    buildWorkoutPlanCanonicalCoverStorageKey(321),
    'APP/workout-plans/321/images/cover.jpg'
  );
});

test('canonical key guard prevents path traversal and arbitrary paths', () => {
  assert.equal(
    isCanonicalWorkoutPlanCoverStorageKeyForPlan(100, 'APP/workout-plans/100/images/cover.jpg'),
    true
  );

  assert.equal(
    isCanonicalWorkoutPlanCoverStorageKeyForPlan(100, 'APP/workout-plans/100/images/../secrets.txt'),
    false
  );

  assert.equal(
    isCanonicalWorkoutPlanCoverStorageKeyForPlan(100, 'APP/exercise-library/100/images/cover.jpg'),
    false
  );

  assert.throws(
    () => assertCanonicalWorkoutPlanCoverStorageKeyForPlan(100, 'APP/workout-plans/100/images/custom-name.png'),
    /canonical key/i
  );
});

test('canonical key guard blocks cross-plan key usage', () => {
  const plan42Key = buildWorkoutPlanCanonicalCoverStorageKey(42);
  const plan43Key = buildWorkoutPlanCanonicalCoverStorageKey(43);

  assert.equal(isCanonicalWorkoutPlanCoverStorageKeyForPlan(42, plan42Key), true);
  assert.equal(isCanonicalWorkoutPlanCoverStorageKeyForPlan(42, plan43Key), false);
  assert.throws(() => assertCanonicalWorkoutPlanCoverStorageKeyForPlan(42, plan43Key), /canonical key/i);
});

test('resolveWorkoutPlanCoverImageReference keeps legacy cover behavior unchanged', () => {
  const legacyCover = '/api/media/exercises/91/image?name=exercise.jpg';

  assert.equal(
    resolveWorkoutPlanCoverImageReference({
      cover_image: legacyCover,
      cover_image_storage_key: 'APP/workout-plans/42/images/cover.jpg',
      cover_image_content_type: 'image/jpeg',
      cover_image_updated_at: '2026-10-30 11:00:00',
    }),
    legacyCover
  );

  assert.equal(
    resolveWorkoutPlanCoverImageReference({
      cover_image_storage_key: 'APP/workout-plans/42/images/cover.jpg',
    }),
    ''
  );
});

test('getWorkoutPlanCoverStorageConfig keeps storage bucket centralized', () => {
  const config = getWorkoutPlanCoverStorageConfig(12, {
    STORAGE_BUCKET: 'workoutatlas-s3-data',
  });

  assert.equal(config.planId, 12);
  assert.equal(config.bucket, 'workoutatlas-s3-data');
  assert.equal(config.prefix, 'APP/workout-plans/12/images');
  assert.equal(config.storageKey, 'APP/workout-plans/12/images/cover.jpg');
  assert.equal(config.contentType, 'image/jpeg');
});
