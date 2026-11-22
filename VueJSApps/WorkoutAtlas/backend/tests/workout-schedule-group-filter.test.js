const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const {
  filterGroupsForScheduleMode,
  isGroupInScheduleMode,
  isWeekGroupType,
  normalizeScheduleMode,
  buildScheduleModeGroupFilterSql,
} = require('../utils/workoutScheduleGroupFilter');

// ---------------------------------------------------------------------------
// Isolated fixtures: an in-memory stand-in for workout_schedules and
// workout_schedule_groups. No real database is used. Plan 5 is the protected
// plan; it is only ever read and its rows are snapshotted to prove no change.
// ---------------------------------------------------------------------------
const makeState = () => ({
  schedules: [
    { id: 5, user_id: 1, status: 'active', updated_at: 1, schedule_mode: 'day', use_custom_workout_log_order: 0 },
    { id: 81, user_id: 7, status: 'active', updated_at: 9, schedule_mode: 'day', use_custom_workout_log_order: 0 },
    { id: 82, user_id: 8, status: 'active', updated_at: 9, schedule_mode: 'week', use_custom_workout_log_order: 0 },
    { id: 83, user_id: 9, status: 'active', updated_at: 9, schedule_mode: 'day', use_custom_workout_log_order: 0 },
    { id: 84, user_id: 10, status: 'active', updated_at: 9, schedule_mode: 'day', use_custom_workout_log_order: 1 },
    { id: 85, user_id: 11, status: 'active', updated_at: 9, schedule_mode: 'day', use_custom_workout_log_order: 0 },
  ],
  groups: [
    { id: 1, workout_schedule_id: 5, label: 'Push', group_type: 'day', sort_order: 1, workout_log_display_order: null },
    { id: 2, workout_schedule_id: 5, label: 'Pull', group_type: 'day', sort_order: 2, workout_log_display_order: null },
    { id: 3, workout_schedule_id: 5, label: 'Week 1', group_type: 'week', sort_order: 1, workout_log_display_order: null },
    // Plan 81: day mode, two days plus two week containers (inserted first, lower ids).
    { id: 10, workout_schedule_id: 81, label: 'Week 1', group_type: 'week', sort_order: 1, workout_log_display_order: null },
    { id: 11, workout_schedule_id: 81, label: 'Week 2', group_type: 'week', sort_order: 2, workout_log_display_order: null },
    { id: 12, workout_schedule_id: 81, label: 'Monday', group_type: 'day', sort_order: 1, workout_log_display_order: null },
    { id: 13, workout_schedule_id: 81, label: 'Tuesday', group_type: 'any', sort_order: 2, workout_log_display_order: null },
    // Plan 82: legacy Week View, only week groups.
    { id: 20, workout_schedule_id: 82, label: 'Week 1', group_type: 'week', sort_order: 1, workout_log_display_order: null },
    { id: 21, workout_schedule_id: 82, label: 'Week 2', group_type: 'week', sort_order: 2, workout_log_display_order: null },
    // Plan 83: day mode, weeks only (no days yet).
    { id: 30, workout_schedule_id: 83, label: 'Week 1', group_type: 'week', sort_order: 1, workout_log_display_order: null },
    // Plan 84: custom log order, with a stale display order on a week container.
    { id: 40, workout_schedule_id: 84, label: 'Week 1', group_type: 'week', sort_order: 1, workout_log_display_order: 1 },
    { id: 41, workout_schedule_id: 84, label: 'Leg Day', group_type: 'day', sort_order: 1, workout_log_display_order: 3 },
    { id: 42, workout_schedule_id: 84, label: 'Arm Day', group_type: 'day', sort_order: 2, workout_log_display_order: 2 },
    // Plan 85: a day card that shares its label with a week container.
    { id: 50, workout_schedule_id: 85, label: 'Week 1', group_type: 'week', sort_order: 1, workout_log_display_order: null },
    { id: 51, workout_schedule_id: 85, label: 'Week 1', group_type: 'day', sort_order: 1, workout_log_display_order: null },
    { id: 52, workout_schedule_id: 85, label: 'Friday', group_type: 'day', sort_order: 2, workout_log_display_order: null },
  ],
  writes: [],
});

const squash = (sql) => String(sql).replace(/\s+/g, ' ').trim();

// Translates the SQL predicate built by buildScheduleModeGroupFilterSql into JS so the
// emitted SQL (not just the JS helper) is exercised against the fixture rows.
const evaluateGroupFilterSql = (sql, groupAlias, scheduleAlias, row, scheduleMode) => {
  const js = squash(sql)
    .replace(new RegExp(`COALESCE\\(${scheduleAlias}\\.schedule_mode, 'day'\\)`, 'g'), "(mode || 'day')")
    .replace(new RegExp(`${scheduleAlias}\\.schedule_mode`, 'g'), 'mode')
    .replace(new RegExp(`${groupAlias}\\.group_type`, 'g'), 'type')
    .replace(/<>/g, '!==')
    .replace(/ = /g, ' === ')
    .replace(/\bAND\b/g, '&&')
    .replace(/\bOR\b/g, '||');
  return Function('mode', 'type', `return Boolean(${js});`)(scheduleMode, row.group_type);
};

const extractFilterFromSql = (sql, groupAlias, scheduleAlias) => {
  const match = squash(sql).match(/AND (\(\(.*\)\))/);
  assert.ok(match, 'expected the schedule-mode group filter inside the SQL');
  assert.ok(match[1].includes(`${groupAlias}.group_type`));
  assert.ok(match[1].includes(`${scheduleAlias}.schedule_mode`));
  return match[1];
};

// Loads a real route module with express and the database pool replaced by stubs.
const loadRouteModule = (relativePath, state) => {
  const routes = {};
  const router = {};
  ['get', 'post', 'put', 'delete', 'patch', 'use'].forEach((method) => {
    router[method] = (routePath, ...handlers) => {
      routes[`${method.toUpperCase()} ${routePath}`] = handlers[handlers.length - 1];
      return router;
    };
  });
  const expressStub = () => ({});
  expressStub.Router = () => router;

  const run = (sql, params = []) => {
    const s = squash(sql);

    let match = s.match(/^SELECT id, use_custom_workout_log_order, schedule_mode FROM workout_schedules WHERE id = \? AND user_id = \? LIMIT 1$/);
    if (match) {
      const row = state.schedules.find((sc) => sc.id === Number(params[0]) && sc.user_id === Number(params[1]));
      return [[row]];
    }
    match = s.match(/^SELECT id, schedule_mode FROM workout_schedules WHERE id = \? AND user_id = \? LIMIT 1$/);
    if (match) {
      const row = state.schedules.find((sc) => sc.id === Number(params[0]) && sc.user_id === Number(params[1]));
      return [[row]];
    }
    if (/^SELECT (id, label, group_type, sort_order, workout_log_display_order|label, group_type, sort_order, workout_log_display_order|id, label, group_type, sort_order) FROM workout_schedule_groups WHERE workout_schedule_id = \? ORDER BY sort_order ASC, id ASC$/.test(s)) {
      const rows = state.groups
        .filter((g) => g.workout_schedule_id === Number(params[0]))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((g) => ({ ...g }));
      return [rows];
    }
    if (/^UPDATE workout_schedules SET use_custom_workout_log_order = 1/.test(s)) {
      state.writes.push({ sql: s, params });
      const row = state.schedules.find((sc) => sc.id === Number(params[0]));
      if (row) row.use_custom_workout_log_order = 1;
      return [{ affectedRows: 1 }];
    }
    if (/^UPDATE workout_schedule_groups SET workout_log_display_order = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND workout_schedule_id = \?$/.test(s)) {
      state.writes.push({ sql: s, params });
      const group = state.groups.find((g) => g.id === Number(params[1]) && g.workout_schedule_id === Number(params[2]));
      if (group) group.workout_log_display_order = params[0];
      return [{ affectedRows: group ? 1 : 0 }];
    }
    if (/FROM workout_schedule_groups wsg INNER JOIN workout_schedules target_ws/.test(s)) {
      const filter = extractFilterFromSql(s, 'wsg', 'target_ws');
      state.dashboardSql = s;
      const active = state.schedules
        .filter((sc) => sc.user_id === Number(params[0]) && sc.status === 'active')
        .sort((a, b) => b.updated_at - a.updated_at)[0];
      const count = active
        ? state.groups.filter((g) => g.workout_schedule_id === active.id
            && evaluateGroupFilterSql(filter, 'wsg', 'target_ws', g, active.schedule_mode)).length
        : 0;
      return [[{ cnt: count }]];
    }
    if (/^SELECT COUNT\(DISTINCT DATE|^SELECT COALESCE\(SUM|^SELECT COALESCE\(SUM\(protein_g\)/.test(s)) {
      return [[{ cnt: 0, total: 0 }]];
    }
    // Everything else the dashboard handler runs (streak dates, chart, feed) returns no rows.
    return [[]];
  };

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => run(sql, params),
  };
  const poolStub = {
    query: async (sql, params) => run(sql, params),
    getConnection: async () => connection,
  };

  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === 'express') return expressStub;
    if (/(^|[\\/])db\.js$/.test(request)) return poolStub;
    return originalLoad.call(this, request, parent, isMain);
  };
  const absolute = path.join(__dirname, '..', relativePath);
  delete require.cache[require.resolve(absolute)];
  try {
    require(absolute);
  } finally {
    Module._load = originalLoad;
  }
  return routes;
};

const makeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

const call = async (handler, { userId, query = {}, body = {} }) => {
  const res = makeRes();
  await handler({ session: { user: { id: userId } }, query, body }, res, () => {});
  return res;
};

const plan5Snapshot = (state) => JSON.stringify([
  state.schedules.find((s) => s.id === 5),
  state.groups.filter((g) => g.workout_schedule_id === 5),
]);

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------
test('isWeekGroupType and normalizeScheduleMode normalize loosely', () => {
  assert.equal(isWeekGroupType(' Week '), true);
  assert.equal(isWeekGroupType('day'), false);
  assert.equal(isWeekGroupType(undefined), false);
  assert.equal(normalizeScheduleMode('WEEK'), 'week');
  assert.equal(normalizeScheduleMode('day'), 'day');
  assert.equal(normalizeScheduleMode(null), 'day');
  assert.equal(normalizeScheduleMode('bogus'), 'day');
});

test('day mode keeps day, any and section groups and drops week containers', () => {
  const rows = ['week', 'day', 'any', 'section', 'week'].map((group_type, i) => ({ group_type, label: `g${i}` }));
  assert.deepEqual(filterGroupsForScheduleMode(rows, 'day').map((r) => r.label), ['g1', 'g2', 'g3']);
  assert.deepEqual(filterGroupsForScheduleMode(rows, undefined).map((r) => r.label), ['g1', 'g2', 'g3']);
});

test('legacy week mode keeps only week groups (existing Week View behavior)', () => {
  const rows = ['week', 'day', 'week'].map((group_type, i) => ({ group_type, label: `g${i}` }));
  assert.deepEqual(filterGroupsForScheduleMode(rows, 'week').map((r) => r.label), ['g0', 'g2']);
  assert.equal(isGroupInScheduleMode('day', 'week'), false);
  assert.equal(isGroupInScheduleMode('week', 'week'), true);
});

test('filter tolerates non-array input and does not mutate rows', () => {
  assert.deepEqual(filterGroupsForScheduleMode(null, 'day'), []);
  const rows = [{ group_type: 'week' }, { group_type: 'day' }];
  const copy = JSON.stringify(rows);
  filterGroupsForScheduleMode(rows, 'day');
  assert.equal(JSON.stringify(rows), copy);
});

test('SQL predicate agrees with the JS helper for every mode and group type', () => {
  const sql = buildScheduleModeGroupFilterSql('wsg', 'ws');
  for (const mode of ['day', 'week', null, undefined]) {
    for (const type of ['day', 'week', 'any', 'section']) {
      assert.equal(
        evaluateGroupFilterSql(sql, 'wsg', 'ws', { group_type: type }, mode),
        isGroupInScheduleMode(type, mode),
        `mode=${mode} type=${type}`
      );
    }
  }
});

test('SQL predicate builder rejects non-identifier aliases', () => {
  assert.throws(() => buildScheduleModeGroupFilterSql('wsg; DROP TABLE x', 'ws'));
  assert.throws(() => buildScheduleModeGroupFilterSql('wsg', "ws' OR '1'='1"));
  assert.throws(() => buildScheduleModeGroupFilterSql('', 'ws'));
});

// ---------------------------------------------------------------------------
// Workout Log day ordering (real workout-log.js, stubbed express + pool)
// ---------------------------------------------------------------------------
test('GET /day-order excludes week containers for a day-mode plan', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const res = await call(routes['GET /day-order'], { userId: 7, query: { planId: 81 } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.builderOrder, ['Monday', 'Tuesday']);
  assert.deepEqual(res.body.orderedGroups, ['Monday', 'Tuesday']);
  assert.deepEqual(res.body.customOrder, []);
});

test('GET /day-order ignores a stale display order held by a week container', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const res = await call(routes['GET /day-order'], { userId: 10, query: { planId: 84 } });
  assert.equal(res.body.useCustomWorkoutLogOrder, true);
  assert.deepEqual(res.body.builderOrder, ['Leg Day', 'Arm Day']);
  assert.deepEqual(res.body.customOrder, ['Arm Day', 'Leg Day']);
  assert.deepEqual(res.body.orderedGroups, ['Arm Day', 'Leg Day']);
});

test('GET /day-order keeps legacy Week View groups for a week-mode plan', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const res = await call(routes['GET /day-order'], { userId: 8, query: { planId: 82 } });
  assert.deepEqual(res.body.orderedGroups, ['Week 1', 'Week 2']);
});

test('GET /day-order lists a day card once even when a week container shares its label', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const res = await call(routes['GET /day-order'], { userId: 11, query: { planId: 85 } });
  assert.deepEqual(res.body.orderedGroups, ['Week 1', 'Friday']);
});

test('GET /day-order for a day plan with only weeks yields no days; unknown plans still 404', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const none = await call(routes['GET /day-order'], { userId: 9, query: { planId: 83 } });
  assert.deepEqual(none.body.orderedGroups, []);
  const missing = await call(routes['GET /day-order'], { userId: 7, query: { planId: 999 } });
  assert.equal(missing.statusCode, 404);
});

test('PUT /day-order writes display order for days only and never touches week containers', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const res = await call(routes['PUT /day-order'], {
    userId: 7,
    body: { planId: 81, orderedGroups: ['Tuesday', 'Week 1', 'Monday'] },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.orderedGroups, ['Tuesday', 'Monday']);
  const written = state.writes.filter((w) => /UPDATE workout_schedule_groups/.test(w.sql));
  assert.deepEqual(written.map((w) => [w.params[1], w.params[0]]), [[13, 1], [12, 2]]);
  assert.equal(state.groups.find((g) => g.id === 10).workout_log_display_order, null);
  assert.equal(state.groups.find((g) => g.id === 11).workout_log_display_order, null);
});

test('PUT /day-order rejects an order that contains only week container labels in day mode', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const res = await call(routes['PUT /day-order'], {
    userId: 7,
    body: { planId: 81, orderedGroups: ['Week 1', 'Week 2'] },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(state.writes.length, 0);
});

test('PUT /day-order still orders legacy Week View groups', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  const res = await call(routes['PUT /day-order'], {
    userId: 8,
    body: { planId: 82, orderedGroups: ['Week 2', 'Week 1'] },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.orderedGroups, ['Week 2', 'Week 1']);
});

test('PUT /day-order resolves a shared label to the day card, not the week container', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/workout-log.js', state);
  await call(routes['PUT /day-order'], {
    userId: 11,
    body: { planId: 85, orderedGroups: ['Friday', 'Week 1'] },
  });
  const written = state.writes.filter((w) => /UPDATE workout_schedule_groups/.test(w.sql)).map((w) => w.params[1]);
  assert.deepEqual(written.sort(), [51, 52]);
  assert.equal(state.groups.find((g) => g.id === 50).workout_log_display_order, null);
});

test('workout-log writes stay scoped to the requested plan and PlanID 5 is unchanged', async () => {
  const state = makeState();
  const before = plan5Snapshot(state);
  const routes = loadRouteModule('api/workout-log.js', state);
  await call(routes['PUT /day-order'], { userId: 7, body: { planId: 81, orderedGroups: ['Monday'] } });
  await call(routes['GET /day-order'], { userId: 7, query: { planId: 81 } });
  assert.ok(state.writes.every((w) => !/ALTER|DROP|DELETE/i.test(w.sql)));
  assert.ok(state.writes.filter((w) => /UPDATE workout_schedule_groups/.test(w.sql)).every((w) => w.params[2] === 81));
  assert.equal(plan5Snapshot(state), before);
});

// ---------------------------------------------------------------------------
// Dashboard weekly target (real dashboard.js, stubbed express + pool)
// ---------------------------------------------------------------------------
test('dashboard weeklyTarget counts workout days only, not week containers', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/dashboard.js', state);
  const res = await call(routes['GET /dashboard/metrics'], { userId: 7 });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.weeklyTarget, 2);
  assert.ok(/INNER JOIN workout_schedules target_ws ON target_ws.id = wsg.workout_schedule_id/.test(state.dashboardSql));
});

test('dashboard weeklyTarget keeps counting week groups for a legacy week-mode plan', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/dashboard.js', state);
  const res = await call(routes['GET /dashboard/metrics'], { userId: 8 });
  assert.equal(res.body.weeklyTarget, 2);
});

test('dashboard weeklyTarget is 0 for a day-mode plan that only has week containers', async () => {
  const state = makeState();
  const routes = loadRouteModule('api/dashboard.js', state);
  const res = await call(routes['GET /dashboard/metrics'], { userId: 9 });
  assert.equal(res.body.weeklyTarget, 0);
});

test('dashboard run leaves PlanID 5 untouched and issues no writes', async () => {
  const state = makeState();
  const before = plan5Snapshot(state);
  const routes = loadRouteModule('api/dashboard.js', state);
  await call(routes['GET /dashboard/metrics'], { userId: 1 });
  assert.equal(state.writes.length, 0);
  assert.equal(plan5Snapshot(state), before);
});

// ---------------------------------------------------------------------------
// Plan-list day count (users.js cannot be loaded locally: mysql2 is not installed,
// so the aggregate is checked by source contract plus the evaluated SQL predicate)
// ---------------------------------------------------------------------------
test('plan-list day_count aggregate filters week containers through the shared predicate', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'users.js'), 'utf8');
  assert.match(source, /const \{ buildScheduleModeGroupFilterSql \} = require\('\.\.\/utils\/workoutScheduleGroupFilter'\);/);
  const start = source.indexOf('COUNT(wsg.id) AS group_count');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf(') group_agg ON group_agg.workout_schedule_id = ws.id', start));
  assert.match(block, /INNER JOIN workout_schedules group_ws ON group_ws\.id = wsg\.workout_schedule_id/);
  assert.match(block, /\$\{buildScheduleModeGroupFilterSql\('wsg', 'group_ws'\)\}/);
  assert.match(block, /GROUP BY wsg\.workout_schedule_id/);
  assert.equal(source.split('COUNT(wsg.id) AS group_count').length - 1, 1);
  assert.match(source, /COALESCE\(group_agg\.group_count, 0\) AS day_count/);
});

test('plan-list day counts evaluated against the fixture match the workout-day totals', () => {
  const state = makeState();
  const sql = buildScheduleModeGroupFilterSql('wsg', 'group_ws');
  const countFor = (planId) => {
    const plan = state.schedules.find((s) => s.id === planId);
    return state.groups.filter((g) => g.workout_schedule_id === planId
      && String(g.label).trim() !== ''
      && evaluateGroupFilterSql(sql, 'wsg', 'group_ws', g, plan.schedule_mode)).length;
  };
  assert.equal(countFor(81), 2);
  assert.equal(countFor(82), 2);
  assert.equal(countFor(83), 0);
  assert.equal(countFor(5), 2);
});

test('users.js keeps its 37 routes and the group-save routes are not touched by the filter', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'users.js'), 'utf8');
  const routes = source.match(/router\.(get|post|put|patch|delete)\s*\(\s*'[^']+'/g) || [];
  assert.equal(routes.length, 37);
  const helperUse = source.split('buildScheduleModeGroupFilterSql(').length - 1;
  assert.equal(helperUse, 1);
  assert.match(source, /syncScheduleGroups\(connection, scheduleId, planner/);
});

test('workout-log.js and dashboard.js wire the shared filter and keep their route sets', () => {
  const log = fs.readFileSync(path.join(__dirname, '..', 'api', 'workout-log.js'), 'utf8');
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'api', 'dashboard.js'), 'utf8');
  // 0.85.313.a8.1: both day-order paths go through withDayDisplayLabels, which applies the shared filter once.
  assert.match(log, /filterGroupsForScheduleMode\(allGroupRows, scheduleMode\)/);
  assert.equal(log.split('withDayDisplayLabels(\n').length - 1 + log.split('withDayDisplayLabels(\r\n').length - 1, 2);
  assert.match(dashboard, /buildScheduleModeGroupFilterSql\('wsg', 'target_ws'\)/);
});
