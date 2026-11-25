import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalogRecordingTypeMap,
  getRecordingFieldGroups,
  getRecordingFieldLabels,
  normalizeRecordingType,
  normalizeWorkoutTypeBadge,
  resolveExerciseRecordingType,
} from './exerciseRecordingFields.js';

test('Sets & Reps is primary with cardio fields secondary', () => {
  const fields = getRecordingFieldGroups({ RecordingType: 'Sets & Reps', WorkoutType: 'Cardio' });
  assert.deepEqual(fields.primary, ['weight', 'reps', 'sets']);
  assert.deepEqual(fields.secondary, ['duration', 'calories', 'distance']);
});

test('Time & Distance is primary with strength fields secondary', () => {
  const fields = getRecordingFieldGroups({ RecordingType: 'Time & Distance', WorkoutType: 'Strength' });
  assert.deepEqual(fields.primary, ['duration', 'calories', 'distance']);
  assert.deepEqual(fields.secondary, ['weight', 'reps', 'sets']);
});

test('Custom records strength fields first', () => {
  const fields = getRecordingFieldGroups({ RecordingType: 'Custom' });
  assert.deepEqual(fields.primary, ['weight', 'reps', 'sets']);
  assert.deepEqual(fields.secondary, ['duration', 'calories', 'distance']);
});

test('Workout Type never determines Recording field order', () => {
  assert.equal(normalizeRecordingType({ WorkoutType: 'Strength' }), '');
  assert.equal(normalizeRecordingType({ WorkoutType: 'Cardio' }), '');
  assert.equal(normalizeRecordingType({ WorkoutType: 'Cardio', RecordingType: 'Sets & Reps' }), 'sets-reps');
});

test('LBS replaces the Weight label in shared recording fields', () => {
  const labels = getRecordingFieldLabels();
  assert.equal(labels.weight, 'LBS');
  assert.equal(labels.reps, 'Reps');
  assert.equal(labels.sets, 'Sets');
});

test('Workout Type badge labels resolve Strength, Cardio, and Other independently of Recording Type', () => {
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: 'Strength', RecordingType: 'Time & Distance' }), 'Strength');
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: 'Cardio', RecordingType: 'Sets & Reps' }), 'Cardio');
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: 'Other', RecordingType: 'Custom' }), 'Other');
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: '' }), '');
});

test('six recording fields and primary/additional layouts remain complete', () => {
  const labels = getRecordingFieldLabels();
  assert.deepEqual(Object.keys(labels).sort(), ['calories', 'distance', 'duration', 'reps', 'sets', 'weight']);
  const setsReps = getRecordingFieldGroups({ RecordingType: 'Sets & Reps' });
  assert.equal(setsReps.primary.length, 3);
  assert.equal(setsReps.secondary.length, 3);
  const timeDistance = getRecordingFieldGroups({ RecordingType: 'Time & Distance' });
  assert.equal(timeDistance.primary.length, 3);
  assert.equal(timeDistance.secondary.length, 3);
});

test('0.85.317: saved plan exercises resolve Recording Type from the Exercise Database catalog by id', () => {
  const catalog = buildCatalogRecordingTypeMap([
    { ExerciseID: 11, RecordingType: 'Time & Distance', WorkoutType: 'Cardio' },
    { ExerciseID: 12, RecordingType: 'Sets & Reps', WorkoutType: 'Cardio' },
    { ExerciseID: 13, RecordingType: 'Custom' },
    { ExerciseID: 14, RecordingType: 'Cardio' },
    { ExerciseID: 15, WorkoutType: 'Cardio' },
  ]);
  assert.equal(resolveExerciseRecordingType({ exerciseId: 11 }, catalog), 'Time & Distance');
  assert.deepEqual(getRecordingFieldGroups(resolveExerciseRecordingType({ exerciseId: 11 }, catalog)).primary, ['duration', 'calories', 'distance']);
  assert.deepEqual(getRecordingFieldGroups(resolveExerciseRecordingType({ exerciseId: 12 }, catalog)).primary, ['weight', 'reps', 'sets']);
  assert.deepEqual(getRecordingFieldGroups(resolveExerciseRecordingType({ exerciseId: 13 }, catalog)).primary, ['weight', 'reps', 'sets']);
});

test('0.85.317: an explicit Recording Type on the exercise wins; unknown values and Workout Type never create one', () => {
  const catalog = buildCatalogRecordingTypeMap([{ ExerciseID: 11, RecordingType: 'Time & Distance' }]);
  assert.equal(resolveExerciseRecordingType({ exerciseId: 11, recordingType: 'Sets & Reps' }, catalog), 'Sets & Reps');
  assert.equal(resolveExerciseRecordingType({ exerciseId: 99, workoutType: 'Cardio' }, catalog), '');
  assert.equal(resolveExerciseRecordingType({ workoutType: 'Cardio' }, catalog), '');
  assert.equal(buildCatalogRecordingTypeMap([{ ExerciseID: 14, RecordingType: 'Cardio' }, { ExerciseID: 15, WorkoutType: 'Cardio' }]).size, 0);
  assert.deepEqual(getRecordingFieldGroups('').primary, ['weight', 'reps', 'sets']);
});
