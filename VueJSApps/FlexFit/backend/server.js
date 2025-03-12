const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');
const dbConfig = require('./dbConfig');
const bcrypt = require('bcryptjs'); // ✅ Import bcrypt for password hashing

require('dotenv').config(); // ✅ Load environment variables


const app = express();
app.use(express.json());


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
    

    console.log("Login attempt:", username, password);
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      console.log("User not found:", username);
      return res.status(401).json({ error: "User not found" });
    }

    const user = rows[0];

    // 🔹 Set session
    req.session.user = { id: user.id, username: user.username };
    console.log("User logged in:", req.session.user);

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


// ✅ Registration Route (Insert `demo` User)
app.post('/api/register', async (req, res) => {
  try {
    const firstName = "demo"; // ✅ Hardcoded first name
    const lastName = "demo"; // ✅ Hardcoded last name
    const username = "demo@demo.com"; // ✅ Hardcoded email
    const password = "demo"; // ✅ Hardcoded password

    // ✅ Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Check if user `demo` already exists
    const [existingUser] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "User 'demo' already exists" });
    }

    // ✅ Insert the `demo` user (DO NOT specify `id`)
    await pool.query(`
      INSERT INTO users (FirstName, LastName, username, Password) 
      VALUES (?, ?, ?, ?)`, 
      [firstName, lastName, username, hashedPassword]
    );

    res.json({ message: "User 'demo' registered successfully" });

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
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

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
