const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dbConfig = require('../dbConfig');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');

// ✅ DB Connect
const pool = require('../db.js');

// Temporary public health endpoint for login page status display
router.get('/db-status', async (req, res) => {
  try {
    await pool.query('SELECT 1 AS ok');
    return res.json({ connected: true });
  } catch (err) {
    console.error('❌ DB status check failed:', err?.message || err);
    const isDebugEnabled = ['true', '1', 'yes'].includes(String(process.env.DEBUG || '').toLowerCase());

    return res.status(500).json({
      connected: false,
      ...(isDebugEnabled
        ? {
            debug: {
              code: err?.code || null,
              errno: err?.errno || null,
              sqlState: err?.sqlState || null,
              message: err?.message || 'Unknown database connection error',
              host: process.env.DB_HOST || null,
              port: process.env.DB_PORT || null,
              database: process.env.DB_DATABASE || null,
              user: process.env.DB_USER || null,
            },
          }
        : {}),
    });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
    try {
    const { username, password } = req.body;
    console.log("Login attempt:", username);
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      
      if (rows.length === 0) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.Password);
      
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      req.session.user = { id: user.id, username: user.username };
      console.log("✅ Session created:", req.session.user);
      res.json({ message: "Login successful", user: req.session.user });
      
    } catch (err) {
        console.error("❌ Login error:", err);
        res.status(500).json({ error: "Login failed" });
        }
});


//Logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) return res.status(500).send("Logout failed");
      res.json({ message: "Logged out successfully" });
    });
  });

//Get Session
router.get('/session', (req, res) => {
    if (req.session?.user) {
      return res.json({ loggedIn: true, user: req.session.user });
    }
    res.json({ loggedIn: false });
  });

// Dev bootstrap: promote current session user to admin.
// This is intentionally gated behind DEBUG flags.
router.post('/bootstrap/promote-self-admin', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'User not logged in' });
  }

  const debugNoAuth = String(process.env.DEBUG_NO_AUTH || '').toLowerCase();
  const debugFlag = String(process.env.DEBUG || '').toLowerCase();
  const isDebugEnabled = ['true', '1', 'yes'].includes(debugNoAuth) || ['true', '1', 'yes'].includes(debugFlag);

  if (!isDebugEnabled) {
    return res.status(403).json({ error: 'Bootstrap admin endpoint is disabled outside debug mode.' });
  }

  const userId = req.session.user.id;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Ensure admin role exists
    let [roleRows] = await conn.query('SELECT id FROM roles WHERE slug = ? LIMIT 1', ['admin']);
    let adminRoleId = roleRows[0]?.id;

    if (!adminRoleId) {
      const [insertRole] = await conn.query(
        'INSERT INTO roles (name, slug, description, is_active) VALUES (?, ?, ?, ?)',
        ['Admin', 'admin', 'Full system access', 1]
      );
      adminRoleId = insertRole.insertId;
    }

    // 2) Upsert user_profiles to admin
    await conn.query(
      `INSERT INTO user_profiles (user_id, user_role, tier, settings)
       VALUES (?, 'admin', 3, '[]')
       ON DUPLICATE KEY UPDATE
         user_role = 'admin',
         tier = CASE WHEN tier IS NULL OR tier < 3 THEN 3 ELSE tier END`,
      [userId]
    );

    // 3) Ensure user_roles has admin mapping
    await conn.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by), assigned_at = NOW()`,
      [userId, adminRoleId, userId]
    );

    await conn.commit();
    return res.json({
      message: 'User promoted to admin successfully.',
      userId,
      role: 'admin',
    });
  } catch (err) {
    await conn.rollback();
    console.error('❌ Bootstrap promote-self-admin error:', err);

    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        error: 'Required role/profile tables are missing. Run 0.6.2 schema migration first.',
      });
    }

    return res.status(500).json({ error: 'Failed to promote user to admin.' });
  } finally {
    conn.release();
  }
});

  router.get('/user-id', (req, res) => {
    if (req.session?.user?.id) {
      return res.json({ userId: req.session.user.id });
    }
    res.status(401).json({ error: 'User not logged in' });
  });




//Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, username, password } = req.body;

    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    console.log("Submitting:", {
      firstName,
      lastName,
      username,
      password,
    });
    

    const safeFirst = sanitizeText(firstName, 100);
    const safeLast = sanitizeText(lastName, 100);
    const safeUser = sanitizeText(username, 100);
    const hashedPassword = await bcrypt.hash(password, 10);


    
    

    const [existingUser] = await pool.query("SELECT * FROM users WHERE username = ?", [safeUser]);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    // ── 0.6.2: wrap all inserts in a transaction ──────────────────────────
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Create the core user row
      const [userResult] = await conn.query(
        "INSERT INTO users (FirstName, LastName, username, Password) VALUES (?, ?, ?, ?)",
        [safeFirst, safeLast, safeUser, hashedPassword]
      );
      const newUserId = userResult.insertId;

      // 2. Create profile — Administrator (role=admin, tier=3 Elite)
      await conn.query(
        `INSERT INTO user_profiles (user_id, user_role, tier, settings)
         VALUES (?, 'admin', 3, '[]')`,
        [newUserId]
      );

      // 3. Create membership — Elite / lifetime / active
      await conn.query(
        `INSERT INTO user_memberships (user_id, tier_id, status, billing_cycle, started_at)
         VALUES (?, 3, 'active', 'lifetime', CURDATE())`,
        [newUserId]
      );

      // 4. Assign admin role via user_roles pivot
      await conn.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by)
         SELECT ?, id, ? FROM roles WHERE slug = 'admin' LIMIT 1`,
        [newUserId, newUserId]
      );

      await conn.commit();
      res.status(201).json({ message: "Registration successful", userId: newUserId });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
    // ─────────────────────────────────────────────────────────────────────

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});


module.exports = router;
