const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

const express = require('express');
const cors = require('cors');
const session = require('express-session');

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

// ✅ Use CORS (must come before session)
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    // Dev fallback for LAN/mobile testing when frontend runs on local network IP.
    if (isPrivateDevOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ✅ Configure session (only once)
const sessionCookieSecure = String(process.env.SESSION_COOKIE_SECURE || '').toLowerCase() === 'true' || isProduction;
const sessionCookieSameSite = sessionCookieSecure ? 'none' : 'lax';

if (sessionCookieSecure) {
  app.set('trust proxy', 1);
}

if (isDebugEnabled) {
  console.log('🧪 Session/CORS debug:', {
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: FRONTEND_URL || null,
    corsOrigins: [...allowedOrigins],
    sessionCookieSecure,
    sessionCookieSameSite,
  });
}

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  resave: false,
  saveUninitialized: false,
  proxy: sessionCookieSecure,
  cookie: {
    httpOnly: true,
    secure: sessionCookieSecure,
    sameSite: sessionCookieSameSite,
    maxAge: 1800000 // 30 min
  }
}));

// ✅ Debug session logging
app.use((req, res, next) => {
  if (isDebugEnabled) {
    console.log('🧠 Session inbound:', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin || null,
      hasCookieHeader: Boolean(req.headers.cookie),
      sessionId: req.sessionID || null,
      hasUserSession: Boolean(req.session?.user),
    });
  }
  next();
});

// ✅ DB Connect
const pool = require('./db.js');

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});