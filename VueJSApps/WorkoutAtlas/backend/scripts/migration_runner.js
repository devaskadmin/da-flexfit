/**
 * FlexFit – Migration Runner
 * File: backend/scripts/migration_runner.js
 * Version: v0.82.42
 *
 * Purpose:
 *   - Detects unapplied SQL migrations across all category subfolders.
 *   - Applies them in filename-sorted order (YYYYMMDD prefix ensures correct order).
 *   - Records each applied migration in the schema_migrations tracking table.
 *   - Prevents duplicate execution via the tracking table.
 *
 * Usage:
 *   node -r dotenv/config backend/scripts/migration_runner.js
 *   node -r dotenv/config backend/scripts/migration_runner.js --dry-run
 *   node -r dotenv/config backend/scripts/migration_runner.js --category workout
 *
 * Migration folders scanned (in order):
 *   backend/migrations/core/
 *   backend/migrations/workout/
 *   backend/migrations/nutrition/
 *   backend/migrations/security/
 *   backend/migrations/dashboard/
 *   (ai/ and archive/ are excluded from automatic runs)
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const mysql   = require('mysql2/promise');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MIGRATION_ROOT = path.join(__dirname, '..', 'migrations');

// Subfolders applied in this order. archive/ and ai/ are never auto-applied.
const ACTIVE_CATEGORIES = ['core', 'workout', 'nutrition', 'security', 'dashboard'];

const DRY_RUN  = process.argv.includes('--dry-run');
const ONLY_CAT = (() => {
  const idx = process.argv.indexOf('--category');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// DB connection (reads from .env)
// ---------------------------------------------------------------------------
async function getConnection() {
  return mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
}

// ---------------------------------------------------------------------------
// Ensure tracking table exists
// ---------------------------------------------------------------------------
async function ensureTrackingTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename     VARCHAR(255) NOT NULL,
      category     VARCHAR(60)  NOT NULL,
      applied_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum     VARCHAR(64)  NULL COMMENT 'SHA-256 of file content at apply time',
      PRIMARY KEY (id),
      UNIQUE KEY ux_schema_migrations_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ---------------------------------------------------------------------------
// Fetch already-applied migration filenames
// ---------------------------------------------------------------------------
async function getAppliedMigrations(conn) {
  const [rows] = await conn.execute(
    'SELECT filename FROM schema_migrations ORDER BY applied_at'
  );
  return new Set(rows.map(r => r.filename));
}

// ---------------------------------------------------------------------------
// Collect pending migrations from disk
// ---------------------------------------------------------------------------
function collectMigrations(categoryFilter) {
  const categories = categoryFilter ? [categoryFilter] : ACTIVE_CATEGORIES;
  const pending = [];

  for (const cat of categories) {
    const dir = path.join(MIGRATION_ROOT, cat);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // YYYYMMDD prefix → lexicographic = chronological

    for (const file of files) {
      pending.push({ category: cat, filename: file, fullPath: path.join(dir, file) });
    }
  }

  return pending;
}

// ---------------------------------------------------------------------------
// Apply a single migration file
// ---------------------------------------------------------------------------
async function applyMigration(conn, migration) {
  const sql = fs.readFileSync(migration.fullPath, 'utf8');

  // Simple SHA-256 checksum for audit trail
  const crypto   = require('crypto');
  const checksum  = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');

  console.log(`  → Applying [${migration.category}] ${migration.filename}...`);

  if (!DRY_RUN) {
    await conn.query(sql);
    await conn.execute(
      'INSERT INTO schema_migrations (filename, category, checksum) VALUES (?, ?, ?)',
      [migration.filename, migration.category, checksum]
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  if (DRY_RUN) console.log('DRY RUN – no changes will be written.\n');

  let conn;
  try {
    conn = await getConnection();
    await ensureTrackingTable(conn);

    const applied  = await getAppliedMigrations(conn);
    const all      = collectMigrations(ONLY_CAT);
    const pending  = all.filter(m => !applied.has(m.filename));

    if (pending.length === 0) {
      console.log('✅ All migrations already applied. Nothing to do.');
      return;
    }

    console.log(`Found ${pending.length} unapplied migration(s):\n`);
    for (const m of pending) {
      console.log(`  [${m.category}] ${m.filename}`);
    }
    console.log('');

    for (const migration of pending) {
      await applyMigration(conn, migration);
    }

    console.log(`\n✅ Applied ${pending.length} migration(s) successfully.`);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
