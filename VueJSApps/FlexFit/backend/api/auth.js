const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dbConfig = require('../dbConfig');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');



// ✅ DB Connect
const pool = require('../db.js');



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
  router.get('/user-id', (req, res) => {
    if (req.session?.user?.id) {
      return res.json({ userId: req.session.user.id });
    }
    res.status(401).json({ error: 'User not logged in' });
  });




//Register
router.post('/register', async (req, res) => {
    try {
      const firstName = "demo";
      const lastName = "demo";
      const username = "demo@demo.com";
      const password = "demo";
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const [existingUser] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }
  
      await pool.query(
        "INSERT INTO users (FirstName, LastName, username, Password) VALUES (?, ?, ?, ?)",
        [firstName, lastName, username, hashedPassword]
      );
  
      res.json({ message: "Demo user registered" });
    } catch (err) {
      console.error("❌ Registration error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

module.exports = router;
