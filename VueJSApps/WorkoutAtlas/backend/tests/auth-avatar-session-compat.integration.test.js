const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const DB_MODULE_PATH = path.resolve(__dirname, '../db.js');
const ROUTE_MODULE_PATH = path.resolve(__dirname, '../api/auth.js');

const DEFAULT_AVATAR_PATH = '/images/avatar/default.png';
const DEFAULT_AVATAR_NAME = 'default.png';

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
  set() {
    return this;
  },
});

const normalizeSql = (sql) => String(sql || '').replace(/\s+/g, ' ').trim();

test('session hydration succeeds with role resolution when users.avatarPath/avatarName columns are missing', async () => {
  const state = { executedSql: [] };

  const mockPool = {
    query: async (sql, params = []) => {
      const normalized = normalizeSql(sql);
      state.executedSql.push(normalized);

      if (normalized.includes('FROM user_roles ur') && normalized.includes('JOIN roles r')) {
        return [[{ roleValue: 'trainer' }], []];
      }

      if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'users'")) {
        return [[], []];
      }

      if (normalized.includes('external_auth, membershipType FROM users WHERE id = ? LIMIT 1')) {
        assert.equal(params[0], 55);
        return [[{ external_auth: 0, membershipType: 'User', avatarPath: null, avatarName: null }], []];
      }

      throw new Error(`Unhandled SQL: ${normalized}`);
    },
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'get', '/session');
    const req = {
      headers: { cookie: 'flexfit.sid=fake', origin: 'http://localhost:5173' },
      session: {
        user: { id: 55, username: 'trainer@example.com', role: 'user', roleSlug: 'user' },
        registrationIncomplete: false,
        mustResetPassword: false,
      },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.loggedIn, true);
    assert.equal(res.body.user.roleSlug, 'trainer');
    assert.equal(res.body.user.avatarPath, DEFAULT_AVATAR_PATH);
    assert.equal(res.body.user.avatarName, DEFAULT_AVATAR_NAME);

    const directAvatarSelect = state.executedSql.filter((entry) =>
      entry.includes('SELECT avatarPath, avatarName')
    );
    assert.equal(directAvatarSelect.length, 0, 'Session should not hard-select missing avatar columns.');

    const nullAliasSelect = state.executedSql.some((entry) =>
      entry.includes('NULL AS avatarPath') && entry.includes('NULL AS avatarName')
    );
    assert.equal(nullAliasSelect, true, 'Session query should alias missing avatar columns to NULL.');
  } finally {
    restore();
  }
});

test('session hydration keeps stored avatar fields when users avatar columns exist', async () => {
  const mockPool = {
    query: async (sql, params = []) => {
      const normalized = normalizeSql(sql);

      if (normalized.includes('FROM user_roles ur') && normalized.includes('JOIN roles r')) {
        return [[{ roleValue: 'administrator' }], []];
      }

      if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'users'")) {
        return [[{ column_name: 'avatarPath' }, { column_name: 'avatarName' }], []];
      }

      if (normalized.includes('avatarPath, avatarName, external_auth, membershipType FROM users WHERE id = ? LIMIT 1')) {
        assert.equal(params[0], 77);
        return [[{
          avatarPath: '/images/avatar/existing.png',
          avatarName: 'existing.png',
          external_auth: 0,
          membershipType: 'Admin',
        }], []];
      }

      throw new Error(`Unhandled SQL: ${normalized}`);
    },
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const handler = getBusinessHandler(route, 'get', '/session');
    const req = {
      headers: { cookie: 'flexfit.sid=fake', origin: 'http://localhost:5173' },
      session: {
        user: { id: 77, username: 'admin@example.com' },
        registrationIncomplete: false,
        mustResetPassword: false,
      },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.loggedIn, true);
    assert.equal(res.body.user.roleSlug, 'administrator');
    assert.equal(res.body.user.avatarPath, '/images/avatar/existing.png');
    assert.equal(res.body.user.avatarName, 'existing.png');
  } finally {
    restore();
  }
});

test('registration succeeds without avatar columns by inserting users row with schema-compatible columns only', async () => {
  const state = {
    userInsertSql: null,
    commitCount: 0,
    rollbackCount: 0,
    nextUserId: 991,
  };

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {
      state.commitCount += 1;
    },
    rollback: async () => {
      state.rollbackCount += 1;
    },
    release: () => {},
    query: async (sql, params = []) => {
      const normalized = normalizeSql(sql);

      if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'workout_schedules'")) {
        return [[], []];
      }

      if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'users'")) {
        return [[], []];
      }

      if (normalized.startsWith('INSERT INTO users (FirstName, LastName, username, Password, membershipType) VALUES (?, ?, ?, ?, ?)')) {
        state.userInsertSql = normalized;
        return [{ insertId: state.nextUserId, affectedRows: 1 }, []];
      }

      if (normalized.startsWith('INSERT INTO user_profiles')) {
        return [{ insertId: 1, affectedRows: 1 }, []];
      }

      if (normalized.startsWith('INSERT INTO user_memberships')) {
        return [{ insertId: 1, affectedRows: 1 }, []];
      }

      if (normalized.startsWith('INSERT INTO user_roles')) {
        return [{ insertId: 1, affectedRows: 1 }, []];
      }

      throw new Error(`Unhandled connection SQL: ${normalized}`);
    },
  };

  const mockPool = {
    query: async (sql, params = []) => {
      const normalized = normalizeSql(sql);
      if (normalized === 'SELECT * FROM users WHERE username = ?') {
        return [[], []];
      }

      if (normalized.startsWith('SELECT id, name, slug, price_monthly, price_yearly FROM membership_tiers')) {
        return [[{ id: 2, name: 'Pro', slug: 'pro', price_monthly: 19.99, price_yearly: 0 }], []];
      }

      throw new Error(`Unhandled pool SQL: ${normalized}`);
    },
    getConnection: async () => connection,
  };

  const { route, restore } = loadRouteWithMockPool(mockPool);

  try {
    const register = getBusinessHandler(route, 'post', '/register');
    const req = {
      body: {
        firstName: 'Schema',
        lastName: 'Compat',
        username: 'schemacompat@example.com',
        password: 'StrongPass1!',
        membershipType: 'User',
        subscriptionTierId: 2,
      },
      headers: { origin: 'http://localhost:5173' },
    };
    const res = createResponseRecorder();

    await register(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(Number(res.body.userId || 0), state.nextUserId);
    assert.ok(state.userInsertSql, 'Expected compatibility users insert SQL to execute.');
    assert.equal(state.userInsertSql.includes('avatarName'), false);
    assert.equal(state.userInsertSql.includes('avatarPath'), false);
    assert.equal(state.commitCount, 1);
    assert.equal(state.rollbackCount, 0);
  } finally {
    restore();
  }
});
