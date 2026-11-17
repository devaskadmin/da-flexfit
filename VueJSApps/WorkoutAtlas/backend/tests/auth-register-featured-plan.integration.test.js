const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const DB_MODULE_PATH = path.resolve(__dirname, '../db.js');
const ROUTE_MODULE_PATH = path.resolve(__dirname, '../api/auth.js');

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

const createRegisterHarness = ({
  existingUser = null,
  tier = { id: 2, name: 'Pro', slug: 'pro', price_monthly: 19.99, price_yearly: 0 },
  selectedPlan = null,
  failOnExerciseInsert = false,
} = {}) => {
  const state = {
    executedSql: [],
    insertedUsers: [],
    insertedProfiles: [],
    insertedMemberships: [],
    insertedRoles: [],
    insertedSchedules: [],
    insertedGroups: [],
    insertedExercises: [],
    rollbackCount: 0,
    commitCount: 0,
    inTransaction: false,
    nextUserId: 7000,
    nextScheduleId: 8000,
    nextGroupId: 9000,
  };

  const effectivePlan = selectedPlan || {
    id: 42,
    user_id: 99,
    title: 'Featured Starter',
    description: 'Starter plan',
    workout_type: 'Strength',
    category: 'Strength',
    goal_type: 'none',
    goal_target_date: null,
    plan_duration_weeks: null,
    estimated_duration_minutes: 45,
    status: 'active',
    visibility: 'public',
    schedule_mode: 'day',
    groups: [
      { id: 1, label: 'Any Day', group_type: 'any', sort_order: 1, workout_log_display_order: 1 },
    ],
    exercises: [
      {
        id: 1,
        workout_schedule_group_id: 1,
        exercise_id: 100,
        exercise_name: 'Push Up',
        exercise_image_url: 'push-up.jpg',
        workout_type: 'Strength',
        muscle_group: 'Chest',
        equipment: 'Bodyweight',
        sort_order: 1,
        notes: '',
        target_sets: 3,
        target_reps: 10,
        target_weight: null,
        target_duration_minutes: null,
        target_rest_seconds: 60,
        target_distance_miles: null,
      },
    ],
  };

  const normalizeSql = (sql) => String(sql || '').replace(/\s+/g, ' ').trim();

  const connection = {
    beginTransaction: async () => {
      state.inTransaction = true;
    },
    commit: async () => {
      state.inTransaction = false;
      state.commitCount += 1;
    },
    rollback: async () => {
      state.inTransaction = false;
      state.rollbackCount += 1;
    },
    release: () => {},
    query: async (sql, params = []) => {
      const normalizedSql = normalizeSql(sql);
      state.executedSql.push(normalizedSql);

      if (normalizedSql.includes('FROM information_schema.columns')) {
        if (normalizedSql.includes("table_name = 'users'")) {
          return [[
            { column_name: 'avatarPath' },
            { column_name: 'avatarName' },
          ], []];
        }

        return [[
          { table_name: 'workout_schedules', column_name: 'category' },
          { table_name: 'workout_schedules', column_name: 'workout_plan_type' },
          { table_name: 'workout_schedules', column_name: 'goal_type' },
          { table_name: 'workout_schedules', column_name: 'goal_target_date' },
          { table_name: 'workout_schedules', column_name: 'plan_duration_weeks' },
          { table_name: 'workout_schedules', column_name: 'source_global_plan_id' },
          { table_name: 'workout_schedules', column_name: 'global_plan_adopted_at' },
          { table_name: 'workout_schedules', column_name: 'schedule_mode' },
          { table_name: 'workout_schedule_groups', column_name: 'workout_log_display_order' },
          { table_name: 'workout_schedule_exercises', column_name: 'target_distance_miles' },
        ], []];
      }

      if (normalizedSql.startsWith('INSERT INTO users')) {
        const [firstName, lastName, username, _password, membershipType] = params;
        const insertedId = state.nextUserId;
        state.nextUserId += 1;
        state.insertedUsers.push({ id: insertedId, firstName, lastName, username, membershipType });
        return [{ insertId: insertedId, affectedRows: 1 }, []];
      }

      if (normalizedSql.startsWith('INSERT INTO user_profiles')) {
        state.insertedProfiles.push({ userId: Number(params[0] || 0), role: params[1], tier: Number(params[2] || 0) });
        return [{ insertId: 1, affectedRows: 1 }, []];
      }

      if (normalizedSql.startsWith('INSERT INTO user_memberships')) {
        state.insertedMemberships.push({ userId: Number(params[0] || 0), tierId: Number(params[1] || 0) });
        return [{ insertId: 1, affectedRows: 1 }, []];
      }

      if (normalizedSql.startsWith('INSERT INTO user_roles')) {
        state.insertedRoles.push({ userId: Number(params[0] || 0), roleSlug: params[2] });
        return [{ insertId: 1, affectedRows: 1 }, []];
      }

      if (normalizedSql.startsWith('SELECT id, user_id, title, description, workout_type')) {
        const requestedPlanId = Number(params[0] || 0);
        const isEligible = requestedPlanId === Number(effectivePlan.id || 0)
          && String(effectivePlan.workout_plan_type || 'featured').toLowerCase() === 'featured'
          && ['active', 'published', 'completed'].includes(String(effectivePlan.status || '').toLowerCase())
          && String(effectivePlan.visibility || '').toLowerCase() === 'public'
          && Array.isArray(effectivePlan.exercises)
          && effectivePlan.exercises.length > 0;

        if (!isEligible) {
          return [[], []];
        }

        return [[{
          id: effectivePlan.id,
          user_id: effectivePlan.user_id,
          title: effectivePlan.title,
          description: effectivePlan.description,
          workout_type: effectivePlan.workout_type,
          category: effectivePlan.category,
          goal_type: effectivePlan.goal_type,
          goal_target_date: effectivePlan.goal_target_date,
          plan_duration_weeks: effectivePlan.plan_duration_weeks,
          estimated_duration_minutes: effectivePlan.estimated_duration_minutes,
          status: effectivePlan.status,
          visibility: effectivePlan.visibility,
          schedule_mode: effectivePlan.schedule_mode,
        }], []];
      }

      if (normalizedSql.startsWith('INSERT INTO workout_schedules')) {
        const insertedId = state.nextScheduleId;
        state.nextScheduleId += 1;

        state.insertedSchedules.push({
          id: insertedId,
          userId: Number(params[0] || 0),
          title: params[1],
          sourceGlobalPlanId: Number(params.find((value) => Number(value) === Number(effectivePlan.id || 0)) || 0) || null,
        });

        return [{ insertId: insertedId, affectedRows: 1 }, []];
      }

      if (normalizedSql.includes('FROM workout_schedule_groups') && normalizedSql.includes('WHERE workout_schedule_id = ?')) {
        const requestedPlanId = Number(params[0] || 0);
        if (requestedPlanId !== Number(effectivePlan.id || 0)) {
          return [[], []];
        }
        return [Array.isArray(effectivePlan.groups) ? effectivePlan.groups.map((row) => ({ ...row })) : [], []];
      }

      if (normalizedSql.startsWith('INSERT INTO workout_schedule_groups')) {
        const insertedId = state.nextGroupId;
        state.nextGroupId += 1;
        state.insertedGroups.push({
          id: insertedId,
          workoutScheduleId: Number(params[0] || 0),
          label: params[1],
        });
        return [{ insertId: insertedId, affectedRows: 1 }, []];
      }

      if (normalizedSql.includes('FROM workout_schedule_exercises') && normalizedSql.includes('WHERE workout_schedule_id = ?')) {
        const requestedPlanId = Number(params[0] || 0);
        if (requestedPlanId !== Number(effectivePlan.id || 0)) {
          return [[], []];
        }
        return [Array.isArray(effectivePlan.exercises) ? effectivePlan.exercises.map((row) => ({ ...row })) : [], []];
      }

      if (normalizedSql.startsWith('INSERT INTO workout_schedule_exercises')) {
        if (failOnExerciseInsert) {
          throw new Error('Simulated exercise copy failure');
        }
        state.insertedExercises.push({
          workoutScheduleId: Number(params[0] || 0),
          workoutScheduleGroupId: Number(params[1] || 0) || null,
          exerciseId: Number(params[2] || 0) || null,
        });
        return [{ insertId: state.insertedExercises.length, affectedRows: 1 }, []];
      }

      throw new Error(`Unhandled connection SQL: ${normalizedSql}`);
    },
  };

  const mockPool = {
    query: async (sql, params = []) => {
      const normalizedSql = normalizeSql(sql);
      state.executedSql.push(normalizedSql);

      if (normalizedSql === 'SELECT * FROM users WHERE username = ?') {
        if (existingUser && String(existingUser.username || '').toLowerCase() === String(params[0] || '').toLowerCase()) {
          return [[existingUser], []];
        }
        return [[], []];
      }

      if (normalizedSql.startsWith('SELECT id, name, slug, price_monthly, price_yearly FROM membership_tiers')) {
        const requestedTierId = Number(params[0] || 0);
        if (tier && Number(tier.id || 0) === requestedTierId) {
          return [[{ ...tier }], []];
        }
        return [[], []];
      }

      throw new Error(`Unhandled pool SQL: ${normalizedSql}`);
    },
    getConnection: async () => connection,
  };

  return { mockPool, state };
};

test('registration with selected featured plan creates a user-owned personal copy and preserves source template', async () => {
  const { mockPool, state } = createRegisterHarness({});
  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const res = createResponseRecorder();

    await register(
      {
        body: {
          firstName: 'Sam',
          lastName: 'Runner',
          username: 'sam.runner@example.com',
          password: 'StrongPass1!',
          membershipType: 'User',
          subscriptionTierId: 2,
          selectedFeaturedPlanId: 42,
        },
        headers: {},
      },
      res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(Number(res.body.selectedFeaturedPlanId || 0), 42);
    assert.ok(Number(res.body.assignedWorkoutPlanId || 0) > 0);
    assert.equal(state.insertedUsers.length, 1);
    assert.equal(state.insertedSchedules.length, 1);
    assert.equal(state.insertedSchedules[0].userId, state.insertedUsers[0].id);
    assert.equal(state.insertedExercises.length > 0, true);
    assert.equal(state.commitCount, 1);
    assert.equal(state.rollbackCount, 0);

    const mutatingSourceSql = state.executedSql.filter((sql) =>
      /UPDATE workout_schedules|DELETE FROM workout_schedules/i.test(sql)
    );
    assert.equal(mutatingSourceSql.length, 0, 'Source featured template must remain unchanged.');
  } finally {
    restore();
  }
});

test('registration without featured selection succeeds without assigning a plan copy', async () => {
  const { mockPool, state } = createRegisterHarness({});
  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const res = createResponseRecorder();

    await register(
      {
        body: {
          firstName: 'No',
          lastName: 'Selection',
          username: 'noselection@example.com',
          password: 'StrongPass1!',
          membershipType: 'User',
          subscriptionTierId: 2,
          selectedFeaturedPlanId: null,
        },
        headers: {},
      },
      res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.assignedWorkoutPlanId, null);
    assert.equal(state.insertedSchedules.length, 0);
    assert.equal(state.commitCount, 1);
  } finally {
    restore();
  }
});

test('registration rejects invalid selected featured plan id', async () => {
  const { mockPool } = createRegisterHarness({});
  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const res = createResponseRecorder();

    await register(
      {
        body: {
          firstName: 'Bad',
          lastName: 'Plan',
          username: 'badplan@example.com',
          password: 'StrongPass1!',
          membershipType: 'User',
          subscriptionTierId: 2,
          selectedFeaturedPlanId: 'abc',
        },
        headers: {},
      },
      res
    );

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body?.error || ''), /invalid/i);
  } finally {
    restore();
  }
});

test('registration rejects non-featured or ineligible featured plan ids', async () => {
  const { mockPool, state } = createRegisterHarness({
    selectedPlan: {
      id: 42,
      user_id: 99,
      workout_plan_type: 'global',
      status: 'active',
      visibility: 'public',
      exercises: [{ id: 1, workout_schedule_group_id: 1, exercise_id: 100 }],
      groups: [{ id: 1, label: 'Any Day', group_type: 'any', sort_order: 1 }],
    },
  });
  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const res = createResponseRecorder();

    await register(
      {
        body: {
          firstName: 'Global',
          lastName: 'Reject',
          username: 'globalreject@example.com',
          password: 'StrongPass1!',
          membershipType: 'User',
          subscriptionTierId: 2,
          selectedFeaturedPlanId: 42,
        },
        headers: {},
      },
      res
    );

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body?.error || ''), /unavailable/i);
    assert.equal(state.rollbackCount, 1);
  } finally {
    restore();
  }
});

test('registration rejects draft featured plans and rolls back user creation', async () => {
  const { mockPool, state } = createRegisterHarness({
    selectedPlan: {
      id: 42,
      user_id: 99,
      workout_plan_type: 'featured',
      status: 'draft',
      visibility: 'public',
      exercises: [{ id: 1, workout_schedule_group_id: 1, exercise_id: 100 }],
      groups: [{ id: 1, label: 'Any Day', group_type: 'any', sort_order: 1 }],
    },
  });
  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const res = createResponseRecorder();

    await register(
      {
        body: {
          firstName: 'Draft',
          lastName: 'Reject',
          username: 'draftreject@example.com',
          password: 'StrongPass1!',
          membershipType: 'User',
          subscriptionTierId: 2,
          selectedFeaturedPlanId: 42,
        },
        headers: {},
      },
      res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.rollbackCount, 1);
    assert.equal(state.commitCount, 0);
  } finally {
    restore();
  }
});

test('registration rollback triggers when featured plan assignment fails mid-copy', async () => {
  const { mockPool, state } = createRegisterHarness({ failOnExerciseInsert: true });
  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const res = createResponseRecorder();

    await register(
      {
        body: {
          firstName: 'Fail',
          lastName: 'Copy',
          username: 'failcopy@example.com',
          password: 'StrongPass1!',
          membershipType: 'User',
          subscriptionTierId: 2,
          selectedFeaturedPlanId: 42,
        },
        headers: {},
      },
      res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(state.commitCount, 0);
    assert.equal(state.rollbackCount, 1);
  } finally {
    restore();
  }
});

test('registration duplicate username is rejected before assignment flow', async () => {
  const { mockPool, state } = createRegisterHarness({
    existingUser: { id: 1, username: 'duplicate@example.com' },
  });
  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const res = createResponseRecorder();

    await register(
      {
        body: {
          firstName: 'Dup',
          lastName: 'User',
          username: 'duplicate@example.com',
          password: 'StrongPass1!',
          membershipType: 'User',
          subscriptionTierId: 2,
          selectedFeaturedPlanId: 42,
        },
        headers: {},
      },
      res
    );

    assert.equal(res.statusCode, 409);
    assert.equal(state.insertedUsers.length, 0);
    assert.equal(state.commitCount, 0);
  } finally {
    restore();
  }
});
