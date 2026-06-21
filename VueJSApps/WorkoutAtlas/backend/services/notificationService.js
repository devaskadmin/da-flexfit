const pool = require('../db');
const Notification = require('../models/notification');
const emailService = require('./emailNotificationService');

const VALID_NOTIFICATION_TYPES = new Set([
  'SYSTEM',
  'MESSAGE',
  'WORKOUT',
  'NUTRITION',
  'MEMBERSHIP',
  'ADMIN',
  'PROGRESS',
  'ACCOUNT',
]);

const normalizeNotificationType = (value) => {
  const candidate = String(value || 'SYSTEM').trim().toUpperCase();
  return VALID_NOTIFICATION_TYPES.has(candidate) ? candidate : 'SYSTEM';
};

class NotificationService {
  constructor(db = pool) {
    this.db = db;
  }

  async createNotification({
    userId,
    notificationType = 'SYSTEM',
    title,
    message,
    link = null,
    db = this.db,
  } = {}) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    if (!String(title || '').trim() || !String(message || '').trim()) {
      throw Object.assign(new Error('title and message are required.'), { status: 400 });
    }

    const normalizedType = normalizeNotificationType(notificationType);
    const [result] = await db.query(
      `INSERT INTO notifications
         (user_id, notification_type, title, message, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [numericUserId, normalizedType, String(title).trim().substring(0, 255), String(message).trim(), link ? String(link).trim().substring(0, 255) : null]
    );

    return this.findNotificationById(result.insertId, { userId: numericUserId, db });
  }

  async findNotificationById(notificationId, { userId = null, db = this.db } = {}) {
    const numericNotificationId = Number(notificationId);
    if (!Number.isFinite(numericNotificationId) || numericNotificationId <= 0) {
      return null;
    }

    const params = [numericNotificationId];
    let accessClause = '';
    if (Number.isFinite(Number(userId)) && Number(userId) > 0) {
      params.push(Number(userId));
      accessClause = 'AND user_id = ?';
    }

    const [rows] = await db.query(
      `SELECT
         id,
         user_id AS userId,
         notification_type AS notificationType,
         title,
         message,
         link,
         is_read AS isRead,
         created_at AS createdAt,
         updated_at AS updatedAt,
         read_at AS readAt
       FROM notifications
       WHERE id = ?
       ${accessClause}
       LIMIT 1`,
      params
    );

    if (!rows.length) {
      return null;
    }

    return Notification.fromRow(rows[0]).toJSON();
  }

  async listNotifications(userId, { limit = 50, offset = 0, unreadOnly = false, db = this.db } = {}) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const whereClause = unreadOnly ? 'WHERE user_id = ? AND is_read = 0' : 'WHERE user_id = ?';

    const [rows] = await db.query(
      `SELECT
         id,
         user_id AS userId,
         notification_type AS notificationType,
         title,
         message,
         link,
         is_read AS isRead,
         created_at AS createdAt,
         updated_at AS updatedAt,
         read_at AS readAt
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [numericUserId, safeLimit, safeOffset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM notifications
       ${whereClause}`,
      [numericUserId]
    );

    return {
      items: rows.map((row) => Notification.fromRow(row).toJSON()),
      total: Number(countRows[0]?.total || 0),
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  async markNotificationAsRead(notificationId, userId, db = this.db) {
    const numericNotificationId = Number(notificationId);
    const numericUserId = Number(userId);

    if (!Number.isFinite(numericNotificationId) || numericNotificationId <= 0) {
      throw Object.assign(new Error('Invalid notification ID.'), { status: 400 });
    }

    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = 1,
           read_at = COALESCE(read_at, NOW())
       WHERE id = ?
         AND user_id = ?`,
      [numericNotificationId, numericUserId]
    );

    return Number(result.affectedRows || 0) > 0;
  }

  async markNotificationsAsRead(notificationIds, userId, db = this.db) {
    const ids = Array.isArray(notificationIds)
      ? notificationIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
      : [];

    if (ids.length === 0) {
      return 0;
    }

    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = 1,
           read_at = COALESCE(read_at, NOW())
       WHERE user_id = ?
         AND id IN (?)`,
      [numericUserId, ids]
    );

    return Number(result.affectedRows || 0);
  }

  async markAllAsRead(userId, db = this.db) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = 1,
           read_at = COALESCE(read_at, NOW())
       WHERE user_id = ?
         AND is_read = 0`,
      [numericUserId]
    );

    return Number(result.affectedRows || 0);
  }

  async countUnreadNotifications(userId, db = this.db) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    const [rows] = await db.query(
      `SELECT COUNT(*) AS unreadCount
       FROM notifications
       WHERE user_id = ?
         AND is_read = 0`,
      [numericUserId]
    );

    return Number(rows[0]?.unreadCount || 0);
  }

  // ── Deduplication ─────────────────────────────────────────────────────────

  // Returns true if an identical (user + type + link) notification already
  // exists within the given time window. Prevents duplicate alerts.
  async hasDuplicateRecent(userId, notificationType, link, windowHours = 24, db = this.db) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) return false;

    const safeLink = link ? String(link).trim().substring(0, 255) : null;
    const [rows] = await db.query(
      `SELECT id FROM notifications
       WHERE user_id = ?
         AND notification_type = ?
         AND (link <=> ?)
         AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
       LIMIT 1`,
      [numericUserId, normalizeNotificationType(notificationType), safeLink, Number(windowHours) || 24]
    );

    return rows.length > 0;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  // Delete notifications older than maxAgeDays (default 365). Returns the
  // number of rows deleted. Safe to call on any schedule.
  async deleteOldNotifications(maxAgeDays = 365, db = this.db) {
    const [result] = await db.query(
      `DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [Math.max(Number(maxAgeDays) || 365, 1)]
    );
    const deleted = Number(result.affectedRows || 0);
    if (deleted > 0) {
      console.log(`🧹 Notification cleanup: removed ${deleted} notification(s) older than ${maxAgeDays} days.`);
    }
    return deleted;
  }

  // ── Typed Helper Methods ──────────────────────────────────────────────────

  async createMessageNotification(userId, senderName, conversationId) {
    const link = conversationId ? `/messages/${conversationId}` : '/messages';
    return this.createNotification({
      userId,
      notificationType: 'MESSAGE',
      title: 'New Message',
      message: `${senderName || 'Someone'} sent you a message.`,
      link,
    });
  }

  async createWorkoutNotification(userId, trainerName, workoutName) {
    const link = '/workout-builder';
    const isDup = await this.hasDuplicateRecent(userId, 'WORKOUT', link, 1).catch(() => false);
    if (isDup) return null;
    const notification = await this.createNotification({
      userId,
      notificationType: 'WORKOUT',
      title: 'Workout Updated',
      message: trainerName
        ? `${trainerName} updated ${workoutName || 'your workout plan'}.`
        : `${workoutName || 'Your workout plan'} has been updated.`,
      link,
    });
    emailService.sendWorkoutEmail(userId, trainerName, workoutName).catch(() => {});
    return notification;
  }

  async createNutritionNotification(userId, trainerName) {
    const link = '/nutrition';
    const isDup = await this.hasDuplicateRecent(userId, 'NUTRITION', link, 1).catch(() => false);
    if (isDup) return null;
    const notification = await this.createNotification({
      userId,
      notificationType: 'NUTRITION',
      title: 'Nutrition Plan Updated',
      message: trainerName
        ? `${trainerName} updated your nutrition goals.`
        : 'Your nutrition plan has been updated.',
      link,
    });
    emailService.sendNutritionEmail(userId, trainerName).catch(() => {});
    return notification;
  }

  async createMembershipNotification(userId, daysRemaining, tierName) {
    const link = '/settings';
    const isDup = await this.hasDuplicateRecent(userId, 'MEMBERSHIP', link, 23).catch(() => false);
    if (isDup) return null;
    const days = Number(daysRemaining) || 0;
    return this.createNotification({
      userId,
      notificationType: 'MEMBERSHIP',
      title: 'Membership Expiring',
      message: `Your ${tierName || 'Premium'} membership expires in ${days} day${days !== 1 ? 's' : ''}.`,
      link,
    });
  }

  async createProgressNotification(userId, milestone) {
    const link = '/progress';
    const message = `Congratulations! ${milestone}`;
    // Prevent duplicate milestone notifications (lifetime dedup by exact message)
    const [existing] = await this.db.query(
      `SELECT id FROM notifications WHERE user_id = ? AND notification_type = 'PROGRESS' AND message = ? LIMIT 1`,
      [Number(userId), message]
    );
    if (existing.length > 0) return null;
    return this.createNotification({
      userId,
      notificationType: 'PROGRESS',
      title: 'Milestone Reached',
      message,
      link,
    });
  }

  async createAccountNotification(userId, event, detail, link = '/settings') {
    return this.createNotification({
      userId,
      notificationType: 'ACCOUNT',
      title: String(event || 'Account Update').substring(0, 255),
      message: String(detail || ''),
      link,
    });
  }

  async createAdminNotification(userId, title, message, link = '/dashboard') {
    return this.createNotification({
      userId,
      notificationType: 'ADMIN',
      title: String(title || 'Notice').substring(0, 255),
      message: String(message || ''),
      link,
    });
  }

  async createSystemNotification(userId, message, link = null) {
    return this.createNotification({
      userId,
      notificationType: 'SYSTEM',
      title: 'System Event',
      message: String(message || ''),
      link,
    });
  }
}

module.exports = new NotificationService();