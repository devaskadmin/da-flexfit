const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');

// ✅ DB Connect
const pool = require('../db');

function deepMerge(target, source) {
  const out = { ...(target || {}) };
  for (const key of Object.keys(source || {})) {
    const sourceValue = source[key];
    const targetValue = out[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      out[key] = deepMerge(targetValue, sourceValue);
    } else {
      out[key] = sourceValue;
    }
  }
  return out;
}

//Gets user ID
router.get('/user-id', (req, res) => {
    if (req.session?.user?.id) {
      return res.json({ userId: req.session.user.id });
    }
    res.status(401).json({ error: 'User not logged in' });
  });

//Get Users
  router.get('/users', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM users');
      res.status(200).json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users', details: err.message });
    }
  });

// Get current user's profile settings JSON
router.get('/user-profile-settings', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!rows.length) {
      return res.json({ settings: {} });
    }

    let parsed = {};
    const raw = rows[0]?.settings;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        parsed = {};
      }
    } else if (raw && typeof raw === 'object') {
      parsed = raw;
    }

    return res.json({ settings: parsed || {} });
  } catch (err) {
    console.error('❌ Failed to get user profile settings:', err);
    return res.status(500).json({ error: 'Failed to load user profile settings' });
  }
});

// Save/merge current user's profile settings JSON
router.put('/user-profile-settings', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const incoming = req.body?.settings;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'settings object is required' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    let currentSettings = {};
    if (rows.length > 0) {
      const raw = rows[0]?.settings;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          currentSettings = JSON.parse(raw) || {};
        } catch (_) {
          currentSettings = {};
        }
      } else if (raw && typeof raw === 'object') {
        currentSettings = raw;
      }
    }

    const mergedSettings = deepMerge(currentSettings, incoming);

    await pool.query(
      `INSERT INTO user_profiles (user_id, user_role, tier, settings)
       VALUES (?, 'member', 1, ?)
       ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
      [userId, JSON.stringify(mergedSettings)]
    );

    return res.json({ message: 'Profile settings saved', settings: mergedSettings });
  } catch (err) {
    console.error('❌ Failed to save user profile settings:', err);
    return res.status(500).json({ error: 'Failed to save user profile settings' });
  }
});
 
module.exports = router;