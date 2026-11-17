const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

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

const createResponseRecorder = () => ({
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
});

const createSessionSaveHarness = ({ sessions, existingLogs = [] }) => {
  const state = {
    sessions: sessions.map((entry) => ({ ...entry })),
    logs: existingLogs.map((entry) => ({ ...entry })),
    logSetsByLogId: new Map(),
    deleteCutoffs: [],
    nextWorkoutLogId: 9000,
  };

  const findLogBySessionAndExercise = ({ workoutLogSessionId, userId, exerciseId, scheduleGroup }) => {
    const normalizedGroup = String(scheduleGroup || '').trim();
    return (
      state.logs.find(
        (row) =>
          Number(row.workoutLogSessionId) === Number(workoutLogSessionId) &&
          Number(row.userId) === Number(userId) &&
          Number(row.exerciseId) === Number(exerciseId) &&
          String(row.scheduleGroup || '').trim() === normalizedGroup
      ) || null
    );
  };

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params = []) => {
      const normalizedSql = String(sql || '').replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM workout_log_sessions') && normalizedSql.includes('WHERE id = ?')) {
        const sessionId = Number(params[0] || 0);
        const session = state.sessions.find((row) => Number(row.id) === sessionId);
        if (!session) {
          return [[/* empty */], []];
        }
        return [[{
          id: session.id,
          user_id: session.userId,
          status: session.status,
          workoutPlanId: session.workoutPlanId || null,
        }], []];
      }

      if (normalizedSql.includes('FROM workout_log') && normalizedSql.includes('AND ExerciseID = ?')) {
        const workoutLogSessionId = Number(params[0] || 0);
        const userId = Number(params[1] || 0);
        const exerciseId = Number(params[2] || 0);
        const scheduleGroup = params[3] || '';
        const existing = findLogBySessionAndExercise({
          workoutLogSessionId,
          userId,
          exerciseId,
          scheduleGroup,
        });
        return [existing ? [{ WorkoutLogID: existing.workoutLogId }] : [], []];
      }

      if (normalizedSql.startsWith('UPDATE workout_log SET')) {
        const [
          exerciseId,
          _sourceScheduleId,
          _sourceScheduleExerciseId,
          scheduleGroup,
          _date,
          _workoutType,
          duration,
          reps,
          sets,
          weight,
          workoutLogId,
          userId,
          workoutLogSessionId,
        ] = params;

        const target =
          state.logs.find((row) => Number(row.workoutLogId) === Number(workoutLogId)) ||
          (() => {
            const created = {
              workoutLogId: Number(workoutLogId),
              workoutLogSessionId: Number(workoutLogSessionId),
              userId: Number(userId),
              exerciseId: Number(exerciseId),
              scheduleGroup: String(scheduleGroup || ''),
            };
            state.logs.push(created);
            return created;
          })();

        target.duration = Number(duration || 0);
        target.reps = Number(reps || 0);
        target.sets = Number(sets || 0);
        target.weight = Number(weight || 0);
        return [{ affectedRows: 1 }, []];
      }

      if (normalizedSql.startsWith('INSERT INTO workout_log ') && normalizedSql.includes('workout_log_session_id')) {
        const [
          workoutLogSessionId,
          userId,
          exerciseId,
          _sourceScheduleId,
          _sourceScheduleExerciseId,
          scheduleGroup,
          _date,
          _workoutType,
          duration,
          reps,
          sets,
          weight,
        ] = params;

        const workoutLogId = state.nextWorkoutLogId;
        state.nextWorkoutLogId += 1;
        state.logs.push({
          workoutLogId,
          workoutLogSessionId: Number(workoutLogSessionId),
          userId: Number(userId),
          exerciseId: Number(exerciseId),
          scheduleGroup: String(scheduleGroup || ''),
          duration: Number(duration || 0),
          reps: Number(reps || 0),
          sets: Number(sets || 0),
          weight: Number(weight || 0),
        });
        return [{ insertId: workoutLogId }, []];
      }

      if (normalizedSql.startsWith('INSERT INTO workout_log_sets')) {
        const [workoutLogId, setNumber, reps, weight, duration, calories, distance, speed, completed] = params;
        if (!state.logSetsByLogId.has(Number(workoutLogId))) {
          state.logSetsByLogId.set(Number(workoutLogId), new Map());
        }
        state.logSetsByLogId.get(Number(workoutLogId)).set(Number(setNumber), {
          reps: reps == null ? null : Number(reps),
          weight: weight == null ? null : Number(weight),
          duration: duration == null ? null : Number(duration),
          calories: calories == null ? null : Number(calories),
          distance: distance == null ? null : Number(distance),
          speed: speed == null ? null : Number(speed),
          completed: Number(completed || 0),
        });
        return [{ affectedRows: 1 }, []];
      }

      if (normalizedSql.startsWith('DELETE FROM workout_log_sets')) {
        const [workoutLogId, maxSetNumber] = params;
        const targetSets = state.logSetsByLogId.get(Number(workoutLogId));
        if (targetSets) {
          for (const key of [...targetSets.keys()]) {
            if (Number(key) > Number(maxSetNumber || 0)) {
              targetSets.delete(key);
            }
          }
        }
        state.deleteCutoffs.push({ workoutLogId: Number(workoutLogId), maxSetNumber: Number(maxSetNumber || 0) });
        return [{ affectedRows: 1 }, []];
      }

      throw new Error(`Unhandled SQL in test harness: ${normalizedSql}`);
    },
  };

  const mockPool = {
    getConnection: async () => connection,
  };

  return { mockPool, state };
};

test('session save persists corrected reps and weight for a completed set edit', async () => {
  const { mockPool, state } = createSessionSaveHarness({
    sessions: [{ id: 11, userId: 7, status: 'in_progress', workoutPlanId: null }],
    existingLogs: [{ workoutLogId: 501, workoutLogSessionId: 11, userId: 7, exerciseId: 100, scheduleGroup: 'Any Day' }],
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'post', '/session');
    const req = {
      session: { user: { id: 7 } },
      body: {
        planId: null,
        workoutSessionId: 11,
        workoutDate: '2026-11-17',
        exercises: [
          {
            id: 'session-ex-1',
            exerciseId: 100,
            workoutType: 'Strength',
            scheduleGroup: 'Any Day',
            sets: [{ setNum: 1, weight: 35, reps: 8, done: true }],
          },
        ],
      },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    const setRow = state.logSetsByLogId.get(501).get(1);
    assert.equal(setRow.weight, 35);
    assert.equal(setRow.reps, 8);
    assert.equal(setRow.completed, 1);
  } finally {
    restore();
  }
});

test('session save keeps the newest value after rapid successive edits', async () => {
  const { mockPool, state } = createSessionSaveHarness({
    sessions: [{ id: 21, userId: 9, status: 'in_progress', workoutPlanId: null }],
    existingLogs: [{ workoutLogId: 601, workoutLogSessionId: 21, userId: 9, exerciseId: 300, scheduleGroup: 'Any Day' }],
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'post', '/session');
    const resA = createResponseRecorder();
    const resB = createResponseRecorder();

    const baseReq = {
      session: { user: { id: 9 } },
      body: {
        planId: null,
        workoutSessionId: 21,
        workoutDate: '2026-11-17',
        exercises: [
          {
            id: 'session-ex-rapid',
            exerciseId: 300,
            workoutType: 'Strength',
            scheduleGroup: 'Any Day',
            sets: [{ setNum: 1, weight: 35, reps: 10, done: true }],
          },
        ],
      },
    };

    await handler(baseReq, resA);

    const correctedReq = {
      ...baseReq,
      body: {
        ...baseReq.body,
        exercises: [{ ...baseReq.body.exercises[0], sets: [{ setNum: 1, weight: 35, reps: 8, done: true }] }],
      },
    };

    await handler(correctedReq, resB);

    assert.equal(resA.statusCode, 201);
    assert.equal(resB.statusCode, 201);

    const setRow = state.logSetsByLogId.get(601).get(1);
    assert.equal(setRow.reps, 8);
    assert.equal(setRow.weight, 35);
  } finally {
    restore();
  }
});

test('session save removes incomplete sets and renumbers persisted set rows', async () => {
  const { mockPool, state } = createSessionSaveHarness({
    sessions: [{ id: 31, userId: 11, status: 'in_progress', workoutPlanId: null }],
    existingLogs: [{ workoutLogId: 701, workoutLogSessionId: 31, userId: 11, exerciseId: 400, scheduleGroup: 'Any Day' }],
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'post', '/session');

    const beforeRemoveReq = {
      session: { user: { id: 11 } },
      body: {
        planId: null,
        workoutSessionId: 31,
        workoutDate: '2026-11-17',
        exercises: [
          {
            id: 'session-ex-remove',
            exerciseId: 400,
            workoutType: 'Strength',
            scheduleGroup: 'Any Day',
            sets: [
              { setNum: 1, weight: 95, reps: 8, done: true },
              { setNum: 2, weight: 95, reps: 6, done: false },
            ],
          },
        ],
      },
    };

    const afterRemoveReq = {
      session: { user: { id: 11 } },
      body: {
        planId: null,
        workoutSessionId: 31,
        workoutDate: '2026-11-17',
        exercises: [
          {
            id: 'session-ex-remove',
            exerciseId: 400,
            workoutType: 'Strength',
            scheduleGroup: 'Any Day',
            sets: [{ setNum: 1, weight: 95, reps: 9, done: true }],
          },
        ],
      },
    };

    const resA = createResponseRecorder();
    const resB = createResponseRecorder();

    await handler(beforeRemoveReq, resA);
    await handler(afterRemoveReq, resB);

    assert.equal(resA.statusCode, 201);
    assert.equal(resB.statusCode, 201);

    const setMap = state.logSetsByLogId.get(701);
    assert.equal(setMap.size, 1);
    assert.equal(setMap.get(1).reps, 9);
    assert.equal(setMap.has(2), false);

    assert.ok(state.deleteCutoffs.some((entry) => entry.workoutLogId === 701 && entry.maxSetNumber === 1));
  } finally {
    restore();
  }
});

test('session save keeps values isolated across two active sessions', async () => {
  const { mockPool, state } = createSessionSaveHarness({
    sessions: [
      { id: 41, userId: 12, status: 'in_progress', workoutPlanId: null },
      { id: 42, userId: 12, status: 'in_progress', workoutPlanId: null },
    ],
    existingLogs: [
      { workoutLogId: 801, workoutLogSessionId: 41, userId: 12, exerciseId: 500, scheduleGroup: 'Any Day' },
      { workoutLogId: 802, workoutLogSessionId: 42, userId: 12, exerciseId: 500, scheduleGroup: 'Any Day' },
    ],
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'post', '/session');

    const resOne = createResponseRecorder();
    const resTwo = createResponseRecorder();

    await handler(
      {
        session: { user: { id: 12 } },
        body: {
          planId: null,
          workoutSessionId: 41,
          workoutDate: '2026-11-17',
          exercises: [
            {
              id: 'session-A',
              exerciseId: 500,
              workoutType: 'Strength',
              scheduleGroup: 'Any Day',
              sets: [{ setNum: 1, weight: 120, reps: 8, done: true }],
            },
          ],
        },
      },
      resOne
    );

    await handler(
      {
        session: { user: { id: 12 } },
        body: {
          planId: null,
          workoutSessionId: 42,
          workoutDate: '2026-11-17',
          exercises: [
            {
              id: 'session-B',
              exerciseId: 500,
              workoutType: 'Strength',
              scheduleGroup: 'Any Day',
              sets: [{ setNum: 1, weight: 95, reps: 12, done: true }],
            },
          ],
        },
      },
      resTwo
    );

    assert.equal(resOne.statusCode, 201);
    assert.equal(resTwo.statusCode, 201);

    assert.equal(state.logSetsByLogId.get(801).get(1).reps, 8);
    assert.equal(state.logSetsByLogId.get(802).get(1).reps, 12);
  } finally {
    restore();
  }
});
