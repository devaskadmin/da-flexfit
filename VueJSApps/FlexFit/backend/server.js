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
const FRONTEND_PORT = process.env.FRONTEND_PORT || 5173;
const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;
console.log(`🚀 Allowing frontend origin: ${FRONTEND_ORIGIN}`);

// ✅ Use CORS (must come before session)
app.use(cors({
  origin: FRONTEND_ORIGIN,
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


// Import routes
app.use('/api', require('./api/auth.js'));
app.use('/api', require('./api/users.js'));
app.use('/api', require('./api/excerises.js'));
app.use('/api/workout-log', workoutLogRoutes);










// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
