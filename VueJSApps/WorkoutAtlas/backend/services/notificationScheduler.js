/**
 * WorkoutAtlas 0.85.5 – Notification Scheduler
 *
 * Runs two background jobs once per day:
 *  1. deleteOldNotifications  – prune notifications older than 365 days
 *  2. checkMembershipExpiry   – create MEMBERSHIP warnings at 30/14/7/3/1 day thresholds
 *
 * No external scheduler library required. Uses Node.js setInterval.
 * The scheduler waits 5 minutes after startup before the first run so the
 * database has time to warm up, then repeats every 24 hours.
 */

const pool = require('../db');
const notificationService = require('./notificationService');
const emailService = require('./emailNotificationService');

const EXPIRY_THRESHOLD_DAYS = [30, 14, 7, 3, 1];
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// ── Cleanup ──────────────────────────────────────────────────────────────────
const runCleanup = async () => {
  try {
    await notificationService.deleteOldNotifications(365);
  } catch (err) {
    console.error('❌ [NotificationScheduler] Cleanup error:', err?.message || err);
  }
};

// ── Membership expiry check ───────────────────────────────────────────────────
const checkMembershipExpiry = async () => {
  try {
    for (const daysLeft of EXPIRY_THRESHOLD_DAYS) {
      const [rows] = await pool.query(
        `SELECT um.user_id, COALESCE(mt.name, 'Premium') AS tierName
         FROM user_memberships um
         LEFT JOIN membership_tiers mt ON mt.id = um.tier_id
         WHERE um.status = 'active'
           AND um.expires_at IS NOT NULL
           AND DATE(um.expires_at) = DATE(DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [daysLeft]
      );

      for (const row of rows) {
        await notificationService
          .createMembershipNotification(row.user_id, daysLeft, row.tierName)
          .catch((err) => console.error(`❌ [NotificationScheduler] Membership notify failed for user ${row.user_id}:`, err?.message));

        // Email notification (best-effort alongside in-app notification)
        emailService.sendMembershipEmail(row.user_id, daysLeft, row.tierName).catch(() => {});
      }
    }
  } catch (err) {
    console.error('❌ [NotificationScheduler] Membership expiry check error:', err?.message || err);
  }
};

// ── Daily job ─────────────────────────────────────────────────────────────────
const runDailyJob = async () => {
  console.log('📅 [NotificationScheduler] Running daily job...');
  await runCleanup();
  await checkMembershipExpiry();
  console.log('✅ [NotificationScheduler] Daily job complete.');
};

// ── Start ─────────────────────────────────────────────────────────────────────
const startScheduler = () => {
  setTimeout(async () => {
    await runDailyJob();
    setInterval(runDailyJob, DAILY_INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  console.log('📅 [NotificationScheduler] Started. First run in 5 minutes, then every 24 hours.');
};

module.exports = { startScheduler, runDailyJob, runCleanup, checkMembershipExpiry };
