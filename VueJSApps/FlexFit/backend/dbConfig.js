const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 5,   // ✅ Capped to avoid ER_TOO_MANY_USER_CONNECTIONS on shared hosting
  maxIdle: 3,           // ✅ Release idle connections faster
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

console.log('📊 App DB pool: connectionLimit=5, maxIdle=3');

const missingEnvKeys = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE']
  .filter((key) => !String(process.env[key] || '').trim());

if (missingEnvKeys.length > 0) {
  throw new Error(
    `Missing database environment variables: ${missingEnvKeys.join(', ')}. ` +
    'Set them in backend/.env or backend/.env.local for local development.'
  );
}

module.exports = config;
