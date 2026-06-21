const notificationService = require('../services/notificationService');
const { parseNumber, sanitizeText } = require('../utils/sanitize');

const parseNotificationIds = (body = {}) => {
  const candidates = [];

  if (body.notificationId !== undefined && body.notificationId !== null) {
    candidates.push(body.notificationId);
  }

  if (Array.isArray(body.notificationIds)) {
    candidates.push(...body.notificationIds);
  }

  return candidates
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
};

class NotificationsController {
  async listNotifications(req, res) {
    try {
      const userId = req.session.user.id;
      const requestedLimit = parseNumber(req.query.limit);
      const requestedOffset = parseNumber(req.query.offset);
      const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';

      const result = await notificationService.listNotifications(userId, {
        limit: requestedLimit || 50,
        offset: requestedOffset || 0,
        unreadOnly,
      });

      return res.json(result);
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to list notifications:', error);
      return res.status(status).json({ error: error?.message || 'Failed to list notifications.' });
    }
  }

  async markRead(req, res) {
    try {
      const userId = req.session.user.id;
      const notificationIds = parseNotificationIds(req.body || {});
      const markAll = Boolean(req.body?.markAll) || notificationIds.length === 0;

      let updated = 0;

      if (markAll) {
        updated = await notificationService.markAllAsRead(userId);
      } else if (notificationIds.length === 1) {
        updated = (await notificationService.markNotificationAsRead(notificationIds[0], userId)) ? 1 : 0;
      } else {
        updated = await notificationService.markNotificationsAsRead(notificationIds, userId);
      }

      return res.json({
        message: 'Notification(s) updated.',
        updated,
      });
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to mark notifications as read:', error);
      return res.status(status).json({ error: error?.message || 'Failed to update notifications.' });
    }
  }

  async getUnreadCount(req, res) {
    try {
      const unreadCount = await notificationService.countUnreadNotifications(req.session.user.id);
      return res.json({ unreadCount });
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to load notification unread count:', error);
      return res.status(status).json({ error: error?.message || 'Failed to load unread count.' });
    }
  }

  async createFromRequest(req, res) {
    try {
      const userId = Number(req.body?.userId || req.session.user.id);
      const notificationType = sanitizeText(req.body?.notificationType || req.body?.type || 'SYSTEM', 50) || 'SYSTEM';
      const title = sanitizeText(req.body?.title || '', 255);
      const message = sanitizeText(req.body?.message || '', 5000);
      const link = sanitizeText(req.body?.link || req.body?.actionUrl || '', 255);

      if (!title || !message) {
        return res.status(400).json({ error: 'title and message are required.' });
      }

      const notification = await notificationService.createNotification({
        userId,
        notificationType,
        title,
        message,
        link: link || null,
      });

      return res.status(201).json({
        message: 'Notification created.',
        notification,
      });
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to create notification:', error);
      return res.status(status).json({ error: error?.message || 'Failed to create notification.' });
    }
  }
}

module.exports = new NotificationsController();