const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

const express = require('express');
const cors = require('cors');
const session = require('express-session');

const app = express();
app.use(express.json());
const FRONTEND_URL = process.env.FRONTEND_URL;
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([FRONTEND_URL, ...CORS_ORIGINS].filter(Boolean));

console.log(`🚀 FRONTEND_URL=${FRONTEND_URL || '(not set)'}`);

// ✅ Use CORS (must come before session)
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ✅ Configure session (only once)
const isProduction = process.env.NODE_ENV === 'production';
const sessionCookieSecure = String(process.env.SESSION_COOKIE_SECURE || '').toLowerCase() === 'true' || isProduction;

if (sessionCookieSecure) {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: sessionCookieSecure,
    sameSite: sessionCookieSecure ? 'none' : 'lax',
    maxAge: 1800000 // 30 min
  }
}));

// ✅ Debug session logging
app.use((req, res, next) => {
  console.log("🧠 Session:", req.session);
  next();
});

// ✅ DB Connect
const pool = require('./db.js');

//Define Workout Routes - Loads workout log API
const workoutLogRoutes = require('./api/workout-log'); // ✅ correct path
const openFoodFactsRoutes = require('./api/OpenFoodFactsAPI/main-api.js');

// Import routes
app.use('/api', require('./api/auth.js'));
app.use('/api', require('./api/users.js'));
app.use('/api', require('./api/excerises.js'));
app.use('/api', require('./api/notifications.js'));
app.use('/api/workout-log', workoutLogRoutes);
app.use('/api', openFoodFactsRoutes);
app.use('/api/admin', require('./api/admin.js')); // 🔒 Admin-only routes

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});