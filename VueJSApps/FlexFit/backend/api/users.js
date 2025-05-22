const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');

// ✅ DB Connect
const pool = require('../db');

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
 
module.exports = router;