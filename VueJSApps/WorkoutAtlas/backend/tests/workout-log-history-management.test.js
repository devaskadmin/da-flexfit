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

const createConnectionRecorder = (queryHandler) => {
  const recorder = {
    queries: [],
    began: false,
    committed: false,
    rolledBack: false,
    released: false,
  };

  const connection = {
    beginTransaction: async () => {
      recorder.began = true;
    },
    commit: async () => {
      recorder.committed = true;
    },
    rollback: async () => {
      recorder.rolledBack = true;
    },
    release: () => {
      recorder.released = true;
    },
    query: async (sql, params = []) => {
      const normalizedSql = String(sql || '').replace(/\s+/g, ' ').trim();
      recorder.queries.push({ sql: normalizedSql, params });
      return queryHandler(normalizedSql, params);
    },
  };

  return { connection, recorder };
};

test('history update persists corrected sets and workout date without creating a new session', async () => {
  const { connection, recorder } = createConnectionRecorder(async (sql) => {
    if (sql.includes('FROM workout_log_sessions')) {
      return [[{ id: 77, user_id: 5, status: 'completed', workout_date: '2026-11-18' }], []];
    }

    if (sql.includes('SELECT WorkoutLogID FROM workout_log')) {
      return [[{ WorkoutLogID: 9001 }], []];
    }

    return [[{ affectedRows: 1 }], []];
  });

  const mockPool = {
    getConnection: async () => connection,
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'put', '/history/session/:sessionId');
    const req = {
      params: { sessionId: '77' },
      session: { user: { id: 5 } },
      body: {
        workoutDate: '2026-11-17',
        exercises: [
          {
            workoutLogId: 9001,
            sets: [
              { setNumber: 1, reps: 10, weight: 100, duration: 0, caloriesBurned: 0, distanceMiles: 0, speedMph: 0 },
              { setNumber: 2, reps: 8, weight: 110, duration: 0, caloriesBurned: 0, distanceMiles: 0, speedMph: 0 },
            ],
          },
        ],
      },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sessionId, 77);
    assert.equal(res.body.workoutDate, '2026-11-17');
    assert.equal(recorder.committed, true);
    assert.equal(recorder.rolledBack, false);

    assert.ok(recorder.queries.some((entry) => entry.sql.includes('INSERT INTO workout_log_sets')));
    assert.ok(recorder.queries.some((entry) => entry.sql.includes('DELETE FROM workout_log_sets')));
    assert.ok(recorder.queries.some((entry) => entry.sql.includes('UPDATE workout_log_sessions')));
    assert.ok(recorder.queries.some((entry) => entry.sql.includes('UPDATE workout_log SET WorkoutDate')));
  } finally {
    restore();
  }
});

test('history update rejects future workoutDate values', async () => {
  const mockPool = {
    getConnection: async () => {
      throw new Error('getConnection should not be called for rejected future date input');
    },
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'put', '/history/session/:sessionId');
    const req = {
      params: { sessionId: '88' },
      session: { user: { id: 5 } },
      body: {
        workoutDate: '2999-01-01',
        exercises: [{ workoutLogId: 9002, sets: [{ setNumber: 1, reps: 1, weight: 1 }] }],
      },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body?.error || ''), /cannot be in the future/i);
  } finally {
    restore();
  }
});

test('history update blocks non-completed sessions', async () => {
  const { connection, recorder } = createConnectionRecorder(async (sql) => {
    if (sql.includes('FROM workout_log_sessions')) {
      return [[{ id: 77, user_id: 5, status: 'paused', workout_date: '2026-11-18' }], []];
    }
    return [[{ affectedRows: 1 }], []];
  });

  const mockPool = {
    getConnection: async () => connection,
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'put', '/history/session/:sessionId');
    const req = {
      params: { sessionId: '77' },
      session: { user: { id: 5 } },
      body: {
        exercises: [{ workoutLogId: 9001, sets: [{ setNumber: 1, reps: 10, weight: 100 }] }],
      },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body?.error || ''), /only completed workouts can be edited/i);
    assert.equal(recorder.committed, false);
    assert.equal(recorder.rolledBack, true);
  } finally {
    restore();
  }
});

test('history delete blocks non-completed sessions', async () => {
  const { connection, recorder } = createConnectionRecorder(async (sql) => {
    if (sql.includes('FROM workout_log_sessions')) {
      return [[{ id: 91, user_id: 5, status: 'ended' }], []];
    }
    return [[{ affectedRows: 1 }], []];
  });

  const mockPool = {
    getConnection: async () => connection,
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'delete', '/history/session/:sessionId');
    const req = {
      params: { sessionId: '91' },
      session: { user: { id: 5 } },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body?.error || ''), /only completed workouts can be deleted/i);
    assert.equal(recorder.committed, false);
    assert.equal(recorder.rolledBack, true);
  } finally {
    restore();
  }
});

test('history delete removes sets, logs, and session for completed records', async () => {
  const { connection, recorder } = createConnectionRecorder(async (sql) => {
    if (sql.includes('FROM workout_log_sessions')) {
      return [[{ id: 92, user_id: 5, status: 'completed' }], []];
    }

    if (sql.includes('SELECT WorkoutLogID FROM workout_log')) {
      return [[{ WorkoutLogID: 1001 }, { WorkoutLogID: 1002 }], []];
    }

    return [[{ affectedRows: 1 }], []];
  });

  const mockPool = {
    getConnection: async () => connection,
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'delete', '/history/session/:sessionId');
    const req = {
      params: { sessionId: '92' },
      session: { user: { id: 5 } },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sessionId, 92);
    assert.equal(recorder.committed, true);
    assert.equal(recorder.rolledBack, false);

    assert.ok(recorder.queries.some((entry) => entry.sql.includes('DELETE FROM workout_log_sets')));
    assert.ok(recorder.queries.some((entry) => entry.sql.includes('DELETE FROM workout_log WHERE workout_log_session_id')));
    assert.ok(recorder.queries.some((entry) => entry.sql.includes('DELETE FROM workout_log_sessions')));
  } finally {
    restore();
  }
});
