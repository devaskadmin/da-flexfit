const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  WORKOUT_HISTORY_VISIBLE_STATUSES,
} = require('../utils/workout-session-status-policy.js');

const DB_MODULE_PATH = path.resolve(__dirname, '../db.js');
const ROUTE_MODULE_PATH = path.resolve(__dirname, '../api/workout-log.js');

const loadRouteWithMockPool = (mockPool) => {
  const originalDbCache = require.cache[DB_MODULE_PATH];
  const originalRouteCache = require.cache[ROUTE_MODULE_PATH];

  require.cache[DB_MODULE_PATH] = {
    id: DB_MODULE_PATH,
    filename: DB_MODULE_PATH,
    loaded: true,
    exports: mockPool,
  };

  delete require.cache[ROUTE_MODULE_PATH];
  const route = require(ROUTE_MODULE_PATH);

  const restore = () => {
    if (originalDbCache) {
      require.cache[DB_MODULE_PATH] = originalDbCache;
    } else {
      delete require.cache[DB_MODULE_PATH];
    }

    if (originalRouteCache) {
      require.cache[ROUTE_MODULE_PATH] = originalRouteCache;
    } else {
      delete require.cache[ROUTE_MODULE_PATH];
    }
  };

  return { route, restore };
};

const getBusinessHandler = (route, method, routePath) => {
  const layer = route.stack.find(
    (entry) => entry.route && entry.route.path === routePath && entry.route.methods[method]
  );
  assert.ok(layer, `Missing route ${method.toUpperCase()} ${routePath}`);
  assert.ok(layer.route.stack.length >= 1, `Missing business handler for ${routePath}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

const createResponseRecorder = () => {
  const recorder = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return recorder;
};

test('workout history includes in-progress, ended, completed, and cancelled sessions with persisted sets', async () => {
  let capturedHistoryStatuses = null;

  const mockPool = {
    query: async (sql, params = []) => {
      const normalizedSql = String(sql || '').replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM workout_log wl')) {
        capturedHistoryStatuses = params[2];
        return [[
          {
            workoutLogId: 2001,
            sessionId: 701,
            workoutDate: '2026-11-13',
            workoutType: 'Strength',
            totalSets: 2,
            avgReps: 10,
            avgWeight: 100,
            totalDuration: 0,
            calories: null,
            distance: null,
            speed: null,
            scheduleGroup: 'Monday',
            sessionStatus: 'in_progress',
            sessionStartedAt: '2026-11-13T10:00:00.000Z',
            sessionEndedAt: null,
            sessionDurationSeconds: 300,
            sessionCompletedAt: null,
            sessionWorkoutDate: '2026-11-13',
            planName: 'Plan A',
            exerciseName: 'Bench Press',
            exerciseImage: null,
            muscleGroup: 'Chest',
            equipment: 'Barbell',
          },
          {
            workoutLogId: 2002,
            sessionId: 702,
            workoutDate: '2026-11-13',
            workoutType: 'Strength',
            totalSets: 1,
            avgReps: 8,
            avgWeight: 80,
            totalDuration: 0,
            calories: null,
            distance: null,
            speed: null,
            scheduleGroup: 'Tuesday',
            sessionStatus: 'ended',
            sessionStartedAt: '2026-11-13T08:00:00.000Z',
            sessionEndedAt: '2026-11-13T08:20:00.000Z',
            sessionDurationSeconds: 1200,
            sessionCompletedAt: '2026-11-13T08:20:00.000Z',
            sessionWorkoutDate: '2026-11-13',
            planName: 'Plan B',
            exerciseName: 'Squat',
            exerciseImage: null,
            muscleGroup: 'Legs',
            equipment: 'Barbell',
          },
          {
            workoutLogId: 2003,
            sessionId: 703,
            workoutDate: '2026-11-13',
            workoutType: 'Cardio',
            totalSets: 1,
            avgReps: 0,
            avgWeight: 0,
            totalDuration: 15,
            calories: 120,
            distance: 2.1,
            speed: 8.4,
            scheduleGroup: 'Wednesday',
            sessionStatus: 'completed',
            sessionStartedAt: '2026-11-13T06:00:00.000Z',
            sessionEndedAt: '2026-11-13T06:20:00.000Z',
            sessionDurationSeconds: 1200,
            sessionCompletedAt: '2026-11-13T06:20:00.000Z',
            sessionWorkoutDate: '2026-11-13',
            planName: 'Plan C',
            exerciseName: 'Run',
            exerciseImage: null,
            muscleGroup: 'Cardio',
            equipment: 'Treadmill',
          },
          {
            workoutLogId: 2004,
            sessionId: 704,
            workoutDate: '2026-11-13',
            workoutType: 'Strength',
            totalSets: 1,
            avgReps: 5,
            avgWeight: 45,
            totalDuration: 0,
            calories: null,
            distance: null,
            speed: null,
            scheduleGroup: 'Thursday',
            sessionStatus: 'cancelled',
            sessionStartedAt: '2026-11-13T07:00:00.000Z',
            sessionEndedAt: '2026-11-13T07:10:00.000Z',
            sessionDurationSeconds: 600,
            sessionCompletedAt: '2026-11-13T07:10:00.000Z',
            sessionWorkoutDate: '2026-11-13',
            planName: 'Plan D',
            exerciseName: 'Row',
            exerciseImage: null,
            muscleGroup: 'Back',
            equipment: 'Cable',
          },
        ], []];
      }

      if (normalizedSql.includes('FROM workout_log_sets')) {
        return [[
          { workoutLogId: 2001, setNumber: 1, weight: 100, reps: 10, duration: null, caloriesBurned: null, distanceMiles: null, speedMph: null, completed: 1 },
          { workoutLogId: 2001, setNumber: 2, weight: 100, reps: 10, duration: null, caloriesBurned: null, distanceMiles: null, speedMph: null, completed: 0 },
          { workoutLogId: 2002, setNumber: 1, weight: 80, reps: 8, duration: null, caloriesBurned: null, distanceMiles: null, speedMph: null, completed: 0 },
          { workoutLogId: 2003, setNumber: 1, weight: null, reps: null, duration: 15, caloriesBurned: 120, distanceMiles: 2.1, speedMph: 8.4, completed: 1 },
          { workoutLogId: 2004, setNumber: 1, weight: 45, reps: 5, duration: null, caloriesBurned: null, distanceMiles: null, speedMph: null, completed: 0 },
        ], []];
      }

      throw new Error(`Unhandled SQL: ${normalizedSql}`);
    },
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const historyHandler = getBusinessHandler(route, 'get', '/history');
    const req = {
      session: { user: { id: 88, username: 'tester' } },
      query: { date: '2026-11-13' },
    };
    const res = createResponseRecorder();

    await historyHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedHistoryStatuses, WORKOUT_HISTORY_VISIBLE_STATUSES);

    const sessionStatuses = res.body.sessions
      .map((session) => session.sessionStatus)
      .sort();

    assert.deepEqual(sessionStatuses, ['cancelled', 'completed', 'ended', 'in_progress']);

    const inProgressSession = res.body.sessions.find((session) => session.sessionStatus === 'in_progress');
    assert.ok(inProgressSession);
    assert.equal(inProgressSession.exercises.length, 1);
    assert.equal(inProgressSession.exercises[0].sets.length, 2);

    const completedSession = res.body.sessions.find((session) => session.sessionStatus === 'completed');
    assert.ok(completedSession);
    assert.equal(completedSession.exercises[0].sets.length, 1);
  } finally {
    restore();
  }
});
