const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dbConfig = require('../dbConfig');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');

// ✅ DB Connect
const pool = require('../db.js');

const DEFAULT_SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const REMEMBER_ME_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const isDebugEnabled = ['true', '1', 'yes'].includes(String(process.env.DEBUG || '').toLowerCase());

const normalizeRoleValue = (rawValue = '') => {
  const value = String(rawValue || '').trim().toLowerCase();

  if (['admin', 'administrator'].includes(value)) {
    return { role: 'Admin', roleSlug: 'admin' };
  }

  if (value === 'trainer') {
    return { role: 'Trainer', roleSlug: 'trainer' };
  }

  if (['member', 'user'].includes(value)) {
    return { role: 'User', roleSlug: 'user' };
  }

  return { role: 'User', roleSlug: 'user' };
};

const resolveSessionRole = async (userId) => {
  if (!userId) {
    return { role: 'User', roleSlug: 'user' };
  }

  try {
    const [rows] = await pool.query(
      `SELECT LOWER(TRIM(r.slug)) AS roleSlug
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?
         AND r.is_active = 1
       ORDER BY CASE
         WHEN LOWER(TRIM(r.slug)) IN ('admin', 'administrator') THEN 1
         WHEN LOWER(TRIM(r.slug)) = 'trainer' THEN 2
         ELSE 3
       END
       LIMIT 1`,
      [userId]
    );

    if (rows?.length) {
      return normalizeRoleValue(rows[0].roleSlug);
    }
  } catch (rolesErr) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(rolesErr?.code)) {
      throw rolesErr;
    }
  }

  try {
    const [rows] = await pool.query(
      `SELECT LOWER(TRIM(user_role)) AS roleValue
       FROM user_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows?.length && rows[0]?.roleValue) {
      return normalizeRoleValue(rows[0].roleValue);
    }
  } catch (profileErr) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(profileErr?.code)) {
      throw profileErr;
    }
  }

  try {
    const [rows] = await pool.query(
      `SELECT LOWER(TRIM(membershipType)) AS roleValue
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows?.length && rows[0]?.roleValue) {
      return normalizeRoleValue(rows[0].roleValue);
    }
  } catch (userErr) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(userErr?.code)) {
      throw userErr;
    }
  }

  return { role: 'User', roleSlug: 'user' };
};

const hasAllRequiredCharClasses = (value = '') => {
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[!@#$%^&*()\-_=+{}[\]|:;,.?/~]/.test(value);
};

const generateTemporaryPassword = (length = 12) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const number = '23456789';
  const special = '!@#$%^&*()-_=+?';
  const all = upper + lower + number + special;

  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    number[Math.floor(Math.random() * number.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  while (required.length < length) {
    const idx = crypto.randomInt(0, all.length);
    required.push(all[idx]);
  }

  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join('');
};

const buildMailTransport = () => {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    throw new Error('nodemailer package is missing. Run npm install in backend first.');
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const sendResetPasswordEmail = async ({ to, temporaryPassword }) => {
  const transporter = buildMailTransport();
  if (!transporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const resetUrl = process.env.RESET_PASSWORD_URL || `${process.env.FRONTEND_URL || ''}/update-password`;

  await transporter.sendMail({
    from,
    to,
    subject: 'FlexFit Password Reset',
    text: `Your temporary password is: ${temporaryPassword}\n\nUse it to sign in, then update your password immediately.\n\nReset link: ${resetUrl}`,
    html: `
      <p>Your temporary password is:</p>
      <p><strong>${temporaryPassword}</strong></p>
      <p>Use it to sign in, then update your password immediately.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
    `,
  });
};

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

// Temporary public ping endpoint for login-page connectivity diagnostics.
router.get('/debug/ping', (req, res) => {
  return res.json({
    ok: true,
    message: 'Backend reachable',
    service: 'FlexFit Backend',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'unknown',
    origin: req.headers.origin || null,
  });
});

// POST /api/login
router.post('/login', async (req, res) => {
    try {
  const { username, password, rememberMe } = req.body;
    const identifier = sanitizeText(username, 100);
    console.log("Login attempt:", identifier);
    if (isDebugEnabled) {
      console.log('🧪 [auth/login] request diagnostics:', {
        origin: req.headers.origin || null,
        hasCookieHeader: Boolean(req.headers.cookie),
        rememberMe: Boolean(rememberMe),
      });
      res.on('finish', () => {
        const setCookieHeader = res.getHeader('Set-Cookie') || res.getHeader('set-cookie');
        console.log('🧪 [auth/login] response diagnostics:', {
          statusCode: res.statusCode,
          sessionId: req.sessionID || null,
          hasUserSession: Boolean(req.session?.user),
          setCookieHeaderPresent: Boolean(setCookieHeader),
        });
      });
    }
    if (!identifier || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      let rows = [];
      try {
        const [found] = await pool.query('SELECT * FROM users WHERE username = ? OR Email = ? LIMIT 1', [identifier, identifier]);
        rows = found;
      } catch (findErr) {
        if (findErr?.code === 'ER_BAD_FIELD_ERROR') {
          const [found] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [identifier]);
          rows = found;
        } else {
          throw findErr;
        }
      }
      
      if (rows.length === 0) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const user = rows[0];
      const isPendingReset = String(user.USER_PASSWORD_RESET || '').toUpperCase() === 'PENDING';
      const resetCode = user.USER_PASSWORD_RESET_CODE ? String(user.USER_PASSWORD_RESET_CODE) : '';

      let isMatch = false;
      if (isPendingReset) {
        // Pending reset sessions use the temporary reset code as the login secret.
        // This allows one-time use and keeps room for a future reset-expiry check.
        isMatch = Boolean(resetCode) && String(password) === resetCode;
      } else {
        isMatch = await bcrypt.compare(password, user.Password);
      }
      
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid password" });
      }

      if (isPendingReset) {
        // One-time reset token invalidation after successful authentication.
        await pool.query(
          `UPDATE users
           SET USER_PASSWORD_RESET_CODE = NULL
           WHERE id = ?`,
          [user.id]
        );
      }

      const roleContext = await resolveSessionRole(user.id);
      req.session.user = {
        id: user.id,
        username: user.username,
        mustResetPassword: isPendingReset,
        role: roleContext.role,
        roleSlug: roleContext.roleSlug,
      };
      req.session.mustResetPassword = isPendingReset;
      req.session.cookie.maxAge = rememberMe ? REMEMBER_ME_MAX_AGE_MS : DEFAULT_SESSION_MAX_AGE_MS;
      console.log("✅ Session created:", req.session.user);

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('❌ Session save error:', saveErr);
          return res.status(500).json({ error: 'Login succeeded, but session could not be persisted.' });
        }

        if (isDebugEnabled) {
          console.log('🧪 [auth/login] session persisted:', {
            sessionId: req.sessionID || null,
            cookie: {
              secure: Boolean(req.session?.cookie?.secure),
              sameSite: req.session?.cookie?.sameSite || null,
              httpOnly: Boolean(req.session?.cookie?.httpOnly),
              maxAge: req.session?.cookie?.maxAge ?? null,
            },
          });
        }

        return res.json({
          message: isPendingReset ? "Temporary password accepted. Password reset required." : "Login successful",
          user: req.session.user,
          requiresPasswordReset: isPendingReset,
          diagnostics: {
            loginSucceeded: true,
            sessionVerificationPassed: true,
          },
        });
      });
      
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
router.get('/session', async (req, res) => {
    const rawCookie = String(req.headers?.cookie || '');
    const hasSessionCookie = /connect\.sid=/.test(rawCookie);
    const hasUserSession = Boolean(req.session?.user);

    if (isDebugEnabled) {
      console.log('🧪 [auth/session] diagnostics:', {
        origin: req.headers.origin || null,
        hasSessionCookie,
        hasUserSession,
        sessionId: req.sessionID || null,
      });
    }

    if (req.session?.user) {
      try {
        if (!req.session.user.role || !req.session.user.roleSlug) {
          const roleContext = await resolveSessionRole(req.session.user.id);
          req.session.user.role = roleContext.role;
          req.session.user.roleSlug = roleContext.roleSlug;
        }
      } catch (roleErr) {
        console.error('⚠️ Failed to resolve session role:', roleErr?.message || roleErr);
      }

      return res.json({
        loggedIn: true,
        user: req.session.user,
        requiresPasswordReset: Boolean(req.session.mustResetPassword),
        diagnostics: {
          hasSessionCookie,
          loginSucceeded: true,
          sessionCookiePersisted: hasSessionCookie,
          sessionVerificationPassed: true,
        },
      });
    }
    res.json({
      loggedIn: false,
      diagnostics: {
        hasSessionCookie,
        loginSucceeded: false,
        sessionCookiePersisted: hasSessionCookie,
        sessionVerificationPassed: false,
        note: hasSessionCookie
          ? 'Session cookie exists, but no authenticated session payload was found.'
          : 'No session cookie was sent. Login may have succeeded, but the browser did not persist/send the cookie for follow-up requests (common in Safari/cloud-browser isolation).',
      },
    });
  });

// Forgot password - generate and email temporary password
router.post('/forgot-password', async (req, res) => {
  try {
    const rawIdentifier = req.body?.identifier;
    const identifier = sanitizeText(rawIdentifier, 100);

    if (!identifier) {
      return res.status(400).json({ error: 'Username or email is required.' });
    }

    let rows = [];
    try {
      const [found] = await pool.query('SELECT id, username FROM users WHERE username = ? OR Email = ? LIMIT 1', [identifier, identifier]);
      rows = found;
    } catch (findErr) {
      if (findErr?.code === 'ER_BAD_FIELD_ERROR') {
        const [found] = await pool.query('SELECT id, username FROM users WHERE username = ? LIMIT 1', [identifier]);
        rows = found;
      } else {
        throw findErr;
      }
    }
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = rows[0];
    const temporaryPassword = generateTemporaryPassword(12);
    const hashedTemporaryPassword = await bcrypt.hash(temporaryPassword, 10);

    try {
      await pool.query(
        `UPDATE users
         SET Password = ?, USER_PASSWORD_RESET = 'PENDING', USER_PASSWORD_RESET_CODE = ?
         WHERE id = ?`,
        [hashedTemporaryPassword, temporaryPassword, user.id]
      );
    } catch (dbErr) {
      if (dbErr?.code === 'ER_BAD_FIELD_ERROR') {
        return res.status(500).json({
          error: 'Password reset columns are missing. Add USER_PASSWORD_RESET and USER_PASSWORD_RESET_CODE to users table.',
        });
      }
      throw dbErr;
    }

    await sendResetPasswordEmail({
      to: user.username,
      temporaryPassword,
    });

    return res.json({ message: 'Temporary password sent successfully.' });
  } catch (err) {
    console.error('❌ Forgot password error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process password reset.' });
  }
});

// Complete password reset after logging in with temporary password
router.post('/reset-password/complete', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const mustReset = Boolean(req.session?.mustResetPassword);
    const { newPassword, confirmPassword } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: 'User not logged in.' });
    }

    if (!mustReset) {
      return res.status(403).json({ error: 'Password reset is not required for this session.' });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (String(newPassword).length < 8 || !hasAllRequiredCharClasses(String(newPassword))) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);

    await pool.query(
      `UPDATE users
       SET Password = ?, USER_PASSWORD_RESET = NULL, USER_PASSWORD_RESET_CODE = NULL
       WHERE id = ?`,
      [hashed, userId]
    );

    req.session.mustResetPassword = false;
    if (req.session.user) {
      req.session.user.mustResetPassword = false;
    }

    return res.json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('❌ Complete reset error:', err);
    return res.status(500).json({ error: 'Failed to complete password reset.' });
  }
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

    if (req.session?.user) {
      req.session.user.role = 'Admin';
      req.session.user.roleSlug = 'admin';
    }

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

router.get('/register-tiers', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, slug, price_monthly, price_yearly FROM membership_tiers WHERE is_active = 1 ORDER BY id'
    );
    return res.json(rows);
  } catch (err) {
    console.error('❌ Register tiers lookup failed:', err);
    return res.status(500).json({ error: 'Failed to fetch registration tiers.' });
  }
});




//Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, username, password, membershipType, subscriptionTierId } = req.body;

    if (!firstName || !username || !password) {
      return res.status(400).json({ error: "First name, email, and password are required" });
    }

    // Validate membershipType — default to 'User' if not provided
    const ALLOWED_TYPES = ['User', 'Trainer', 'Admin'];
    const safeType = ALLOWED_TYPES.includes(membershipType) ? membershipType : 'User';

    const safeSubscriptionTierId = Number.parseInt(subscriptionTierId, 10);
    if (!Number.isInteger(safeSubscriptionTierId) || safeSubscriptionTierId <= 0) {
      return res.status(400).json({ error: 'A valid subscription type is required.' });
    }

    // Map membershipType → role slug, tier, billing cycle
    const TYPE_MAP = {
      User:    { roleSlug: 'member' },
      Trainer: { roleSlug: 'trainer' },
      Admin:   { roleSlug: 'admin' },
    };
    const typeConfig = TYPE_MAP[safeType];

    const safeFirst = sanitizeText(firstName, 100);
    const safeLast = sanitizeText(lastName, 100) || '';
    const safeUser = sanitizeText(username, 100);
    const hashedPassword = await bcrypt.hash(password, 10);

    const [existingUser] = await pool.query("SELECT * FROM users WHERE username = ?", [safeUser]);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const [tierRows] = await pool.query(
      'SELECT id, name, slug, price_monthly, price_yearly FROM membership_tiers WHERE id = ? AND is_active = 1 LIMIT 1',
      [safeSubscriptionTierId]
    );

    const selectedTier = tierRows?.[0];
    if (!selectedTier) {
      return res.status(400).json({ error: 'Selected subscription type is invalid.' });
    }

    const billingCycle = Number(selectedTier.price_monthly || 0) > 0 ? 'monthly' : 'none';

    // ── wrap all inserts in a transaction ────────────────────────────────
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Create the core user row (with membershipType column)
      const [userResult] = await conn.query(
        "INSERT INTO users (FirstName, LastName, username, Password, membershipType) VALUES (?, ?, ?, ?, ?)",
        [safeFirst, safeLast, safeUser, hashedPassword, safeType]
      );
      const newUserId = userResult.insertId;

      // 2. Create profile
      await conn.query(
        `INSERT INTO user_profiles (user_id, user_role, tier, settings)
         VALUES (?, ?, ?, '[]')`,
        [newUserId, typeConfig.roleSlug, selectedTier.id]
      );

      // 3. Create membership
      await conn.query(
        `INSERT INTO user_memberships (user_id, tier_id, status, billing_cycle, started_at)
         VALUES (?, ?, 'active', ?, CURDATE())`,
        [newUserId, selectedTier.id, billingCycle]
      );

      // 4. Assign role via user_roles pivot (graceful fallback if slug doesn't exist)
      await conn.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by)
         SELECT ?, id, ? FROM roles WHERE slug = ? LIMIT 1`,
        [newUserId, newUserId, typeConfig.roleSlug]
      );

      await conn.commit();
      res.status(201).json({
        message: "Registration successful",
        userId: newUserId,
        membershipType: safeType,
        subscriptionTier: selectedTier.name,
      });
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
