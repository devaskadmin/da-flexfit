const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const DB_MODULE_PATH = path.resolve(__dirname, '../db.js');
const ROUTE_MODULE_PATH = path.resolve(__dirname, '../api/users.js');

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

test('featured workout plans are publicly readable without a login session', async () => {
  const mockPool = {
    query: async (sql, params = []) => {
      const normalizedSql = String(sql || '').replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM information_schema.columns')) {
        return [[
          { table_name: 'workout_schedules', column_name: 'workout_plan_type' },
          { table_name: 'workout_schedules', column_name: 'goal_type' },
          { table_name: 'workout_schedules', column_name: 'source_global_plan_id' },
          { table_name: 'workout_schedules', column_name: 'global_plan_adopted_at' },
        ]];
      }

      if (normalizedSql.includes('FROM workout_schedules ws')) {
        return [[{
          id: 42,
          user_id: 7,
          title: 'Featured Starter',
          description: 'Sample featured plan',
          workout_type: 'Strength',
          category: 'Strength',
          workout_plan_type: 'featured',
          goal_type: 'none',
          goal_target_date: null,
          plan_duration_weeks: null,
          estimated_duration_minutes: 45,
          status: 'active',
          visibility: 'public',
          updated_at: '2026-11-14T00:00:00.000Z',
          created_by_role: 'Admin',
          day_count: 3,
          exercise_count: 2,
          cover_image: null,
        }], []];
      }

      return [[], []];
    },
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);
  try {
    const handler = getBusinessHandler(route, 'get', '/featured-workout-plans');
    const req = { session: {} };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 200, 'Guest access should be allowed for public featured plans');
    assert.equal(res.body.hasWorkoutLists, true);
    assert.equal(res.body.workoutLists[0].name, 'Featured Starter');
  } finally {
    restore();
  }
});
