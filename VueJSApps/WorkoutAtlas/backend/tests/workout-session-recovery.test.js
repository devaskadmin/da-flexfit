const test = require('node:test');
const assert = require('node:assert/strict');

const workoutSessionsRoute = require('../api/workout-sessions');

const {
  parseDraftPayload,
  getDraftExerciseCount,
} = workoutSessionsRoute._private;

test('parseDraftPayload parses JSON notes payload', () => {
  const payload = parseDraftPayload('{"version":1,"exercises":[{"id":"wse-1"}]}');
  assert.equal(payload.version, 1);
  assert.equal(Array.isArray(payload.exercises), true);
  assert.equal(payload.exercises.length, 1);
});

test('parseDraftPayload safely handles invalid payloads', () => {
  assert.equal(parseDraftPayload(null), null);
  assert.equal(parseDraftPayload('not-json'), null);
  assert.deepEqual(parseDraftPayload({ version: 1 }), { version: 1 });
});

test('getDraftExerciseCount returns zero when notes are missing or malformed', () => {
  assert.equal(getDraftExerciseCount(null), 0);
  assert.equal(getDraftExerciseCount('bogus'), 0);
  assert.equal(getDraftExerciseCount('{"version":1}'), 0);
});

test('getDraftExerciseCount returns exercise count from draft notes', () => {
  const notes = JSON.stringify({
    version: 1,
    exercises: [
      { id: 'wse-101' },
      { id: 'wse-102' },
      { id: 'wse-103' },
    ],
  });

  assert.equal(getDraftExerciseCount(notes), 3);
});
