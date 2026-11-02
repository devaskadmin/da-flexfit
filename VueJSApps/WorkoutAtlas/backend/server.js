const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStoreFactory = require('connect-mysql2');
const MySQLStore = MySQLStoreFactory(session);

const app = express();
app.use(express.json());
const isProduction = process.env.NODE_ENV === 'production';
const debugFlag = String(process.env.DEBUG || process.env.VITE_DEBUG || '').toLowerCase();
const isDebugEnabled = ['true', '1', 'yes'].includes(debugFlag);
const CLIENT_ORIGIN = String(process.env.CLIENT_ORIGIN || '').trim();
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN;
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || '').trim();
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Always include production and local frontend origins as hard fallbacks.
const DEFAULT_FRONTEND_ORIGINS = [
  'https://workoutatlas.com',
  'https://www.workoutatlas.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];
const allowedOrigins = new Set(
  [...DEFAULT_FRONTEND_ORIGINS, CLIENT_ORIGIN, FRONTEND_URL, ...CORS_ORIGINS].filter(Boolean)
);

console.log(`🚀 CLIENT_ORIGIN=${CLIENT_ORIGIN || '(not set)'}`);
console.log(`🌐 Allowed CORS origins: ${[...allowedOrigins].join(', ') || '(none configured)'}`);
console.log(`🍪 COOKIE_DOMAIN=${COOKIE_DOMAIN || '(host-only)'}`);

// ✅ Trust proxy always — Render (and most cloud hosts) terminate TLS at the
// load balancer and forward requests via HTTP internally. Without this,
// express-session marks cookies secure=false which Safari silently drops.
app.set('trust proxy', 1);

// ✅ Use CORS (must come before session)
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    console.warn(`🚫 CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma'],
}));

// ✅ Configure session (only once)
// Safari + cross-site Render setup requires secure + SameSite=None.
const cookieConfig = {
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  httpOnly: true,
  maxAge: THIRTY_DAYS_MS,
};

const sessionCookieSecure = cookieConfig.secure;
const sessionCookieSameSite = cookieConfig.sameSite;

console.log(`🍪 Session cookie: name=flexfit.sid secure=${sessionCookieSecure} sameSite=${sessionCookieSameSite}`);
console.log('COOKIE MODE', {
  env: process.env.NODE_ENV,
  secure: cookieConfig.secure,
  sameSite: cookieConfig.sameSite,
});
console.log({
  environment: process.env.NODE_ENV,
  cookieSecure: cookieConfig.secure,
  sameSite: cookieConfig.sameSite,
  frontend: process.env.FRONTEND_URL,
});

if (isDebugEnabled) {
  console.log('🧪 Session/CORS debug:', {
    nodeEnv: process.env.NODE_ENV,
    isProduction,
    clientOrigin: CLIENT_ORIGIN || null,
    corsOrigins: [...allowedOrigins],
    sessionCookieSecure,
    sessionCookieSameSite,
    cookieDomain: COOKIE_DOMAIN || null,
  });
}

// ✅ Persist sessions in MySQL so they survive Render cold starts / restarts.
// 0.82.22a: no MemoryStore fallback for session verification reliability.
let sessionStore;
try {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_DATABASE) {
    throw new Error('Session store requires DB_HOST, DB_USER, and DB_DATABASE. MemoryStore fallback is disabled in v0.82.22a.');
  }

  const sessionDbConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: 2,
    waitForConnections: true,
    queueLimit: 0,
    charset: 'utf8mb4',
  };

  sessionStore = new MySQLStore({
    config: sessionDbConfig,
    table: 'user_sessions',
    expiration: THIRTY_DAYS_MS,
    pool: true,
    cleanup: true,
    keepalive: 30000,
    retries: 3,
    secret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  });

  console.log('🗄️  Session store: connect-mysql2 user_sessions (persistent across restarts)');
  console.log('[SESSION STORE]', { store: 'connect-mysql2', table: 'user_sessions', ready: true });
} catch (storeErr) {
  console.error('❌ Failed to init MySQL session store:', storeErr?.message || storeErr);
  process.exit(1);
}

app.use(session({
  name: 'flexfit.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: true, // always true — Render always reverse-proxies
  store: sessionStore,
  cookie: {
    ...cookieConfig,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    path: '/',
    maxAge: cookieConfig.maxAge,
  }
}));

// ✅ Debug session logging
app.use((req, res, next) => {
  if (isDebugEnabled) {
    const rawCookie = String(req.headers?.cookie || '');
    const origin = req.headers.origin || null;
    const corsAllowed = !origin || allowedOrigins.has(origin);
    console.log('🧠 Session inbound:', {
      method: req.method,
      path: req.path,
      origin,
      corsAllowed,
      hasCookieHeader: Boolean(req.headers.cookie),
      cookieDetected: /flexfit\.sid=/.test(rawCookie),
      hasUserSession: Boolean(req.session?.user),
      secureFlag: sessionCookieSecure,
      sameSiteValue: sessionCookieSameSite,
      renderProxyStatus: app.get('trust proxy'),
    });

    console.log('FlexFit Session Diagnostics', {
      cookiePresent: /flexfit\.sid=/.test(rawCookie),
      sameSiteValue: sessionCookieSameSite,
      secureFlag: sessionCookieSecure,
      origin,
      corsResult: corsAllowed,
      renderProxyStatus: app.get('trust proxy'),
    });
  }
  next();
});

// ✅ DB Connect
const pool = require('./db.js');

const EXTERNAL_REGISTRATION_ALLOWED_PATH_PREFIXES = [
  '/api/auth/google',
  '/api/auth/google/test-unlink',
  '/api/logout',
  '/api/session',
  '/api/session/check',
  '/api/auth/session-test',
  '/api/register-tiers',
  '/api/ext-register',
  '/api/health',
  '/api/db-status',
  '/api/debug/',
];

const isExternalRegistrationAllowedPath = (pathName = '') => {
  return EXTERNAL_REGISTRATION_ALLOWED_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) {
      return pathName.startsWith(prefix);
    }

    return pathName === prefix || pathName.startsWith(`${prefix}/`);
  });
};

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const userId = Number(req.session?.user?.id || 0);
  if (!userId) {
    return next();
  }

  if (isExternalRegistrationAllowedPath(req.path)) {
    return next();
  }

  try {
    const [rows] = await pool.query(
      'SELECT external_auth, membershipType FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = rows?.[0];

    if (!user) {
      return next();
    }

    const isExternalAuth = Number(user.external_auth || 0) === 1;
    const hasMembershipType = !(user.membershipType === null || typeof user.membershipType === 'undefined' || String(user.membershipType).trim() === '');
    const registrationIncomplete = isExternalAuth && !hasMembershipType;

    req.session.registrationIncomplete = registrationIncomplete;
    if (req.session.user) {
      req.session.user.registrationIncomplete = registrationIncomplete;
    }

    if (registrationIncomplete) {
      return res.status(403).json({
        error: 'External registration is incomplete. Complete registration to continue.',
        registrationIncomplete: true,
        redirectPath: '/ext-register',
      });
    }

    return next();
  } catch (err) {
    console.error('❌ External registration gate error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to verify registration state.' });
  }
});

// ✅ Prevent idle app pool connections from emitting unhandled 'error' events.
// mysql2 emits 'error' on the pool when an idle connection is reset by the server
// (ECONNRESET). Without this handler the default EventEmitter behaviour crashes Node.
pool.on('error', (err) => {
  console.error('[APP POOL ERROR]', err.code || err.message, err);
});

// ✅ Serve static avatar images
app.use('/images/avatar', express.static(path.join(__dirname, 'src/images/avatar')));

// ✅ Serve static exercise images
app.use('/assets/Excerises', express.static(path.join(__dirname, 'free-exercise-db-main/exercises')));

//Define Workout Routes - Loads workout log API
const workoutLogRoutes      = require('./api/workout-log'); // ✅ correct path
const workoutSessionRoutes  = require('./api/workout-sessions'); // ✅ 0.77 session tracking
const openFoodFactsRoutes   = require('./api/OpenFoodFactsAPI/main-api.js');
const avatarRoutes          = require('./src/routes/avatar.js');
const toolsRoutes           = require('./api/tools.js');
const mediaRoutes           = require('./api/media.js');
const aiGatewayRoutes       = require('./api/ai-gateway.js');
const nutritionRoutes       = require('./api/nutrition.js');

// Import routes
app.use('/api', require('./api/auth.js'));
app.use('/api', require('./api/config.js'));
app.use('/api', require('./api/users.js'));
app.use('/api', require('./api/excerises.js'));
app.use('/api', require('./api/notifications.js'));
app.use('/api/workout-log', workoutLogRoutes);
app.use('/api', workoutSessionRoutes);
app.use('/api', openFoodFactsRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/api/admin', require('./api/admin.js')); // 🔒 Admin-only routes
app.use('/api/progress', require('./api/progress.js')); // 📊 v0.82 Progress Stats
app.use('/api', require('./api/dashboard.js')); // 📊 v0.82.20 Dashboard Live Metrics
app.use('/api', toolsRoutes); // 🧰 v0.83.5 Tools diagnostics
app.use('/api', mediaRoutes); // 🖼️ v0.83.7 media resolver
app.use('/api', aiGatewayRoutes); // 🤖 WorkoutAtlas AI gateway proxy
app.use('/api', require('./api/goals.js')); // 🎯 v0.85.40.2 Goals System
app.use('/api', nutritionRoutes); // 🥗 v0.85.AI.2.1 local nutrition image upload foundation

// Lightweight health route for local/API reachability checks.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ✅ Global JSON error handler — MUST be registered after all routes.
// Catches express-session store failures (which call next(err) before any route
// handler runs), DB middleware crashes, and unhandled route errors.
// Without this, Express returns a text/html 500 which the frontend cannot parse,
// causing the fallback "Sign-in request failed before authentication could complete."
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isCorsOriginDenied = String(err?.message || '') === 'Not allowed by CORS';
  const status = isCorsOriginDenied
    ? 403
    : (err?.status || err?.statusCode || 500);

  // Classify the error so we can give the user a meaningful message.
  const isSessionStoreErr = (
    err?.message?.includes('ECONNRESET') ||
    err?.message?.includes('ECONNREFUSED') ||
    err?.message?.includes('ETIMEDOUT') ||
    err?.code === 'ECONNRESET' ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
    // express-session passes its own error objects; the store is MySQL-backed
    (err?.constructor?.name === 'Error' && /session/i.test(err?.message || ''))
  );

  const userMessage = isCorsOriginDenied
    ? 'Request origin not allowed.'
    : (isSessionStoreErr
      ? 'The session store is temporarily unavailable. Please wait a moment and try again.'
      : (err?.message || 'An unexpected server error occurred.'));

  console.error('❌ [Global error handler]', {
    status,
    code: err?.code || null,
    message: err?.message || String(err),
    isSessionStoreErr,
    path: req?.path || null,
    method: req?.method || null,
  });

  // Always respond with JSON so the frontend can parse error.response.data
  if (!res.headersSent) {
    res.status(status).json({
      error: userMessage,
      code: err?.code || null,
    });
  }
});

// ✅ Process-level guards — keep Node alive on unexpected errors.
// These catch anything that escapes route handlers and pool error handlers.
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

// ✅ DB heartbeat — ping every 5 minutes to prevent idle connection resets.
// mysql2 keepAlive works at the TCP layer but some cloud proxies still reset
// idle sockets; a periodic SELECT 1 keeps the logical connection active.
const dbHeartbeatInterval = setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('[DB HEARTBEAT]', err.code || err.message, err);
  }
}, 300000); // 5 minutes

let activeServer = null;
let isShuttingDown = false;

const closeHttpServer = async () => {
  if (!activeServer) {
    return;
  }

  await new Promise((resolve) => {
    activeServer.close((err) => {
      if (err) {
        console.error('⚠️ HTTP server close error:', err?.message || err);
      }
      resolve();
    });
  });
};

const closeSessionStore = async () => {
  if (!sessionStore || typeof sessionStore.close !== 'function') {
    return;
  }

  await new Promise((resolve) => {
    sessionStore.close(() => resolve());
  });
};

const closeDbPool = async () => {
  if (!pool || typeof pool.end !== 'function') {
    return;
  }

  try {
    await pool.end();
  } catch (err) {
    console.error('⚠️ DB pool close error:', err?.message || err);
  }
};

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`🛑 Received ${signal}. Shutting down backend gracefully...`);

  clearInterval(dbHeartbeatInterval);

  const forceExitTimer = setTimeout(() => {
    console.error('⏱️ Graceful shutdown timeout reached. Forcing exit.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    await closeHttpServer();
    await closeSessionStore();
    await closeDbPool();
    clearTimeout(forceExitTimer);
    console.log('✅ Backend shutdown complete.');
    process.exit(0);
  } catch (err) {
    clearTimeout(forceExitTimer);
    console.error('❌ Error during graceful shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

const START_PORT = Number(process.env.PORT || 5000);

const startServer = (port, isLocalFallbackMode) => {
  const server = app.listen(port, '0.0.0.0', () => {
    if (isLocalFallbackMode) {
      console.log(`🏠 Local backend started on port ${port}`);
      console.log(`✅ Local backend port selected: ${port}`);
    } else {
      console.log(`🚀 Backend running on port ${port}`);
    }
  });

  activeServer = server;

  return server;
};

const server = startServer(START_PORT, false);
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`❌ Startup failed: backend port ${START_PORT} is already in use.`);
    console.error('   Stop the existing process bound to this port before retrying.');
    process.exit(1);
  }

  console.error('❌ Startup failed:', err);
  process.exit(1);
});