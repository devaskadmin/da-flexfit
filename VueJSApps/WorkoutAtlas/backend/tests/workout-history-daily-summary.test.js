const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDailyWorkoutDurationSummary,
} = require('../utils/workout-history-summary.js');

test('daily summary includes one completed workout with persisted duration', () => {
  const summary = buildDailyWorkoutDurationSummary([
    { sessionId: 101, sessionStatus: 'completed', sessionDurationSeconds: 2105 },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 2105,
    includedCompletedSessionCount: 1,
  });
});

test('daily summary sums two completed workouts on the same date', () => {
  const summary = buildDailyWorkoutDurationSummary([
    { sessionId: 201, sessionStatus: 'completed', sessionDurationSeconds: 2105 },
    { sessionId: 202, sessionStatus: 'completed', sessionDurationSeconds: 993 },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 3098,
    includedCompletedSessionCount: 2,
  });
});

test('daily summary includes multiple plans and day labels when sessions are completed', () => {
  const summary = buildDailyWorkoutDurationSummary([
    { sessionId: 301, planName: 'Plan A', workoutDayName: 'Tuesday', sessionStatus: 'completed', sessionDurationSeconds: 1200 },
    { sessionId: 302, planName: 'Plan B', workoutDayName: 'Tuesday', sessionStatus: 'completed', sessionDurationSeconds: 1500 },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 2700,
    includedCompletedSessionCount: 2,
  });
});

test('daily summary ignores cancelled and in-progress sessions', () => {
  const summary = buildDailyWorkoutDurationSummary([
    { sessionId: 401, sessionStatus: 'cancelled', sessionDurationSeconds: 800 },
    { sessionId: 402, sessionStatus: 'in_progress', sessionDurationSeconds: 900 },
    { sessionId: 403, sessionStatus: 'completed', sessionDurationSeconds: 600 },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 600,
    includedCompletedSessionCount: 1,
  });
});

test('daily summary ignores missing or invalid persisted durations', () => {
  const summary = buildDailyWorkoutDurationSummary([
    { sessionId: 501, sessionStatus: 'completed', sessionDurationSeconds: 0 },
    { sessionId: 502, sessionStatus: 'completed', sessionDurationSeconds: null },
    { sessionId: 503, sessionStatus: 'completed', sessionDurationSeconds: 'bad-value' },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 0,
    includedCompletedSessionCount: 0,
  });
});

test('daily summary deduplicates duplicate session ids', () => {
  const summary = buildDailyWorkoutDurationSummary([
    { sessionId: 601, sessionStatus: 'completed', sessionDurationSeconds: 1200 },
    { sessionId: 601, sessionStatus: 'completed', sessionDurationSeconds: 1200 },
    { sessionId: 602, sessionStatus: 'completed', sessionDurationSeconds: 300 },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 1500,
    includedCompletedSessionCount: 2,
  });
});

test('daily summary deduplicates legacy records without session id using fallback identity', () => {
  const summary = buildDailyWorkoutDurationSummary([
    {
      sessionId: null,
      workoutDate: '2026-11-17',
      sessionStartedAt: '2026-11-17T11:00:00.000Z',
      sessionCompletedAt: '2026-11-17T11:30:00.000Z',
      planName: 'Legacy Plan',
      workoutDayName: 'Tuesday',
      sessionStatus: 'completed',
      sessionDurationSeconds: 1800,
    },
    {
      sessionId: null,
      workoutDate: '2026-11-17',
      sessionStartedAt: '2026-11-17T11:00:00.000Z',
      sessionCompletedAt: '2026-11-17T11:30:00.000Z',
      planName: 'Legacy Plan',
      workoutDayName: 'Tuesday',
      sessionStatus: 'completed',
      sessionDurationSeconds: 1800,
    },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 1800,
    includedCompletedSessionCount: 1,
  });
});

test('daily summary includes cardio and strength completed sessions together', () => {
  const summary = buildDailyWorkoutDurationSummary([
    {
      sessionId: 701,
      sessionStatus: 'completed',
      sessionDurationSeconds: 900,
      exercises: [{ workoutType: 'Cardio' }],
    },
    {
      sessionId: 702,
      sessionStatus: 'completed',
      sessionDurationSeconds: 1200,
      exercises: [{ workoutType: 'Strength' }],
    },
  ]);

  assert.deepEqual(summary, {
    totalDurationSeconds: 2100,
    includedCompletedSessionCount: 2,
  });
});

test('daily summary returns zeros for non-array input', () => {
  const summary = buildDailyWorkoutDurationSummary(null);

  assert.deepEqual(summary, {
    totalDurationSeconds: 0,
    includedCompletedSessionCount: 0,
  });
});
