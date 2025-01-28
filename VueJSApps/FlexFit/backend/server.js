const express = require('express');
const mysql = require('mysql2/promise'); // Use mysql2 with promises
const dbConfig = require('./dbConfig'); // Import the database configuration

const app = express();
app.use(express.json());

// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection route
app.get('/api/test-connection', async (req, res) => {
  try {
    // Use the connection pool to query the database
    const [rows] = await pool.query('SELECT 1 AS test');
    res.status(200).json({ message: 'Connection successful', result: rows });
  } catch (err) {
    console.error('Database connection error:', err.message);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// Example route to fetch data from a table
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Users'); // Replace 'Users' with your table name
    res.status(200).json(rows);
  } catch (err) {
    console.error('Database query error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Handle invalid routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
