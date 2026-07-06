/**
 * FlexFit – Database Backup Script
 * File: backend/scripts/backup_db.js
 * Version: v0.82.42
 *
 * Purpose:
 *   - Placeholder for automated DB backup before production migrations.
 *   - Intended to shell out to mysqldump and save a timestamped .sql file.
 *   - Extend this script before v0.83 production deployment.
 *
 * Usage:
 *   node -r dotenv/config backend/scripts/backup_db.js
 *
 * TODO (before production):
 *   - Provide BACKUP_OUTPUT_DIR in .env (e.g., /var/backups/flexfit)
 *   - Provide MYSQLDUMP_PATH in .env if mysqldump is not on PATH
 *   - Add retention policy (delete backups older than N days)
 *   - Optionally upload backup to S3 / remote storage
 */

'use strict';

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const DB_HOST   = process.env.DB_HOST     || 'localhost';
const DB_PORT   = process.env.DB_PORT     || '3306';
const DB_USER   = process.env.DB_USER;
const DB_PASS   = process.env.DB_PASSWORD;
const DB_NAME   = process.env.DB_NAME;
const OUT_DIR   = process.env.BACKUP_OUTPUT_DIR || path.join(__dirname, '..', '..', 'backups');
const DUMP_BIN  = process.env.MYSQLDUMP_PATH    || 'mysqldump';

function run() {
  if (!DB_USER || !DB_NAME) {
    console.error('❌ DB_USER and DB_NAME must be set in .env');
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile   = path.join(OUT_DIR, `flexfit_backup_${timestamp}.sql`);

  const cmd = [
    DUMP_BIN,
    `-h${DB_HOST}`,
    `-P${DB_PORT}`,
    `-u${DB_USER}`,
    DB_PASS ? `-p${DB_PASS}` : '',
    '--single-transaction',
    '--routines',
    '--triggers',
    DB_NAME,
    `> "${outFile}"`,
  ].filter(Boolean).join(' ');

  console.log(`Backing up ${DB_NAME} → ${outFile}`);

  try {
    execSync(cmd, { shell: true, stdio: 'inherit' });
    console.log('✅ Backup complete.');
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  }
}

run();
