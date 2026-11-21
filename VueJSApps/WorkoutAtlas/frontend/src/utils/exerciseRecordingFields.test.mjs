import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRecordingFieldGroups,
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

test('legacy fallback uses Workout Type only when Recording Type is missing', () => {
  assert.equal(normalizeRecordingType({ WorkoutType: 'Strength' }), 'sets-reps');
  assert.equal(normalizeRecordingType({ WorkoutType: 'Cardio' }), 'time-distance');
  assert.equal(normalizeRecordingType({ WorkoutType: 'Cardio', RecordingType: 'Sets & Reps' }), 'sets-reps');
});

test('Workout Type badge labels resolve Strength, Cardio, and Other independently of Recording Type', () => {
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: 'Strength', RecordingType: 'Time & Distance' }), 'Strength');
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: 'Cardio', RecordingType: 'Sets & Reps' }), 'Cardio');
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: 'Other', RecordingType: 'Custom' }), 'Other');
  assert.equal(normalizeWorkoutTypeBadge({ WorkoutType: '' }), '');
});
