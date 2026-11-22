import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRecordingFieldGroups,
  getRecordingFieldLabels,
  normalizeRecordingType,
  normalizeWorkoutTypeBadge,
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
