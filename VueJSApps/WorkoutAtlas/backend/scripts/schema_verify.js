/**
 * FlexFit – Schema Verifier
 * File: backend/scripts/schema_verify.js
 * Version: v0.82.42
 *
 * Purpose:
 *   - Checks that critical tables and columns exist in the live database.
 *   - Useful for post-deployment verification and CI checks.
 *   - Does NOT make any schema changes.
 *
 * Usage:
 *   node -r dotenv/config backend/scripts/schema_verify.js
 *
 * Exit code 0 = all checks passed.
 * Exit code 1 = one or more checks failed.
 */

'use strict';

const mysql = require('mysql2/promise');

// ---------------------------------------------------------------------------
// Expected schema snapshot
// Update this list whenever a new migration adds a required table/column.
// ---------------------------------------------------------------------------
const EXPECTED = [
  // Table existence checks
  { type: 'table', name: 'users' },
  { type: 'table', name: 'exercises' },
  { type: 'table', name: 'workout_log' },
  { type: 'table', name: 'workout_log_sessions' },
  { type: 'table', name: 'workout_log_sets' },
  { type: 'table', name: 'workout_schedules' },
  { type: 'table', name: 'workout_schedule_groups' },
  { type: 'table', name: 'user_favorite_exercises' },
  { type: 'table', name: 'notifications' },
  { type: 'table', name: 'notification_preferences' },
  { type: 'table', name: 'schema_migrations' },

  // Column existence checks (table, column)
  { type: 'column', table: 'exercises',  column: 'CreatedByUserID' },
  { type: 'column', table: 'exercises',  column: 'IsGlobalExercise' },
  { type: 'column', table: 'users',      column: 'avatarName' },
  { type: 'column', table: 'users',      column: 'avatarPath' },
];

// ---------------------------------------------------------------------------
// DB connection
// ---------------------------------------------------------------------------
async function getConnection() {
  return mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  let conn;
  let failures = 0;

  try {
    conn = await getConnection();
    const [dbRow] = await conn.execute('SELECT DATABASE() AS db');
    const dbName  = dbRow[0].db;

    console.log(`Verifying schema for database: ${dbName}\n`);

    for (const check of EXPECTED) {
      if (check.type === 'table') {
        const [rows] = await conn.execute(
          `SELECT COUNT(*) AS cnt
           FROM information_schema.tables
           WHERE table_schema = ? AND table_name = ?`,
          [dbName, check.name]
        );
        const exists = rows[0].cnt > 0;
        console.log(`  [table]  ${check.name.padEnd(35)} ${exists ? '✅' : '❌ MISSING'}`);
        if (!exists) failures++;

      } else if (check.type === 'column') {
        const [rows] = await conn.execute(
          `SELECT COUNT(*) AS cnt
           FROM information_schema.columns
           WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
          [dbName, check.table, check.column]
        );
        const exists = rows[0].cnt > 0;
        console.log(`  [column] ${check.table}.${check.column.padEnd(26)} ${exists ? '✅' : '❌ MISSING'}`);
        if (!exists) failures++;
      }
    }

    console.log('');
    if (failures === 0) {
      console.log('✅ All schema checks passed.');
    } else {
      console.log(`❌ ${failures} check(s) failed. Run pending migrations to resolve.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Schema verify error:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
