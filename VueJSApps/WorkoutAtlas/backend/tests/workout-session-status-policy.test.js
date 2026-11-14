const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WORKOUT_HISTORY_VISIBLE_STATUSES,
  isWorkoutHistoryVisibleStatus,
  isMissedExerciseEligible,
} = require('../utils/workout-session-status-policy.js');

test('workout history status policy includes in-progress and completed states', () => {
  assert.equal(isWorkoutHistoryVisibleStatus('in_progress'), true);
  assert.equal(isWorkoutHistoryVisibleStatus('completed'), true);
  assert.equal(isWorkoutHistoryVisibleStatus('ended'), true);
  assert.equal(isWorkoutHistoryVisibleStatus('cancelled'), true);
  assert.equal(WORKOUT_HISTORY_VISIBLE_STATUSES.includes('in_progress'), true);
});

test('missed exercise eligibility excludes in-progress sessions', () => {
  const eligible = isMissedExerciseEligible({
    sessionId: 10,
    sessionStatus: 'in_progress',
    sets: [
      { setNumber: 1, done: true },
      { setNumber: 2, done: false },
    ],
  });

  assert.equal(eligible, false);
});

test('missed exercise eligibility includes ended-early sessions with incomplete sets', () => {
  const eligible = isMissedExerciseEligible({
    sessionId: 11,
    sessionStatus: 'ended',
    sets: [
      { setNumber: 1, completed: true },
      { setNumber: 2, completed: false },
    ],
  });

  assert.equal(eligible, true);
});

test('missed exercise eligibility excludes completed, cancelled, and fully complete exercises', () => {
  const completedSession = isMissedExerciseEligible({
    sessionId: 12,
    sessionStatus: 'completed',
    sets: [{ setNumber: 1, done: false }],
  });

  const cancelledSession = isMissedExerciseEligible({
    sessionId: 13,
    sessionStatus: 'cancelled',
    sets: [{ setNumber: 1, done: false }],
  });

  const fullyCompleteEndedSession = isMissedExerciseEligible({
    sessionId: 14,
    sessionStatus: 'ended',
    sets: [{ setNumber: 1, done: true }],
  });

  assert.equal(completedSession, false);
  assert.equal(cancelledSession, false);
  assert.equal(fullyCompleteEndedSession, false);
});

test('missed exercise eligibility excludes orphan or invalid records', () => {
  const noSession = isMissedExerciseEligible({
    sessionId: null,
    sessionStatus: 'ended',
    sets: [{ setNumber: 1, done: false }],
  });

  const noSets = isMissedExerciseEligible({
    sessionId: 15,
    sessionStatus: 'ended',
    sets: [],
  });

  assert.equal(noSession, false);
  assert.equal(noSets, false);
});
