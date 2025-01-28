require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT, 10 || 3306), // Parse port as an integer
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

module.exports = config;
