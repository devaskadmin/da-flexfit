const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const DB_MODULE_PATH = path.resolve(__dirname, '../db.js');
const ROUTE_MODULE_PATH = path.resolve(__dirname, '../api/workout-sessions.js');

const clone = (value) => JSON.parse(JSON.stringify(value));

const nowIso = () => new Date().toISOString();

const createMockPool = (seedState = {}) => {
  const state = {
    sessions: clone(seedState.sessions || []),
    workoutSchedules: clone(seedState.workoutSchedules || []),
    workoutScheduleGroups: clone(seedState.workoutScheduleGroups || []),
    workoutLog: clone(seedState.workoutLog || []),
    workoutLogSets: clone(seedState.workoutLogSets || []),
    failInsertOnStart: Boolean(seedState.failInsertOnStart),
    nextSessionId: Number(seedState.nextSessionId || 1000),
    counters: {
      beginTransaction: 0,
      commit: 0,
      rollback: 0,
      insertStartSession: 0,
      updateEndSession: 0,
    },
    userLocks: new Map(),
  };

  const acquireUserLock = async (userId, connectionState) => {
    const normalizedUserId = Number(userId || 0);
    if (!normalizedUserId) {
      return;
    }

    if (connectionState.heldUserLocks.has(normalizedUserId)) {
      return;
    }

    if (!state.userLocks.has(normalizedUserId)) {
      state.userLocks.set(normalizedUserId, { held: false, waiters: [] });
    }

    const lock = state.userLocks.get(normalizedUserId);
    while (lock.held) {
      await new Promise((resolve) => lock.waiters.push(resolve));
    }

    lock.held = true;
    connectionState.heldUserLocks.add(normalizedUserId);
  };

  const releaseUserLocks = (connectionState) => {
    for (const userId of connectionState.heldUserLocks) {
      const lock = state.userLocks.get(userId);
      if (!lock) {
        continue;
      }

      lock.held = false;
      const wakeNext = lock.waiters.shift();
      if (typeof wakeNext === 'function') {
        wakeNext();
      }

      if (!lock.held && lock.waiters.length === 0) {
        state.userLocks.delete(userId);
      }
    }

    connectionState.heldUserLocks.clear();
  };

  const findLiveSessionForUser = (userId) =>
    state.sessions
      .filter((session) => Number(session.user_id) === Number(userId) && session.status === 'in_progress')
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0] || null;

  const findLiveSessionsForUser = (userId) =>
    state.sessions
      .filter((session) => Number(session.user_id) === Number(userId) && session.status === 'in_progress')
      .sort((a, b) => {
        const startedDiff = new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
        if (startedDiff !== 0) {
          return startedDiff;
        }
        return Number(b.id || 0) - Number(a.id || 0);
      });

  const toActiveRow = (session) => ({
    id: session.id,
    userId: session.user_id,
    workoutPlanId: session.source_workout_schedule_id,
    workoutDayId: session.workout_day_id,
    workoutDayName: session.workout_day_name,
    workoutDate: session.workout_date,
    sessionStatus: session.status,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationSeconds: session.duration_seconds,
    completedAt: session.completed_at,
    notes: session.notes,
  });

  const selectScheduleById = (scheduleId) =>
    state.workoutSchedules.filter((schedule) => Number(schedule.id) === Number(scheduleId));

  const selectGroupByIdAndPlan = (groupId, planId) =>
    state.workoutScheduleGroups.filter(
      (group) => Number(group.id) === Number(groupId) && Number(group.workout_schedule_id) === Number(planId)
    );

  const selectGroupByLabelAndPlan = (label, planId) => {
    const normalizedLabel = String(label || '').trim().toLowerCase();
    return state.workoutScheduleGroups.filter(
      (group) =>
        Number(group.workout_schedule_id) === Number(planId) &&
        String(group.label || '').trim().toLowerCase() === normalizedLabel
    );
  };

  const executeQuery = async (sql, params = [], connectionState = null, snapshotForRollbackIfNeeded = null) => {
    const normalizedSql = String(sql || '').replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM users') && normalizedSql.includes('FOR UPDATE')) {
      if (connectionState) {
        await acquireUserLock(params[0], connectionState);
      }
      return [[{ id: Number(params[0]) }], []];
    }

    if (
      normalizedSql.includes('FROM workout_log_sessions') &&
      normalizedSql.includes("WHERE user_id = ? AND status = 'in_progress'") &&
      normalizedSql.includes('ORDER BY started_at DESC, id DESC')
    ) {
      const liveRows = findLiveSessionsForUser(params[0]).map(toActiveRow);
      return [liveRows, []];
    }

    if (normalizedSql.includes('FROM workout_log_sessions') && normalizedSql.includes("WHERE user_id = ? AND status = 'in_progress'") && normalizedSql.includes('SELECT id,')) {
      const active = findLiveSessionForUser(params[0]);
      return [active ? [toActiveRow(active)] : [], []];
    }

    if (normalizedSql.includes('FROM workout_log_sessions') && normalizedSql.includes("WHERE user_id = ? AND status = 'in_progress'") && normalizedSql.startsWith('SELECT')) {
      const active = findLiveSessionForUser(params[0]);
      return [active ? [toActiveRow(active)] : [], []];
    }

    if (normalizedSql.includes('FROM workout_schedules') && normalizedSql.includes('WHERE id = ?')) {
      return [selectScheduleById(params[0]), []];
    }

    if (normalizedSql.includes('FROM workout_schedule_groups') && normalizedSql.includes('WHERE id = ? AND workout_schedule_id = ?')) {
      return [selectGroupByIdAndPlan(params[0], params[1]), []];
    }

    if (normalizedSql.includes('FROM workout_schedule_groups') && normalizedSql.includes('LOWER(label) = LOWER(?)')) {
      return [selectGroupByLabelAndPlan(params[1], params[0]), []];
    }

    if (normalizedSql.startsWith('UPDATE workout_log_sessions') && normalizedSql.includes("SET status = 'ended'")) {
      if (typeof snapshotForRollbackIfNeeded === 'function') {
        snapshotForRollbackIfNeeded();
      }

      const targetId = Number(params[0]);
      const userId = Number(params[1]);
      const target = state.sessions.find(
        (session) =>
          Number(session.id) === targetId &&
          Number(session.user_id) === userId &&
          session.status === 'in_progress'
      );

      if (!target) {
        return [{ affectedRows: 0 }, []];
      }

      state.counters.updateEndSession += 1;
      target.status = 'ended';
      target.ended_at = nowIso();
      target.completed_at = target.completed_at || target.ended_at;
      target.duration_seconds = Math.max(Number(target.duration_seconds || 0), 0);
      return [{ affectedRows: 1 }, []];
    }

    if (normalizedSql.startsWith('INSERT INTO workout_log_sessions')) {
      if (typeof snapshotForRollbackIfNeeded === 'function') {
        snapshotForRollbackIfNeeded();
      }

      if (state.failInsertOnStart) {
        throw new Error('Simulated insert failure');
      }

      state.counters.insertStartSession += 1;
      const [userId, workoutPlanId, workoutDayId, workoutDayName, workoutDate] = params;
      const nextId = state.nextSessionId++;
      state.sessions.push({
        id: nextId,
        user_id: Number(userId),
        source_workout_schedule_id: workoutPlanId == null ? null : Number(workoutPlanId),
        workout_day_id: workoutDayId == null ? null : Number(workoutDayId),
        workout_day_name: String(workoutDayName || ''),
        workout_date: workoutDate,
        status: 'in_progress',
        started_at: nowIso(),
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '',
      });
      return [{ insertId: nextId }, []];
    }

    if (normalizedSql.includes('FROM workout_log_sessions') && normalizedSql.includes('WHERE id = ? AND user_id = ?') && normalizedSql.includes('SELECT id, status')) {
      const sessionId = Number(params[0]);
      const userId = Number(params[1]);
      const row = state.sessions.find(
        (session) => Number(session.id) === sessionId && Number(session.user_id) === userId
      );
      return [row ? [{ id: row.id, status: row.status }] : [], []];
    }

    throw new Error(`Unhandled SQL in mock pool: ${normalizedSql}`);
  };

  const createConnection = () => {
    let txSnapshot = null;
    const snapshotForRollbackIfNeeded = () => {
      if (txSnapshot) {
        return;
      }

      txSnapshot = clone({
        sessions: state.sessions,
        nextSessionId: state.nextSessionId,
        counters: state.counters,
      });
    };
    const connectionState = {
      heldUserLocks: new Set(),
    };

    return {
      query: (sql, params = []) => executeQuery(sql, params, connectionState, snapshotForRollbackIfNeeded),
      beginTransaction: async () => {
        state.counters.beginTransaction += 1;
        txSnapshot = null;
      },
      commit: async () => {
        state.counters.commit += 1;
        txSnapshot = null;
        releaseUserLocks(connectionState);
      },
      rollback: async () => {
        state.counters.rollback += 1;
        if (txSnapshot) {
          state.sessions = txSnapshot.sessions;
          state.nextSessionId = txSnapshot.nextSessionId;
          state.counters = txSnapshot.counters;
          state.counters.rollback += 1;
        }
        releaseUserLocks(connectionState);
      },
      release: () => {
        releaseUserLocks(connectionState);
      },
    };
  };

  return {
    _state: state,
    getConnection: async () => createConnection(),
    query: executeQuery,
  };
};

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

const getBusinessHandler = (route, method, routePath) => {
  const layer = route.stack.find(
    (entry) => entry.route && entry.route.path === routePath && entry.route.methods[method]
  );
  assert.ok(layer, `Missing route ${method.toUpperCase()} ${routePath}`);
  assert.ok(layer.route.stack.length >= 2, `Missing business handler for ${routePath}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

test('deleted-plan orphan active session is detected, ended, and replaced without losing draft/history', async () => {
  const orphanNotes = JSON.stringify({
    version: 1,
    exercises: [{ id: 'wse-orphan-1', exerciseId: 260, sessionSets: [{ setNum: 1, reps: 9, weight: 85 }] }],
  });

  const mockPool = createMockPool({
    sessions: [
      {
        id: 500,
        user_id: 77,
        source_workout_schedule_id: null,
        workout_day_id: null,
        workout_day_name: 'Tuesday - Chest - Biceps',
        workout_date: '2026-10-14',
        status: 'in_progress',
        started_at: '2026-10-14T20:47:17.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: orphanNotes,
      },
    ],
    workoutLog: [
      { WorkoutLogID: 1, workout_log_session_id: 500, UserID: 77, ExerciseID: 260 },
    ],
    workoutLogSets: [
      { id: 1, workout_log_id: 1, set_number: 1, reps: 9, weight: 85 },
    ],
    workoutSchedules: [{ id: 900, user_id: 77, title: 'Disposable Recovery Plan' }],
    nextSessionId: 501,
  });

  const originalWorkoutLogCount = mockPool._state.workoutLog.length;
  const originalWorkoutSetCount = mockPool._state.workoutLogSets.length;

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const getActive = getBusinessHandler(route, 'get', '/workout-sessions/active');
    const start = getBusinessHandler(route, 'post', '/workout-sessions/start');

    const activeReq = { session: { user: { id: 77 } } };
    const activeRes = createResponseRecorder();
    await getActive(activeReq, activeRes);

    assert.equal(activeRes.statusCode, 200);
    assert.equal(activeRes.body.session.id, 500);
    assert.equal(activeRes.body.session.isOrphaned, true);
    assert.equal(activeRes.body.session.orphanReason, 'missing_plan_reference');
    assert.equal(activeRes.body.session.canResumeFromDraft, true);

    const startReq = {
      session: { user: { id: 77 } },
      body: {
        workoutPlanId: 900,
        workoutDayName: 'Any Day',
        workoutDate: '2026-11-12',
        endSessionIds: [500],
      },
    };
    const startRes = createResponseRecorder();
    await start(startReq, startRes);

    assert.equal(startRes.statusCode, 201);
    assert.equal(startRes.body.session.id, 501);
    assert.equal(startRes.body.session.sessionStatus, 'in_progress');

    const preservedOrphan = mockPool._state.sessions.find((session) => session.id === 500);
    assert.equal(preservedOrphan.status, 'ended');
    assert.equal(preservedOrphan.notes, orphanNotes);

    const liveSessions = mockPool._state.sessions.filter((session) => session.status === 'in_progress' && session.user_id === 77);
    assert.equal(liveSessions.length, 1);
    assert.equal(liveSessions.some((session) => session.id === 501), true);

    assert.equal(mockPool._state.workoutLog.length, originalWorkoutLogCount);
    assert.equal(mockPool._state.workoutLogSets.length, originalWorkoutSetCount);
  } finally {
    restore();
  }
});

test('start rejects stale conflict selections without ending or creating sessions', async () => {
  const mockPool = createMockPool({
    sessions: [
      {
        id: 700,
        user_id: 55,
        source_workout_schedule_id: 321,
        workout_day_id: null,
        workout_day_name: 'Any Day',
        workout_date: '2026-11-10',
        status: 'in_progress',
        started_at: '2026-11-10T10:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '',
      },
    ],
    workoutSchedules: [{ id: 321, user_id: 55, title: 'Plan 321' }],
    nextSessionId: 800,
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const start = getBusinessHandler(route, 'post', '/workout-sessions/start');

    const req = {
      session: { user: { id: 55 } },
      body: {
        workoutPlanId: 321,
        workoutDayName: 'Any Day',
        workoutDate: '2026-11-12',
        endSessionIds: [999],
      },
    };
    const res = createResponseRecorder();
    await start(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'STALE_WORKOUT_SESSION_CONFLICT');
    assert.equal(res.body.activeSessions.length, 1);

    const current = mockPool._state.sessions.find((session) => session.id === 700);
    assert.equal(current.status, 'in_progress');
    assert.equal(mockPool._state.sessions.filter((session) => session.user_id === 55).length, 1);
    assert.equal(mockPool._state.counters.insertStartSession, 0);
  } finally {
    restore();
  }
});

test('start rollback preserves existing in-progress sessions when insert fails', async () => {
  const mockPool = createMockPool({
    sessions: [
      {
        id: 800,
        user_id: 42,
        source_workout_schedule_id: 111,
        workout_day_id: null,
        workout_day_name: 'Any Day',
        workout_date: '2026-11-10',
        status: 'in_progress',
        started_at: '2026-11-10T11:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: 'draft',
      },
    ],
    workoutSchedules: [{ id: 111, user_id: 42, title: 'Plan 111' }],
    failInsertOnStart: true,
    nextSessionId: 801,
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const start = getBusinessHandler(route, 'post', '/workout-sessions/start');

    const req = {
      session: { user: { id: 42 } },
      body: {
        workoutPlanId: 111,
        workoutDayName: 'Any Day',
        workoutDate: '2026-11-12',
        endSessionIds: [800],
      },
    };
    const res = createResponseRecorder();
    await start(req, res);

    assert.equal(res.statusCode, 500);

    const original = mockPool._state.sessions.find((session) => session.id === 800);
    assert.equal(original.status, 'in_progress');
    assert.equal(mockPool._state.sessions.filter((session) => session.user_id === 42).length, 1);
    assert.equal(mockPool._state.counters.rollback > 0, true);
  } finally {
    restore();
  }
});

test('repeated start requests return a conflict and do not create a duplicate session', async () => {
  const mockPool = createMockPool({
    sessions: [],
    workoutSchedules: [{ id: 222, user_id: 88, title: 'Plan 222' }],
    nextSessionId: 901,
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const start = getBusinessHandler(route, 'post', '/workout-sessions/start');

    const firstReq = {
      session: { user: { id: 88 } },
      body: {
        workoutPlanId: 222,
        workoutDayName: 'Any Day',
        workoutDate: '2026-11-12',
      },
    };
    const firstRes = createResponseRecorder();
    await start(firstReq, firstRes);

    assert.equal(firstRes.statusCode, 201);

    const secondReq = {
      session: { user: { id: 88 } },
      body: {
        workoutPlanId: 222,
        workoutDayName: 'Any Day',
        workoutDate: '2026-11-12',
      },
    };
    const secondRes = createResponseRecorder();
    await start(secondReq, secondRes);

    assert.equal(secondRes.statusCode, 409);
    assert.equal(secondRes.body.code, 'WORKOUT_SESSION_CONFLICT');
    assert.equal(secondRes.body.activeSessions.length, 1);

    const liveSessions = mockPool._state.sessions.filter((session) => session.user_id === 88 && session.status === 'in_progress');
    assert.equal(liveSessions.length, 1);
    assert.equal(mockPool._state.counters.insertStartSession, 1);
  } finally {
    restore();
  }
});

test('concurrent start attempts create one session and return one conflict', async () => {
  const mockPool = createMockPool({
    sessions: [],
    workoutSchedules: [{ id: 333, user_id: 66, title: 'Plan 333' }],
    nextSessionId: 1201,
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const start = getBusinessHandler(route, 'post', '/workout-sessions/start');

    const reqA = {
      session: { user: { id: 66 } },
      body: {
        workoutPlanId: 333,
        workoutDayName: 'Any Day',
        workoutDate: '2026-11-12',
      },
    };

    const reqB = {
      session: { user: { id: 66 } },
      body: {
        workoutPlanId: 333,
        workoutDayName: 'Any Day',
        workoutDate: '2026-11-12',
      },
    };

    const resA = createResponseRecorder();
    const resB = createResponseRecorder();

    await Promise.all([
      start(reqA, resA),
      start(reqB, resB),
    ]);

    const statusCodes = [resA.statusCode, resB.statusCode].sort((left, right) => left - right);
    assert.deepEqual(statusCodes, [201, 409]);

    const liveSessions = mockPool._state.sessions.filter((session) => session.user_id === 66 && session.status === 'in_progress');
    assert.equal(liveSessions.length, 1);
    assert.equal(mockPool._state.counters.insertStartSession, 1);
  } finally {
    restore();
  }
});

test('multiple unfinished sessions require confirmation and replace atomically when explicitly confirmed', async () => {
  const mockPool = createMockPool({
    sessions: [
      {
        id: 1301,
        user_id: 67,
        source_workout_schedule_id: 444,
        workout_day_id: null,
        workout_day_name: 'Monday',
        workout_date: '2026-11-10',
        status: 'in_progress',
        started_at: '2026-11-10T09:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '{"version":1,"exercises":[]}',
      },
      {
        id: 1302,
        user_id: 67,
        source_workout_schedule_id: 444,
        workout_day_id: null,
        workout_day_name: 'Tuesday',
        workout_date: '2026-11-11',
        status: 'in_progress',
        started_at: '2026-11-11T09:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '{"version":1,"exercises":[]}',
      },
    ],
    workoutSchedules: [{ id: 444, user_id: 67, title: 'Plan 444' }],
    workoutLog: [{ WorkoutLogID: 41, workout_log_session_id: 1301, UserID: 67, ExerciseID: 10 }],
    workoutLogSets: [{ id: 51, workout_log_id: 41, set_number: 1, reps: 8, weight: 50 }],
    nextSessionId: 1303,
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const start = getBusinessHandler(route, 'post', '/workout-sessions/start');
    const baseBody = {
      workoutPlanId: 444,
      workoutDayName: 'Wednesday',
      workoutDate: '2026-11-12',
      endSessionIds: [1301, 1302],
    };

    const unconfirmedRes = createResponseRecorder();
    await start({ session: { user: { id: 67 } }, body: baseBody }, unconfirmedRes);
    assert.equal(unconfirmedRes.statusCode, 409);
    assert.equal(unconfirmedRes.body.code, 'MULTIPLE_WORKOUT_CONFIRMATION_REQUIRED');
    assert.equal(mockPool._state.sessions.every((session) => session.status === 'in_progress'), true);
    assert.equal(mockPool._state.counters.insertStartSession, 0);

    const confirmedRes = createResponseRecorder();
    await start({
      session: { user: { id: 67 } },
      body: { ...baseBody, confirmMultipleEnd: true },
    }, confirmedRes);

    assert.equal(confirmedRes.statusCode, 201);
    assert.equal(confirmedRes.body.session.id, 1303);
    assert.equal(mockPool._state.sessions.find((session) => session.id === 1301).status, 'ended');
    assert.equal(mockPool._state.sessions.find((session) => session.id === 1302).status, 'ended');
    assert.equal(mockPool._state.sessions.filter((session) => session.status === 'in_progress').length, 1);
    assert.equal(mockPool._state.workoutLog.length, 1);
    assert.equal(mockPool._state.workoutLogSets.length, 1);
  } finally {
    restore();
  }
});

test('in-progress endpoint returns all active sessions and supports independent resume selection', async () => {
  const mockPool = createMockPool({
    sessions: [
      {
        id: 1401,
        user_id: 33,
        source_workout_schedule_id: 500,
        workout_day_id: null,
        workout_day_name: 'Monday',
        workout_date: '2026-11-12',
        status: 'in_progress',
        started_at: '2026-11-12T09:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '',
      },
      {
        id: 1402,
        user_id: 33,
        source_workout_schedule_id: 500,
        workout_day_id: null,
        workout_day_name: 'Tuesday',
        workout_date: '2026-11-12',
        status: 'in_progress',
        started_at: '2026-11-12T10:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '',
      },
    ],
    workoutSchedules: [{ id: 500, user_id: 33, title: 'Plan 500' }],
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const getInProgress = getBusinessHandler(route, 'get', '/workout-sessions/in-progress');

    const req = { session: { user: { id: 33 } } };
    const res = createResponseRecorder();
    await getInProgress(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body.sessions), true);
    assert.equal(res.body.sessions.length, 2);
    assert.equal(res.body.sessions[0].id, 1402);
    assert.equal(res.body.sessions[1].id, 1401);
  } finally {
    restore();
  }
});

test('ending one in-progress session does not alter other in-progress sessions for the same user', async () => {
  const mockPool = createMockPool({
    sessions: [
      {
        id: 1501,
        user_id: 44,
        source_workout_schedule_id: 600,
        workout_day_id: null,
        workout_day_name: 'Monday',
        workout_date: '2026-11-12',
        status: 'in_progress',
        started_at: '2026-11-12T08:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '',
      },
      {
        id: 1502,
        user_id: 44,
        source_workout_schedule_id: 600,
        workout_day_id: null,
        workout_day_name: 'Tuesday',
        workout_date: '2026-11-12',
        status: 'in_progress',
        started_at: '2026-11-12T09:00:00.000Z',
        ended_at: null,
        duration_seconds: 0,
        completed_at: null,
        notes: '',
      },
    ],
    workoutSchedules: [{ id: 600, user_id: 44, title: 'Plan 600' }],
  });

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const endSession = getBusinessHandler(route, 'post', '/workout-sessions/:sessionId/end');
    const getInProgress = getBusinessHandler(route, 'get', '/workout-sessions/in-progress');

    const endReq = {
      session: { user: { id: 44 } },
      params: { sessionId: '1501' },
    };
    const endRes = createResponseRecorder();
    await endSession(endReq, endRes);

    assert.equal(endRes.statusCode, 200);
    assert.equal(endRes.body.endedSessionId, 1501);

    const ended = mockPool._state.sessions.find((session) => session.id === 1501);
    const stillLive = mockPool._state.sessions.find((session) => session.id === 1502);
    assert.equal(ended.status, 'ended');
    assert.equal(stillLive.status, 'in_progress');

    const listReq = { session: { user: { id: 44 } } };
    const listRes = createResponseRecorder();
    await getInProgress(listReq, listRes);

    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.body.sessions.length, 1);
    assert.equal(listRes.body.sessions[0].id, 1502);
  } finally {
    restore();
  }
});
