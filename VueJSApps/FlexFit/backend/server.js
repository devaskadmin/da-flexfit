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

// Middleware
app.use(express.json());

// ✅ Setup frontend origin
const FRONTEND_PORTS = [5173, 5174, 5175];
let FRONTEND_PORT = FRONTEND_PORTS[0];
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `http://localhost:${FRONTEND_PORT}`;
console.log(`🚀 Allowing frontend origin: ${FRONTEND_ORIGIN}`);

// ✅ Use CORS (must come before session)
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost:5173, localhost:5174, and localhost:5175 for dev
    if (FRONTEND_PORTS.map(port => `http://localhost:${port}`).includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ✅ Configure session (only once)
app.use(session({
  secret: 'foifoiofiofri99990!',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // true if using HTTPS
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
app.use('/api/workout-log', workoutLogRoutes);
app.use('/api', openFoodFactsRoutes);

// ✅ Dynamic backend port handling
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