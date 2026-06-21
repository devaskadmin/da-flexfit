/**
 * Create-UserMediaFolders.js
 * FlexFit v0.83.11 — User Media Lifecycle Management
 *
 * One-time backfill script: creates AWS-S3-CONTENT/USERS/{UserID}/ folder
 * structure for all existing users.
 *
 * Usage:
 *   cd backend
 *   node scripts/Create-UserMediaFolders.js
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const pool = require('../db');
const { ensureUserMediaFolders } = require('../services/userMediaService');

async function run() {
  console.log('');
  console.log('[USER-MEDIA] ─── User Media Folder Backfill ──────────────────');

  let total    = 0;
  let created  = 0;
  let existing = 0;
  let failed   = 0;

  try {
    const [users] = await pool.query('SELECT id FROM users ORDER BY id ASC');
    total = users.length;

    console.log(`[USER-MEDIA] Total Users: ${total}`);
    console.log('');

    for (const user of users) {
      try {
        const result = await ensureUserMediaFolders(user.id);
        const allExisting = Object.values(result.folders).every((v) => v === 'existing');

        if (allExisting) {
          existing++;
          console.log(`[USER-MEDIA]   UserID=${user.id} — folders already exist`);
        } else {
          created++;
          console.log(`[USER-MEDIA]   UserID=${user.id} — created (${result.basePath})`);
        }
      } catch (err) {
        failed++;
        console.error(`[USER-MEDIA]   UserID=${user.id} — FAILED: ${err?.message || err}`);
      }
    }
  } finally {
    await pool.end().catch(() => {});
  }

  console.log('');
  console.log('[USER-MEDIA] ─── Backfill Complete ──────────────────────────');
  console.log(`[USER-MEDIA] Total Users:       ${total}`);
  console.log(`[USER-MEDIA] Created:           ${created}`);
  console.log(`[USER-MEDIA] Already Existing:  ${existing}`);
  console.log(`[USER-MEDIA] Failed:            ${failed}`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('[USER-MEDIA] Fatal error:', err?.message || err);
  process.exit(1);
});
