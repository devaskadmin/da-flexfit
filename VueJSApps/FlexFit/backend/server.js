const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');
const dbConfig = require('./dbConfig');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

const IS_RENDER = String(process.env.RENDER || '').toLowerCase() === 'true' || !!process.env.RENDER_EXTERNAL_URL;
const RUN_PUBLIC = String(process.env.RUN_PUBLIC || 'no').toLowerCase() === 'yes' || IS_RENDER;

// Middleware
app.use(express.json());

// ✅ Setup frontend origin + CORS strategy
const FRONTEND_PORTS = [5173, 5174, 5175];
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || (RUN_PUBLIC ? '' : 'http://localhost:5173');

// Optional comma-separated explicit allow-list for public hosting.
// Example: CORS_ORIGINS=https://my-frontend.onrender.com,https://staging.myapp.com
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedPublicOrigins = new Set([FRONTEND_ORIGIN, ...CORS_ORIGINS].filter(Boolean));
const allowedLocalOrigins = new Set(FRONTEND_PORTS.map((port) => `http://localhost:${port}`));

console.log(`🌐 RUN_PUBLIC=${RUN_PUBLIC ? 'yes' : 'no'}`);
console.log(`🚀 FRONTEND_ORIGIN=${FRONTEND_ORIGIN || '(not set)'}`);

// ✅ Use CORS (must come before session)
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Public deploy mode (Render): only allow configured origins.
    if (RUN_PUBLIC && allowedPublicOrigins.has(origin)) {
      return callback(null, true);
    }

    // Public deploy mode fallback for testing on Render when no explicit origin list is set.
    // Recommended for production: set FRONTEND_ORIGIN and/or CORS_ORIGINS.
    if (RUN_PUBLIC && allowedPublicOrigins.size === 0) {
      if (origin.includes('.onrender.com')) return callback(null, true);
      return callback(null, true);
    }

    // Local mode: allow localhost dev ports.
    if (!RUN_PUBLIC && allowedLocalOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ✅ Configure session (only once)
if (RUN_PUBLIC) {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: 'foifoiofiofri99990!',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: RUN_PUBLIC, // required for sameSite='none' on Render HTTPS
    sameSite: RUN_PUBLIC ? 'none' : 'lax',
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

// ✅ Backend port handling
if (RUN_PUBLIC) {
  // Render assigns PORT dynamically. Always bind to process.env.PORT in public mode.
  const PUBLIC_PORT = Number.parseInt(process.env.PORT, 10) || 10000;
  app.listen(PUBLIC_PORT, '0.0.0.0', () => {
    console.log(`🚀 Public backend running on 0.0.0.0:${PUBLIC_PORT}`);
  });
} else {
  // Local/dev fallback behavior: try common local ports.
  const BACKEND_PORTS = [5000, 5001, 5002];
  let BACKEND_PORT = BACKEND_PORTS[0];

  const tryPort = async (portIndex = 0) => {
    if (portIndex >= BACKEND_PORTS.length) {
      console.error("❌ No available ports for the backend.");
      process.exit(1);
    }

    const testPort = BACKEND_PORTS[portIndex];
    const server = app.listen(testPort, () => {
      BACKEND_PORT = testPort;
      console.log(`🚀 Backend running at http://localhost:${BACKEND_PORT}`);
    });

    server.on("error", () => {
      console.warn(`⚠️ Port ${testPort} is in use. Trying next port...`);
      tryPort(portIndex + 1);
    });
  };

  tryPort();
}