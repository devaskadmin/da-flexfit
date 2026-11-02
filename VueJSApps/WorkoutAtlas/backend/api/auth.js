const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dbConfig = require('../dbConfig');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');
const {
  verifyGoogleIdToken,
  GoogleTokenVerificationError,
} = require('../services/googleIdTokenVerificationService');

// ✅ DB Connect
const pool = require('../db.js');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const isDebugEnabled = ['true', '1', 'yes'].includes(String(process.env.DEBUG || process.env.VITE_DEBUG || '').toLowerCase());
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_COOKIE_SECURE = isProduction;
const SESSION_COOKIE_SAMESITE = isProduction ? 'none' : 'lax';
const CLIENT_ORIGIN = String(process.env.CLIENT_ORIGIN || '').trim();
const FRONTEND_URL = String(process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || '').trim();
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || '').trim();
const DEFAULT_FRONTEND_ORIGINS = [
  'https://workoutatlas.com',
  'https://www.workoutatlas.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];
const TRUSTED_AUTH_ORIGINS = new Set(
  [...DEFAULT_FRONTEND_ORIGINS, CLIENT_ORIGIN, FRONTEND_URL]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
);
const AUTH_RATE_LIMIT_MESSAGE = 'Too many authentication attempts. Please try again later.';
const authRateLimitStore = new Map();
const GOOGLE_TEST_UNLINK_USER_ID_RAW = String(process.env.GOOGLE_TEST_UNLINK_USER_ID || '').trim();
const GOOGLE_TEST_UNLINK_USERNAME = String(process.env.GOOGLE_TEST_UNLINK_USERNAME || '').trim().toLowerCase();
const GOOGLE_TEST_UNLINK_EMAIL = String(process.env.GOOGLE_TEST_UNLINK_EMAIL || '').trim().toLowerCase();

const clearSessionCookies = (res) => {
  const baseCookieOptions = {
    path: '/',
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
  };

  // Clear current session cookie regardless of whether it was set host-only or with domain.
  res.clearCookie('flexfit.sid', baseCookieOptions);
  if (COOKIE_DOMAIN) {
    res.clearCookie('flexfit.sid', {
      ...baseCookieOptions,
      domain: COOKIE_DOMAIN,
    });
  }

  // Clear legacy/default express-session cookie name as a defensive cleanup.
  res.clearCookie('connect.sid', baseCookieOptions);
  if (COOKIE_DOMAIN) {
    res.clearCookie('connect.sid', {
      ...baseCookieOptions,
      domain: COOKIE_DOMAIN,
    });
  }
};

const normalizeRoleValue = (rawValue = '') => {
  const value = String(rawValue || '').trim().toLowerCase();

  if (['admin', 'administrator'].includes(value)) {
    return { role: 'administrator', roleSlug: 'administrator' };
  }

  if (value === 'trainer') {
    return { role: 'trainer', roleSlug: 'trainer' };
  }

  return { role: 'user', roleSlug: 'user' };
};

const resolveSessionRole = async (userId) => {
  if (!userId) {
    return { role: 'user', roleSlug: 'user' };
  }

  const [rows] = await pool.query(
    `SELECT
       LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) AS roleValue
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?
       AND r.is_active = 1
     ORDER BY CASE
       WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN ('admin', 'administrator') THEN 1
       WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) = 'trainer' THEN 2
       ELSE 3
     END,
     ur.assigned_at DESC,
     ur.id DESC
     LIMIT 1`,
    [userId]
  );

  if (rows?.length && rows[0]?.roleValue) {
    return normalizeRoleValue(rows[0].roleValue);
  }

  return { role: 'user', roleSlug: 'user' };
};

const saveSessionAsync = (req) => {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        return reject(err);
      }
      return resolve();
    });
  });
};

const regenerateSessionAsync = (req) => {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });
};

const establishAuthenticatedSession = async (req, user, options = {}) => {
  const mustResetPassword = Boolean(options.mustResetPassword);
  const roleContext = await resolveSessionRole(user.id);
  const avatarPath = user.avatarPath || '/images/avatar/default.png';
  const avatarName = user.avatarName || 'default.png';
  const registrationIncomplete = isRegistrationIncompleteUser(user);

  await regenerateSessionAsync(req);

  req.session.user = {
    id: user.id,
    username: user.username,
    mustResetPassword,
    registrationIncomplete,
    role: roleContext.role,
    roleSlug: roleContext.roleSlug,
    avatarPath,
    avatarName,
  };
  req.session.userID = user.id;
  req.session.username = user.username;
  req.session.mustResetPassword = mustResetPassword;
  req.session.registrationIncomplete = registrationIncomplete;
  req.session.cookie.maxAge = THIRTY_DAYS_MS;

  await saveSessionAsync(req);
};

const normalizeExternalIdentity = (user = {}) => {
  return {
    provider: String(user.external_auth_provider || '').trim().toLowerCase(),
    subject: String(user.external_auth_subject || '').trim(),
    enabled: Number(user.external_auth || 0) === 1,
  };
};

const isRegistrationIncompleteUser = (user = {}) => {
  const isExternalAuth = Number(user.external_auth || 0) === 1;
  const membershipType = user.membershipType;

  if (!isExternalAuth) {
    return false;
  }

  if (membershipType === null || typeof membershipType === 'undefined') {
    return true;
  }

  return String(membershipType).trim().length === 0;
};

const ALLOWED_MEMBERSHIP_TYPES = ['User', 'Trainer', 'Admin'];
const ALLOWED_SELF_SERVICE_MEMBERSHIP_TYPES = ['User', 'Trainer'];
const ALLOWED_EXTERNAL_REGISTRATION_TYPES = ['User', 'Trainer'];
const REGISTRATION_TYPE_MAP = {
  User: { roleSlug: 'member' },
  Trainer: { roleSlug: 'trainer' },
  Admin: { roleSlug: 'admin' },
};

const normalizeTierValue = (value = '') => String(value || '').trim().toLowerCase();

const isTierValidForMembershipType = (membershipType, tier = {}) => {
  const type = String(membershipType || '').trim();
  const tierKey = normalizeTierValue(tier.slug || tier.name || '');

  if (!tierKey) {
    return false;
  }

  if (type === 'Trainer') {
    return ['trainer', 'elite'].includes(tierKey);
  }

  return ['free', 'pro'].includes(tierKey);
};

const extractRequestOrigin = (req) => {
  const origin = String(req.headers.origin || '').trim();
  if (origin) {
    return origin;
  }

  const referer = String(req.headers.referer || '').trim();
  if (!referer) {
    return '';
  }

  try {
    return new URL(referer).origin;
  } catch (_err) {
    return '';
  }
};

const requireTrustedAuthOrigin = (req, res, next) => {
  const requestOrigin = extractRequestOrigin(req);

  if (!requestOrigin) {
    return next();
  }

  if (TRUSTED_AUTH_ORIGINS.has(requestOrigin)) {
    return next();
  }

  return res.status(403).json({ error: 'Request origin not allowed.' });
};

const createAuthRateLimiter = ({ key, windowMs, maxAttempts }) => {
  return (req, res, next) => {
    const bucketKey = `${key}:${String(req.ip || 'unknown').trim()}`;
    const now = Date.now();
    const record = authRateLimitStore.get(bucketKey);

    if (!record || record.resetAt <= now) {
      authRateLimitStore.set(bucketKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: AUTH_RATE_LIMIT_MESSAGE });
    }

    record.count += 1;
    authRateLimitStore.set(bucketKey, record);
    return next();
  };
};

const loginRateLimiter = createAuthRateLimiter({
  key: 'login',
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
});

const googleAuthRateLimiter = createAuthRateLimiter({
  key: 'google-auth',
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
});

const googleTestUnlinkRateLimiter = createAuthRateLimiter({
  key: 'google-test-unlink',
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
});

const forgotPasswordRateLimiter = createAuthRateLimiter({
  key: 'forgot-password',
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
});

const resetPasswordRateLimiter = createAuthRateLimiter({
  key: 'reset-password-complete',
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
});

const logAuthSecurityEvent = (eventName, metadata = {}, level = 'info') => {
  const logger = typeof console[level] === 'function' ? console[level] : console.log;
  logger(`[AUTH_SECURITY] ${eventName}`, {
    ip: String(metadata.ip || '').trim() || undefined,
    origin: String(metadata.origin || '').trim() || undefined,
    userId: Number(metadata.userId || 0) || undefined,
    reason: String(metadata.reason || '').trim() || undefined,
    provider: String(metadata.provider || '').trim() || undefined,
  });
};

const isGoogleTestUnlinkEnabled = () => {
  if (isProduction) {
    return false;
  }

  return Boolean(GOOGLE_TEST_UNLINK_USER_ID_RAW || GOOGLE_TEST_UNLINK_USERNAME || GOOGLE_TEST_UNLINK_EMAIL);
};

const resolveConfiguredGoogleTestUser = async () => {
  if (!isGoogleTestUnlinkEnabled()) {
    return { user: null, reason: 'disabled' };
  }

  const parsedId = Number.parseInt(GOOGLE_TEST_UNLINK_USER_ID_RAW, 10);
  const hasValidId = Number.isInteger(parsedId) && parsedId > 0;
  const hasUserIdentifier = Boolean(GOOGLE_TEST_UNLINK_USERNAME || GOOGLE_TEST_UNLINK_EMAIL);

  if (!hasValidId && !hasUserIdentifier) {
    return { user: null, reason: 'misconfigured' };
  }

  let usersById = [];
  if (hasValidId) {
    const [rows] = await pool.query(
      `SELECT id, username, Password, external_auth, external_auth_provider,
              external_auth_subject, external_auth_linked_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [parsedId]
    );
    usersById = rows;
  }

  let usersByIdentifier = [];
  if (hasUserIdentifier) {
    const byUsernameOrEmail = GOOGLE_TEST_UNLINK_USERNAME || GOOGLE_TEST_UNLINK_EMAIL;
    const byEmailOrUsername = GOOGLE_TEST_UNLINK_EMAIL || GOOGLE_TEST_UNLINK_USERNAME;

    try {
      const [rows] = await pool.query(
        `SELECT id, username, Email, Password, external_auth, external_auth_provider,
                external_auth_subject, external_auth_linked_at
         FROM users
         WHERE LOWER(username) = ?
            OR LOWER(COALESCE(Email, '')) = ?
         LIMIT 1`,
        [byUsernameOrEmail, byEmailOrUsername]
      );
      usersByIdentifier = rows;
    } catch (findErr) {
      if (findErr?.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await pool.query(
          `SELECT id, username, Password, external_auth, external_auth_provider,
                  external_auth_subject, external_auth_linked_at
           FROM users
           WHERE LOWER(username) = ?
           LIMIT 1`,
          [byUsernameOrEmail]
        );
        usersByIdentifier = rows;
      } else {
        throw findErr;
      }
    }
  }

  const userFromId = usersById[0] || null;
  const userFromIdentifier = usersByIdentifier[0] || null;

  if (userFromId && userFromIdentifier && Number(userFromId.id) !== Number(userFromIdentifier.id)) {
    return { user: null, reason: 'mismatch' };
  }

  const resolvedUser = userFromId || userFromIdentifier;
  if (!resolvedUser) {
    return { user: null, reason: 'not-found' };
  }

  return { user: resolvedUser, reason: 'ok' };
};

const FORGOT_PASSWORD_RESPONSE_MESSAGE = 'If an account matches that username or email, a temporary password will be sent.';

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
  const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || 'https://workoutatlas.com';
  const resetUrl = process.env.RESET_PASSWORD_URL || `${frontendUrl}/update-password`;

  await transporter.sendMail({
    from,
    to,
    subject: 'WorkoutAtlas Password Reset',
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
    const isDebugEnabled = ['true', '1', 'yes'].includes(String(process.env.DEBUG || process.env.VITE_DEBUG || '').toLowerCase());

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
    service: 'WorkoutAtlas Backend',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'unknown',
    origin: req.headers.origin || null,
  });
});

// GET /api/debug/login-diagnostics
// Returns safe server diagnostics when DEBUG=true; contact-admin fallback otherwise.
// NEVER exposes passwords, secrets, tokens, or connection strings.
const debugEnabled = String(process.env.DEBUG || '').toLowerCase() === 'true';

router.get('/debug/login-diagnostics', (req, res) => {
  if (!debugEnabled) {
    return res.json({
      enabled: false,
      message: 'Contact administrator for details.',
    });
  }

  return res.json({
    enabled: true,
    environment: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      debug: process.env.DEBUG || 'false',
      clientOrigin: CLIENT_ORIGIN || null,
      apiBaseUrl: process.env.API_BASE_URL || null,
      cookieDomain: process.env.COOKIE_DOMAIN || null,
      corsConfigured: !!CLIENT_ORIGIN,
      sessionCookieSecure: SESSION_COOKIE_SECURE,
      sessionCookieSameSite: SESSION_COOKIE_SAMESITE,
    },
    database: {
      hostConfigured: !!process.env.DB_HOST,
      databaseConfigured: !!process.env.DB_DATABASE,
      userConfigured: !!process.env.DB_USER,
      port: process.env.DB_PORT || '3306 (default)',
    },
    server: {
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      platform: process.platform,
    },
  });
});

// POST /api/auth/google/verify
// Google-auth foundation endpoint only: verifies ID token cryptographically
// and claim integrity. No account creation/linking/session issuance occurs here.
router.post('/auth/google', requireTrustedAuthOrigin, googleAuthRateLimiter, async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const credential = String(body.credential || body.idToken || '').trim();
  const confirmLink = body.confirmLink === true;
  const linkPassword = String(body.linkPassword || '');

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required.' });
  }

  let googleProfile;
  try {
    googleProfile = await verifyGoogleIdToken(credential);
  } catch (err) {
    if (err instanceof GoogleTokenVerificationError) {
      if (err.statusCode === 400) {
        return res.status(400).json({ error: 'Google credential is required.' });
      }

      if (err.statusCode === 503) {
        logAuthSecurityEvent('GOOGLE_AUTH_CONFIG_ERROR', {
          ip: req.ip,
          origin: req.headers.origin,
          provider: 'google',
        }, 'error');
        return res.status(503).json({
          error: 'Google authentication is not configured. Set GOOGLE_CLIENT_ID to enable this endpoint.',
        });
      }

      logAuthSecurityEvent('GOOGLE_AUTH_INVALID_TOKEN', {
        ip: req.ip,
        origin: req.headers.origin,
        provider: 'google',
      }, 'warn');
      return res.status(401).json({ error: 'Invalid Google credential.' });
    }

    console.error('❌ Google authentication error:', err?.message || err);
    return res.status(500).json({ error: 'Google authentication failed.' });
  }

  const provider = 'google';
  const externalSubject = googleProfile.sub;
  const verifiedEmail = String(googleProfile.email || '').trim().toLowerCase();
  const givenName = sanitizeText(googleProfile.given_name || '', 100) || 'Google';
  const familyName = sanitizeText(googleProfile.family_name || '', 100) || '';

  if (!verifiedEmail) {
    return res.status(400).json({ error: 'Google account does not include a verified email.' });
  }

  try {
    const [linkedRows] = await pool.query(
      `SELECT *
       FROM users
       WHERE external_auth_provider = ? AND external_auth_subject = ?
       LIMIT 1`,
      [provider, externalSubject]
    );

    if (linkedRows.length > 0) {
      const linkedUser = linkedRows[0];
      await establishAuthenticatedSession(req, linkedUser, { mustResetPassword: false });
      logAuthSecurityEvent('GOOGLE_AUTH_SUCCESS', {
        ip: req.ip,
        origin: req.headers.origin,
        userId: linkedUser.id,
        provider: 'google',
      });

      return res.json({
        message: 'Login successful',
        user: req.session.user,
        requiresPasswordReset: false,
      });
    }

    let emailMatchRows = [];
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE username = ? OR Email = ? LIMIT 1',
        [verifiedEmail, verifiedEmail]
      );
      emailMatchRows = rows;
    } catch (findErr) {
      if (findErr?.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await pool.query(
          'SELECT * FROM users WHERE username = ? LIMIT 1',
          [verifiedEmail]
        );
        emailMatchRows = rows;
      } else {
        throw findErr;
      }
    }

    if (emailMatchRows.length > 0) {
      const existingUser = emailMatchRows[0];
      const existingIdentity = normalizeExternalIdentity(existingUser);

      if (existingIdentity.provider || existingIdentity.subject || existingIdentity.enabled) {
        const isSameGoogleIdentity = existingIdentity.provider === provider && existingIdentity.subject === externalSubject;

        if (!isSameGoogleIdentity) {
          logAuthSecurityEvent('GOOGLE_AUTH_DUPLICATE_IDENTITY_BLOCKED', {
            ip: req.ip,
            origin: req.headers.origin,
            userId: existingUser.id,
            provider: 'google',
            reason: 'existing-external-identity',
          }, 'warn');
          return res.status(409).json({ error: 'Google account cannot be linked automatically.' });
        }
      } else if (!confirmLink) {
        return res.status(409).json({
          error: 'An account with this email already exists. Confirm linking to continue.',
          code: 'GOOGLE_LINK_CONFIRM_REQUIRED',
          linkRequired: true,
          email: verifiedEmail,
        });
      } else {
        const storedPasswordHash = existingUser.Password ? String(existingUser.Password) : '';

        if (!storedPasswordHash) {
          return res.status(409).json({
            error: 'This account cannot be linked with password confirmation because no local password is set.',
            code: 'GOOGLE_LINK_PASSWORD_UNAVAILABLE',
          });
        }

        const passwordMatches = await bcrypt.compare(linkPassword, storedPasswordHash);
        if (!passwordMatches) {
          return res.status(401).json({
            error: 'Invalid WorkoutAtlas credentials for account linking.',
            code: 'GOOGLE_LINK_PASSWORD_INVALID',
          });
        }
      }

      try {
        await pool.query(
          `UPDATE users
           SET external_auth = 1,
               external_auth_provider = ?,
               external_auth_subject = ?,
               external_auth_linked_at = NOW()
           WHERE id = ?`,
          [provider, externalSubject, existingUser.id]
        );
      } catch (updateErr) {
        if (updateErr?.code === 'ER_DUP_ENTRY') {
          logAuthSecurityEvent('GOOGLE_AUTH_DUPLICATE_IDENTITY_BLOCKED', {
            ip: req.ip,
            origin: req.headers.origin,
            userId: existingUser.id,
            provider: 'google',
            reason: 'duplicate-external-identity',
          }, 'warn');
          return res.status(409).json({ error: 'This Google account is already linked to another user.' });
        }
        throw updateErr;
      }

      const [updatedRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [existingUser.id]);
      const linkedUser = updatedRows[0] || existingUser;
      await establishAuthenticatedSession(req, linkedUser, { mustResetPassword: false });
      logAuthSecurityEvent('GOOGLE_AUTH_LINKED', {
        ip: req.ip,
        origin: req.headers.origin,
        userId: linkedUser.id,
        provider: 'google',
      });
      logAuthSecurityEvent('GOOGLE_AUTH_SUCCESS', {
        ip: req.ip,
        origin: req.headers.origin,
        userId: linkedUser.id,
        provider: 'google',
      });

      return res.json({
        message: 'Login successful',
        user: req.session.user,
        requiresPasswordReset: false,
      });
    }

    let insertResult;
    try {
      const [created] = await pool.query(
        `INSERT INTO users
         (FirstName, LastName, username, Email, Password, membershipType, external_auth, external_auth_provider, external_auth_subject, external_auth_linked_at)
         VALUES (?, ?, ?, ?, NULL, NULL, 1, ?, ?, NOW())`,
        [givenName, familyName, verifiedEmail, verifiedEmail, provider, externalSubject]
      );
      insertResult = created;
    } catch (insertErr) {
      if (insertErr?.code === 'ER_BAD_FIELD_ERROR') {
        const [created] = await pool.query(
          `INSERT INTO users
           (FirstName, LastName, username, Password, membershipType, external_auth, external_auth_provider, external_auth_subject, external_auth_linked_at)
           VALUES (?, ?, ?, NULL, NULL, 1, ?, ?, NOW())`,
          [givenName, familyName, verifiedEmail, provider, externalSubject]
        );
        insertResult = created;
      } else {
        throw insertErr;
      }
    }

    const newUserId = insertResult.insertId;
    const [newRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [newUserId]);
    const newUser = newRows[0];

    await establishAuthenticatedSession(req, newUser, { mustResetPassword: false });
    logAuthSecurityEvent('GOOGLE_AUTH_ACCOUNT_CREATED', {
      ip: req.ip,
      origin: req.headers.origin,
      userId: newUserId,
      provider: 'google',
    });
    logAuthSecurityEvent('GOOGLE_AUTH_SUCCESS', {
      ip: req.ip,
      origin: req.headers.origin,
      userId: newUserId,
      provider: 'google',
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: req.session.user,
      requiresPasswordReset: false,
    });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      logAuthSecurityEvent('GOOGLE_AUTH_DUPLICATE_IDENTITY_BLOCKED', {
        ip: req.ip,
        origin: req.headers.origin,
        provider: 'google',
        reason: 'duplicate-identity-on-create',
      }, 'warn');
      return res.status(409).json({ error: 'This Google account is already linked to another user.' });
    }

    console.error('❌ Google auth route failure:', err?.message || err);
    return res.status(500).json({ error: 'Google authentication failed.' });
  }
});

router.post('/auth/google/test-unlink', requireTrustedAuthOrigin, googleTestUnlinkRateLimiter, async (req, res) => {
  if (!isGoogleTestUnlinkEnabled()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const resolved = await resolveConfiguredGoogleTestUser();
    if (!resolved.user) {
      if (resolved.reason === 'misconfigured') {
        return res.status(503).json({ error: 'Google test unlink is not configured.' });
      }

      if (resolved.reason === 'mismatch') {
        return res.status(409).json({ error: 'Google test unlink user configuration mismatch.' });
      }

      if (resolved.reason === 'not-found') {
        return res.status(404).json({ error: 'Configured Google test user not found.' });
      }

      return res.status(404).json({ error: 'Not found.' });
    }

    const targetUser = resolved.user;

    await pool.query(
      `UPDATE users
       SET external_auth = 0,
           external_auth_provider = NULL,
           external_auth_subject = NULL,
           external_auth_linked_at = NULL
       WHERE id = ?`,
      [targetUser.id]
    );

    const [rows] = await pool.query(
      `SELECT id, username, external_auth, external_auth_provider,
              external_auth_subject, external_auth_linked_at, Password
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [targetUser.id]
    );

    const updatedUser = rows[0];
    if (!updatedUser) {
      return res.status(404).json({ error: 'Configured Google test user not found.' });
    }

    const unlinkSuccessful =
      Number(updatedUser.external_auth || 0) === 0 &&
      !updatedUser.external_auth_provider &&
      !updatedUser.external_auth_subject &&
      !updatedUser.external_auth_linked_at;

    logAuthSecurityEvent('GOOGLE_TEST_USER_UNLINKED', {
      ip: req.ip,
      origin: req.headers.origin,
      userId: updatedUser.id,
      provider: 'google',
      reason: unlinkSuccessful ? 'cleared' : 'partial-clear',
    });

    return res.json({
      success: unlinkSuccessful,
      message: unlinkSuccessful
        ? 'Google test user unlinked successfully.'
        : 'Google test user unlink completed with verification warnings.',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        externalAuthLinked: Number(updatedUser.external_auth || 0) === 1,
        hasPassword: Boolean(updatedUser.Password),
      },
      clearedFields: {
        external_auth: Number(updatedUser.external_auth || 0) === 0,
        external_auth_provider: !updatedUser.external_auth_provider,
        external_auth_subject: !updatedUser.external_auth_subject,
        external_auth_linked_at: !updatedUser.external_auth_linked_at,
      },
    });
  } catch (err) {
    console.error('❌ Google test unlink failure:', err?.message || err);
    return res.status(500).json({ error: 'Google test unlink failed.' });
  }
});

// POST /api/login
router.post('/login', requireTrustedAuthOrigin, loginRateLimiter, async (req, res) => {
    try {
  const { username, password, rememberMe } = req.body;
    const identifier = sanitizeText(username, 100);
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
        return res.status(401).json({ error: 'Invalid username or password.' });
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
        const storedPasswordHash = user.Password ? String(user.Password) : '';
        // External-auth-only users can legitimately have no password hash.
        isMatch = storedPasswordHash ? await bcrypt.compare(password, storedPasswordHash) : false;
      }
      
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid username or password.' });
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

      await establishAuthenticatedSession(req, user, { mustResetPassword: isPendingReset });

      const setCookieHeader = res.getHeader('Set-Cookie');

      if (isDebugEnabled) {
        console.log('🧪 [auth/login] session persisted:', {
          setCookieHeaderPresent: Boolean(setCookieHeader),
          cookie: {
            secure: Boolean(req.session?.cookie?.secure),
            sameSite: req.session?.cookie?.sameSite || null,
            httpOnly: Boolean(req.session?.cookie?.httpOnly),
            maxAge: req.session?.cookie?.maxAge ?? null,
          },
        });
      }

      return res.json({
        message: isPendingReset ? 'Temporary password accepted. Password reset required.' : 'Login successful',
        user: req.session.user,
        requiresPasswordReset: isPendingReset,
        diagnostics: {
          success: true,
          setCookieHeaderPresent: Boolean(setCookieHeader),
          loginSucceeded: true,
          sessionVerificationPassed: true,
          cookieDetected: Boolean(req.headers.cookie),
          cookieSentBack: true,
          corsPassed: Boolean(req.headers.origin),
          cookieConfig: {
            secure: req.session.cookie.secure,
            sameSite: req.session.cookie.sameSite,
            httpOnly: req.session.cookie.httpOnly,
            path: req.session.cookie.path,
            expires: req.session.cookie.expires,
          },
        },
      });
      
    } catch (err) {
        console.error("❌ Login error:", err?.message || err);
        const errCode = err?.code || '';
        if (errCode === 'ER_ACCESS_DENIED_ERROR') {
          return res.status(503).json({
            error: 'Sign-in is temporarily unavailable.',
          });
        }
        if (errCode === 'ECONNREFUSED') {
          return res.status(503).json({
            error: 'Sign-in is temporarily unavailable.',
          });
        }
        if (['ETIMEDOUT', 'ECONNRESET'].includes(errCode)) {
          return res.status(503).json({
            error: 'Sign-in is temporarily unavailable.',
          });
        }
        res.status(500).json({ error: 'Sign-in failed.' });
        }
});


//Logout
router.post('/logout', requireTrustedAuthOrigin, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: 'Logout failed.' });
      clearSessionCookies(res);
      res.json({ message: "Logged out successfully" });
    });
  });

//Get Session
router.get('/session', async (req, res) => {
    const rawCookie = String(req.headers?.cookie || '');
    const hasSessionCookie = /flexfit\.sid=/.test(rawCookie);
    const cookieSentBack = Boolean(req.headers.cookie);
    const hasUserSession = Boolean(req.session?.user);

    // Compute cookie config for diagnostics
    const secureFlag = SESSION_COOKIE_SECURE;
    const sameSiteValue = SESSION_COOKIE_SAMESITE;
    const corsPassed = Boolean(req.headers.origin);

    if (isDebugEnabled) {
      console.log('🧪 [auth/session] diagnostics:', {
        origin: req.headers.origin || null,
        hasSessionCookie,
        cookieSentBack,
        hasUserSession,
        secureFlag,
        sameSiteValue,
      });
    }

    if (req.session?.user) {
      let registrationIncomplete = Boolean(req.session.registrationIncomplete);

      try {
        const roleContext = await resolveSessionRole(req.session.user.id);
        req.session.user.role = roleContext.role;
        req.session.user.roleSlug = roleContext.roleSlug;

        const [userRows] = await pool.query(
          'SELECT avatarPath, avatarName, external_auth, membershipType FROM users WHERE id = ? LIMIT 1',
          [req.session.user.id]
        );
        const user = userRows?.[0] || {};

        // Fetch user avatar data if not in session
        if (!req.session.user.avatarPath || !req.session.user.avatarName) {
          req.session.user.avatarPath = user?.avatarPath || '/images/avatar/default.png';
          req.session.user.avatarName = user?.avatarName || 'default.png';
        }

        registrationIncomplete = isRegistrationIncompleteUser(user);
        req.session.user.registrationIncomplete = registrationIncomplete;
        req.session.registrationIncomplete = registrationIncomplete;
      } catch (roleErr) {
        console.error('⚠️ Failed to resolve session role:', roleErr?.message || roleErr);
      }

      return res.json({
        loggedIn: true,
        user: req.session.user,
        requiresPasswordReset: Boolean(req.session.mustResetPassword),
        registrationIncomplete,
        diagnostics: {
          cookieDetected: hasSessionCookie,
          cookieSentBack,
          corsPassed,
          sameSiteValue,
          secureFlag,
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
        cookieDetected: hasSessionCookie,
        cookieSentBack,
        corsPassed,
        sameSiteValue,
        secureFlag,
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

// GET /api/session/check
// Dedicated auth/session verification endpoint used right after login.
router.get('/session/check', (req, res) => {
  const rawCookie = String(req.headers?.cookie || '');
  const hasSessionCookie = /flexfit\.sid=/.test(rawCookie);
  const origin = req.headers.origin || null;
  const corsAllowed = !origin || (CLIENT_ORIGIN ? origin === CLIENT_ORIGIN : true);
  const sessionExists = Boolean(req.session);
  const userID = req.session?.userID || null;
  const username = req.session?.username || null;
  const authenticated = Boolean(req.session?.user?.id || req.session?.userID);

  const safeSessionUser = req.session?.user
    ? {
        id: req.session.user.id,
        username: req.session.user.username,
        role: req.session.user.role,
        registrationIncomplete: Boolean(req.session.user.registrationIncomplete || req.session.registrationIncomplete),
      }
    : null;

  console.log('[session/check]', {
    authenticated,
    cookieHeaderPresent: Boolean(req.headers.cookie),
    hasSessionCookie,
    userID,
  });

  if (isDebugEnabled) {
    console.log('FlexFit Session Diagnostics', {
      cookiePresent: hasSessionCookie,
      sameSiteValue: SESSION_COOKIE_SAMESITE,
      secureFlag: SESSION_COOKIE_SECURE,
      origin,
      corsResult: corsAllowed,
      renderProxyStatus: req.app?.get('trust proxy'),
    });
  }

  return res.json({
    authenticated,
    registrationIncomplete: Boolean(req.session?.user?.registrationIncomplete || req.session?.registrationIncomplete),
    userID,
    username,
    cookiePresent: hasSessionCookie,
    cookieHeaderPresent: Boolean(req.headers.cookie),
    cookieHeaderPreview: req.headers.cookie ? 'present' : 'missing',
    sessionExists,
    sessionUser: safeSessionUser,
    diagnostics: {
      cookiePresent: hasSessionCookie,
      sameSiteValue: SESSION_COOKIE_SAMESITE,
      secureFlag: SESSION_COOKIE_SECURE,
      origin,
      corsResult: corsAllowed,
      renderProxyStatus: req.app?.get('trust proxy'),
    },
  });
});

// Forgot password - generate and email temporary password
router.post('/forgot-password', requireTrustedAuthOrigin, forgotPasswordRateLimiter, async (req, res) => {
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
      return res.json({ message: FORGOT_PASSWORD_RESPONSE_MESSAGE });
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
        throw new Error('Password reset is temporarily unavailable.');
      }
      throw dbErr;
    }

    await sendResetPasswordEmail({
      to: user.username,
      temporaryPassword,
    });

    return res.json({ message: FORGOT_PASSWORD_RESPONSE_MESSAGE });
  } catch (err) {
    console.error('❌ Forgot password error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to process password reset.' });
  }
});

// Complete password reset after logging in with temporary password
router.post('/reset-password/complete', requireTrustedAuthOrigin, resetPasswordRateLimiter, async (req, res) => {
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
router.post('/bootstrap/promote-self-admin', requireTrustedAuthOrigin, async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'User not logged in' });
  }

  const debugNoAuth = String(process.env.DEBUG_NO_AUTH || '').toLowerCase();
  const debugFlag = String(process.env.DEBUG || process.env.VITE_DEBUG || '').toLowerCase();
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
      req.session.user.role = 'administrator';
      req.session.user.roleSlug = 'administrator';
    }

    return res.json({
      message: 'User promoted to admin successfully.',
      userId,
      role: 'administrator',
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

// GET /api/auth/session-test — lightweight session probe for diagnostics modal.
// Returns session state without touching the DB.
router.get('/auth/session-test', (req, res) => {
  return res.json({
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    user: req.session?.user
      ? {
          id: req.session.user.id,
          username: req.session.user.username,
          role: req.session.user.role,
        }
      : null,
    cookie: {
      secure: Boolean(req.session?.cookie?.secure),
      sameSite: req.session?.cookie?.sameSite || null,
      httpOnly: Boolean(req.session?.cookie?.httpOnly),
    },
    timestamp: new Date().toISOString(),
  });
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

router.post('/ext-register/complete', requireTrustedAuthOrigin, async (req, res) => {
  const sessionUserId = Number(req.session?.user?.id || req.session?.userID || 0);
  if (!sessionUserId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { membershipType, subscriptionTierId } = req.body || {};
  const safeType = ALLOWED_EXTERNAL_REGISTRATION_TYPES.includes(membershipType) ? membershipType : null;
  if (!safeType) {
    return res.status(400).json({ error: 'A valid account type is required.' });
  }

  const safeSubscriptionTierId = Number.parseInt(subscriptionTierId, 10);
  if (!Number.isInteger(safeSubscriptionTierId) || safeSubscriptionTierId <= 0) {
    return res.status(400).json({ error: 'A valid subscription type is required.' });
  }

  const typeConfig = REGISTRATION_TYPE_MAP[safeType];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userRows] = await conn.query(
      `SELECT id, username, Password, membershipType, external_auth, external_auth_provider,
              external_auth_subject, external_auth_linked_at, avatarName, avatarPath
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [sessionUserId]
    );

    const currentUser = userRows?.[0];
    if (!currentUser) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found.' });
    }

    if (Number(currentUser.external_auth || 0) !== 1) {
      await conn.rollback();
      return res.status(403).json({ error: 'External registration completion is only available for external-auth users.' });
    }

    const membershipMissing = currentUser.membershipType === null || typeof currentUser.membershipType === 'undefined' || String(currentUser.membershipType).trim() === '';
    if (!membershipMissing) {
      await conn.rollback();
      return res.status(409).json({ error: 'Registration is already complete for this account.' });
    }

    const [tierRows] = await conn.query(
      'SELECT id, name, slug, price_monthly, price_yearly FROM membership_tiers WHERE id = ? AND is_active = 1 LIMIT 1',
      [safeSubscriptionTierId]
    );
    const selectedTier = tierRows?.[0];
    if (!selectedTier) {
      await conn.rollback();
      return res.status(400).json({ error: 'Selected subscription type is invalid.' });
    }

    if (!isTierValidForMembershipType(safeType, selectedTier)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Selected subscription is not valid for the chosen account type.' });
    }

    const billingCycle = Number(selectedTier.price_monthly || 0) > 0 ? 'monthly' : 'none';

    await conn.query(
      'UPDATE users SET membershipType = ? WHERE id = ? LIMIT 1',
      [safeType, sessionUserId]
    );

    await conn.query(
      `INSERT INTO user_profiles (user_id, user_role, tier, settings)
       VALUES (?, ?, ?, '[]')
       ON DUPLICATE KEY UPDATE
         user_role = VALUES(user_role),
         tier = VALUES(tier),
         settings = COALESCE(user_profiles.settings, '[]')`,
      [sessionUserId, typeConfig.roleSlug, selectedTier.id]
    );

    const [membershipRows] = await conn.query(
      `SELECT id
       FROM user_memberships
       WHERE user_id = ?
       ORDER BY started_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [sessionUserId]
    );

    if (membershipRows.length > 0) {
      await conn.query(
        `UPDATE user_memberships
         SET tier_id = ?, status = 'active', billing_cycle = ?, started_at = CURDATE()
         WHERE id = ?`,
        [selectedTier.id, billingCycle, membershipRows[0].id]
      );
    } else {
      await conn.query(
        `INSERT INTO user_memberships (user_id, tier_id, status, billing_cycle, started_at)
         VALUES (?, ?, 'active', ?, CURDATE())`,
        [sessionUserId, selectedTier.id, billingCycle]
      );
    }

    await conn.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       SELECT ?, r.id, ?
       FROM roles r
       WHERE r.slug = ?
         AND NOT EXISTS (
           SELECT 1
           FROM user_roles ur
           WHERE ur.user_id = ? AND ur.role_id = r.id
         )
       LIMIT 1`,
      [sessionUserId, sessionUserId, typeConfig.roleSlug, sessionUserId]
    );

    await conn.commit();

    const [updatedRows] = await pool.query(
      `SELECT id, username, Password, membershipType, external_auth, external_auth_provider,
              external_auth_subject, external_auth_linked_at, avatarName, avatarPath
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [sessionUserId]
    );

    const updatedUser = updatedRows?.[0];
    await establishAuthenticatedSession(req, updatedUser || currentUser, {
      mustResetPassword: Boolean(req.session?.mustResetPassword),
    });

    return res.json({
      message: 'External registration completed successfully.',
      user: req.session.user,
      membershipType: safeType,
      subscriptionTier: selectedTier.name,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_rollbackErr) {
      // no-op
    }

    console.error('❌ External registration completion error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to complete external registration.' });
  } finally {
    conn.release();
  }
});




//Register
router.post('/register', requireTrustedAuthOrigin, async (req, res) => {
  try {
    const { firstName, lastName, username, password, membershipType, subscriptionTierId } = req.body;

    if (!firstName || !username || !password) {
      return res.status(400).json({ error: "First name, email, and password are required" });
    }

    // membershipType = membership/billing/profile tier (not used for access control)
    // Self-service registration allows only User and Trainer.
    const hasMembershipType = typeof membershipType !== 'undefined' && membershipType !== null && String(membershipType).trim().length > 0;
    if (hasMembershipType && !ALLOWED_SELF_SERVICE_MEMBERSHIP_TYPES.includes(membershipType)) {
      return res.status(400).json({ error: 'A valid account type is required.' });
    }

    const safeType = hasMembershipType ? membershipType : 'User';

    const safeSubscriptionTierId = Number.parseInt(subscriptionTierId, 10);
    if (!Number.isInteger(safeSubscriptionTierId) || safeSubscriptionTierId <= 0) {
      return res.status(400).json({ error: 'A valid subscription type is required.' });
    }

    // Map membershipType (profile tier) → role slug (RBAC), tier, billing cycle
    const typeConfig = REGISTRATION_TYPE_MAP[safeType];

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

      // 1. Create the core user row (with membershipType column and default avatar)
      // membershipType is for billing/profile tier only. Role is assigned separately for RBAC.
      const [userResult] = await conn.query(
        "INSERT INTO users (FirstName, LastName, username, Password, membershipType, avatarName, avatarPath) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [safeFirst, safeLast, safeUser, hashedPassword, safeType, 'default.png', '/images/avatar/default.png']
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
