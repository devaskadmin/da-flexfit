const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
// ✅ RAW mysql2 (non-promise) required for express-mysql-session.
// express-mysql-session calls .query() directly on the pool; promise pools
// wrap that and break the internal connection check → 'this.connection.query is not a function'.
const mysqlRaw = require('mysql2');

const app = express();
app.use(express.json());
const isProduction = process.env.NODE_ENV === 'production';
const debugFlag = String(process.env.DEBUG || process.env.VITE_DEBUG || '').toLowerCase();
const isDebugEnabled = ['true', '1', 'yes'].includes(debugFlag);
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN;
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([FRONTEND_URL, ...CORS_ORIGINS].filter(Boolean));

const isPrivateDevOrigin = (origin) => {
  if (!origin || isProduction) return false;

  try {
    const { hostname } = new URL(origin);
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;

    const match172 = hostname.match(/^172\.(\d{1,3})\./);
    if (match172) {
      const block = Number(match172[1]);
      if (block >= 16 && block <= 31) return true;
    }
  } catch (_) {
    return false;
  }

  return false;
};

console.log(`🚀 FRONTEND_URL=${FRONTEND_URL || '(not set)'}`);
console.log(`🌐 Allowed CORS origins: ${[...allowedOrigins].join(', ') || '(none configured)'}`);

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

    // Dev fallback for LAN/mobile testing when frontend runs on local network IP.
    if (isPrivateDevOrigin(origin)) {
      return callback(null, true);
    }

    console.warn(`🚫 CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma'],
}));

// ✅ Configure session (only once)
// secure=true required for SameSite=None; derive from NODE_ENV so Render
// production deployments are always correct even if SESSION_COOKIE_SECURE is unset.
const sessionCookieSecure = isProduction || String(process.env.SESSION_COOKIE_SECURE || '').toLowerCase() === 'true';
// SameSite=None is required for cross-origin cookies (Safari + all modern browsers).
// SameSite=Lax breaks cross-origin POST (login) on Safari / iOS.
const sessionCookieSameSite = sessionCookieSecure ? 'none' : 'lax';

console.log(`🍪 Session cookie: name=flexfit_session secure=${sessionCookieSecure} sameSite=${sessionCookieSameSite}`);

if (isDebugEnabled) {
  console.log('🧪 Session/CORS debug:', {
    nodeEnv: process.env.NODE_ENV,
    isProduction,
    frontendUrl: FRONTEND_URL || null,
    corsOrigins: [...allowedOrigins],
    sessionCookieSecure,
    sessionCookieSameSite,
  });
}

// ✅ Persist sessions in MySQL so they survive Render cold starts / restarts.
// Falls back to in-memory store when DB config is absent (local dev without DB).
let sessionStore;
try {
  if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_DATABASE) {
    // ⚠️  MUST be a raw mysql2 pool — NOT pool.promise().
    // express-mysql-session calls pool.query() internally; a promise-pool wraps
    // that interface and causes: 'this.connection.query is not a function'.
    const sessionPool = mysqlRaw.createPool({
      host:              process.env.DB_HOST,
      port:              Number(process.env.DB_PORT || 3306),
      user:              process.env.DB_USER,
      password:          process.env.DB_PASSWORD,
      database:          process.env.DB_DATABASE,
      connectionLimit:   1,   // 1 connection for session store (read + write share one slot)
      waitForConnections: true,
      queueLimit:        0,
      enableKeepAlive:   true,
      keepAliveInitialDelay: 0,
      connectTimeout:    30000,
    });

    // Validate pool has the interface express-mysql-session expects
    console.log('[SESSION DEBUG]', {
      hasQuery:   typeof sessionPool.query,
      hasExecute: typeof sessionPool.execute,
      limit:      1,
    });

    sessionStore = new MySQLStore({
      clearExpired:            true,
      checkExpirationInterval: 15 * 60 * 1000,       // prune expired sessions every 15 min
      expiration:              7 * 24 * 60 * 60 * 1000, // 7 days — match cookie maxAge
      createDatabaseTable:     true,
      schema: {
        tableName:   'sessions',
        columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
      },
    }, sessionPool);

    // ✅ Log session store errors but NEVER crash the backend.
    sessionStore.on('error', (err) => {
      console.error('⚠️  Session store error (non-fatal):', err.message);
    });

    // ✅ Prevent idle session pool connections from crashing Node on ECONNRESET.
    sessionPool.on('error', (err) => {
      console.error('[SESSION POOL ERROR]', err.code || err.message, err);
    });

    console.log('🗄️  Session store: MySQL (persistent across restarts) | pool connectionLimit=1');
    console.log('📊 DB budget: app=2 + session=1 = 3 max connections');
    console.log('[SESSION STORE]', { store: 'mysql', ready: true });
  } else {
    console.warn('⚠️  Session store: in-memory (DB env vars not set — sessions lost on restart)');
  }
} catch (storeErr) {
  console.error('❌ Failed to init MySQL session store:', storeErr?.message || storeErr);
}

app.use(session({
  name: 'flexfit_session',
  secret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  resave: false,
  saveUninitialized: false,
  proxy: true, // always true — Render always reverse-proxies
  store: sessionStore,  // undefined = in-memory fallback
  cookie: {
    httpOnly: true,
    secure: sessionCookieSecure,
    sameSite: sessionCookieSameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days default; auth.js overrides per login
  }
}));

// ✅ Debug session logging
app.use((req, res, next) => {
  if (isDebugEnabled) {
    const rawCookie = String(req.headers?.cookie || '');
    console.log('🧠 Session inbound:', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin || null,
      hasCookieHeader: Boolean(req.headers.cookie),
      cookieDetected: /flexfit_session=/.test(rawCookie),
      sessionId: req.sessionID || null,
      hasUserSession: Boolean(req.session?.user),
      secureFlag: sessionCookieSecure,
      sameSiteValue: sessionCookieSameSite,
    });
  }
  next();
});

// ✅ DB Connect
const pool = require('./db.js');

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

// Import routes
app.use('/api', require('./api/auth.js'));
app.use('/api', require('./api/users.js'));
app.use('/api', require('./api/excerises.js'));
app.use('/api', require('./api/notifications.js'));
app.use('/api/workout-log', workoutLogRoutes);
app.use('/api', workoutSessionRoutes);
app.use('/api', openFoodFactsRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/api/admin', require('./api/admin.js')); // 🔒 Admin-only routes

// ✅ Global JSON error handler — MUST be registered after all routes.
// Catches express-session store failures (which call next(err) before any route
// handler runs), DB middleware crashes, and unhandled route errors.
// Without this, Express returns a text/html 500 which the frontend cannot parse,
// causing the fallback "Sign-in request failed before authentication could complete."
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err?.status || err?.statusCode || 500;

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

  const userMessage = isSessionStoreErr
    ? 'The session store is temporarily unavailable. Please wait a moment and try again.'
    : (err?.message || 'An unexpected server error occurred.');

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
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('[DB HEARTBEAT]', err.code || err.message, err);
  }
}, 300000); // 5 minutes

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});