require('dotenv').config();

const config = {
  host: process.env.DB_HOST,  // ✅ Fix: Changed 'server' → 'host'
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT, 10) || 3306, // ✅ Fixed port parsing
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

module.exports = config;
