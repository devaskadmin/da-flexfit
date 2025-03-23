const fs = require('fs');
const path = require('path'); // ✅ This was missing
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');
const dbConfig = require('./dbConfig');
const bcrypt = require('bcryptjs');
const net = require('net');
const helmet = require("helmet");
require('dotenv').config(); // ✅ Load environment variables




const app = express();
app.use(express.json());
app.use(helmet());


// ✅ Enable CORS (Ensure credentials are included)


// ✅ Get frontend port from environment variable or default to `5173`
const FRONTEND_PORT = process.env.FRONTEND_PORT || 5173;
const DEFAULT_ORIGIN = `http://localhost:${FRONTEND_PORT}`;

console.log(`🚀 Allowing frontend origin: ${DEFAULT_ORIGIN}`);

// ✅ Enable CORS with dynamic origin

app.use(cors({
  origin: (origin, callback) => {
    // Allow frontend requests dynamically based on request origin
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// ✅ Configure Express Sessions
app.use(session({
  secret: 'foifoiofiofri99990!', // 🔐 Change to a secure key
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // ❌ Change to `true` in production with HTTPS
    maxAge: 1800000 // 30 min session timeout
  }
}));

// ✅ Debug Session Middleware
app.use((req, res, next) => {
  console.log("Session Middleware:", req.session);
  next();
});

// ✅ Create MySQL connection pool
const pool = mysql.createPool(dbConfig).promise();

// ✅ Session Check Route
app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.json({ loggedIn: false });
});


// ✅ Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("Login attempt:", username);

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // ✅ Check if user exists
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      console.log("❌ User not found:", username);
      return res.status(401).json({ error: "Invalid credentials" }); // Don't reveal if it's user or pass
    }

    const user = rows[0];

    // ✅ Compare hashed password
    const isMatch = await bcrypt.compare(password, user.Password); // Assuming 'Password' is the column

    if (!isMatch) {
      console.log("❌ Invalid password for:", username);
      return res.status(401).json({ error: "Invalid credentials" }); // Generic error for safety
    }

    // ✅ Set session only if login is successful
    req.session.user = { id: user.id, username: user.username };
    console.log("✅ User logged in:", req.session.user);

    res.json({ message: "Login successful", user: req.session.user });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});


// ✅ Logout Route
app.post('/api/logout', (req, res) => {
  console.log("A");
  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed");
    res.json({ message: "Logged out successfully" });
  });
});



//Reegistration route
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, username, password } = req.body;

    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Check if user already exists
    const [existingUser] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "User already exists." });
    }

    // ✅ Insert new user (adjust columns if needed)
    await pool.query(
      `INSERT INTO users (FirstName, LastName, username, Password) VALUES (?, ?, ?, ?)`,
      [firstName, lastName, username, hashedPassword]
    );

    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});



// ✅ Fetch All Users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Users');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});



// ✅ Read `BACKEND_PORT` instead of `PORT`
const DEFAULT_BACKEND_PORT = process.env.BACKEND_PORT || 5000;
const FRONTEND_ENV_PATH = process.env.FRONTEND_ENV_PATH || '../frontend/.env';

// ✅ Function to check if a port is available
const checkPort = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
};

// ✅ Function to find the next available port
const getAvailablePort = async () => {
  const ports = [DEFAULT_BACKEND_PORT, DEFAULT_BACKEND_PORT + 1, DEFAULT_BACKEND_PORT + 2];
  for (const port of ports) {
    if (await checkPort(port)) {
      return port;
    }
  }
  return DEFAULT_BACKEND_PORT;
};

// ✅ Function to update frontend `.env` file while keeping existing variables
const updateFrontendEnv = (port) => {
  const frontendEnvPath = path.join(__dirname, FRONTEND_ENV_PATH);
  let envContent = '';

  try {
    if (fs.existsSync(frontendEnvPath)) {
      envContent = fs.readFileSync(frontendEnvPath, 'utf8');

      // 🔹 Check if `VITE_API_BASE` already exists, replace it, else append it
      if (envContent.includes('VITE_API_BASE=')) {
        envContent = envContent.replace(/VITE_API_BASE=.*/g, `VITE_API_BASE=http://localhost:${port}`);
      } else {
        envContent += `\nVITE_API_BASE=http://localhost:${port}\n`;
      }
    } else {
      // 🔹 If `.env` file does not exist, create it
      envContent = `VITE_API_BASE=http://localhost:${port}\n`;
    }

    fs.writeFileSync(frontendEnvPath, envContent);
    console.log(`✅ Updated frontend .env: VITE_API_BASE=http://localhost:${port}`);
  } catch (error) {
    console.error("❌ Failed to update frontend .env file:", error);
  }
};

// ✅ Start the server with a dynamically selected port
(async () => {
  const PORT = await getAvailablePort();
  updateFrontendEnv(PORT);

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔗 Backend API URL: http://localhost:${PORT}`);
  });
})();
