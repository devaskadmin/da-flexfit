const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session'); // ✅ Import express-session
const dbConfig = require('./dbConfig');
const bcrypt = require('bcryptjs'); // ✅ Import bcrypt for password hashing




const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));





// ✅ Enable CORS (Ensure credentials are included)

app.use(cors({
  origin: "http://localhost:5174", // Allow frontend requests
  credentials: true // Allow cookies/session authentication
}));

// ✅ Configure Express Sessions **BEFORE ROUTES**

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

// ✅ Ensure session middleware is working
app.use((req, res, next) => {
  console.log("Session Middleware:", req.session); // Debugging
  next();
});

// ✅ Create MySQL connection pool
const pool = mysql.createPool(dbConfig).promise();

// ✅ Fix: Add `/session` route to check authentication
app.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.json({ loggedIn: false });
});

// ✅ User Login Route

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("Login attempt:", username, password);
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // 🔹 Query database for user
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      console.log("❌ User not found:", username);
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
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed");
    res.json({ message: "Logged out successfully" });
  });
});




// ✅ Registration Route (Insert `demo` User)
app.get('/register', async (req, res) => {
  try {
    const username = "demo"; // ✅ Hardcoded username
    const password = "demo"; // ✅ Hardcoded password

    // ✅ Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Insert user into the database (if not already exists)
    await pool.query('INSERT INTO Users (username, password) VALUES (?, ?) ON DUPLICATE KEY UPDATE password = VALUES(password)', [username, hashedPassword]);

    res.json({ message: "User 'demo' registered successfully" });

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Users'); // Replace 'Users' with your table name
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
