// db.js
const mysql = require('mysql2');
const dbConfig = require('./dbConfig');
const pool = mysql.createPool(dbConfig).promise();

module.exports = pool;