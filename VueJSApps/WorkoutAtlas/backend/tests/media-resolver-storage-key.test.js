const test = require('node:test');
const assert = require('node:assert/strict');

const { buildExerciseStorageKey } = require('../services/mediaResolver');

test('buildExerciseStorageKey uses basename for path-like requested names', () => {
  const key = buildExerciseStorageKey(
    {
      ExerciseID: 917,
      MediaPath: 'APP/exercise-library/917/images',
      PrimaryImage: 'exercise.jpg',
    },
    'APP/exercise-library/917/images/exercise.jpg'
  );

  assert.equal(key, 'APP/exercise-library/917/images/exercise.jpg');
});

test('buildExerciseStorageKey resolves default image reference safely', () => {
  const key = buildExerciseStorageKey(
    {
      ExerciseID: 917,
      MediaPath: 'APP/exercise-library/917/images',
      PrimaryImage: 'default.JPG',
    },
    'APP/exercise-library/default.JPG'
  );

  assert.equal(key, 'APP/exercise-library/default.JPG');
});
