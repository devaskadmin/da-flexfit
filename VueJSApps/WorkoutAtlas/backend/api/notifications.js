const express = require('express');
const router = express.Router();
const pool = require('../db');

const requireLoggedInUser = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
};

router.get('/notifications', requireLoggedInUser, async (req, res) => {
  const userId = req.session.user.id;

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const requestedOffset = Number.parseInt(req.query.offset, 10);

  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
  const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';

  try {
    const whereClause = unreadOnly ? 'WHERE user_id = ? AND is_read = 0' : 'WHERE user_id = ?';

    const [rows] = await pool.query(
      `SELECT
          id,
          user_id AS userId,
          type,
          title,
          message,
          action_url AS actionUrl,
          metadata,
          is_read AS isRead,
          read_at AS readAt,
          created_at AS createdAt,
          updated_at AS updatedAt
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM notifications
       ${whereClause}`,
      [userId]
    );

    return res.json({
      items: rows,
      total: Number(countRows[0]?.total || 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error('❌ Failed to load notifications:', error);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.get('/notifications/unread-count', requireLoggedInUser, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unreadCount
       FROM notifications
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    return res.json({ unreadCount: Number(rows[0]?.unreadCount || 0) });
  } catch (error) {
    console.error('❌ Failed to load unread count:', error);
    return res.status(500).json({ error: 'Failed to load unread count.' });
  }
});

router.patch('/notifications/mark-all-read', requireLoggedInUser, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = 1,
           read_at = COALESCE(read_at, NOW()),
           updated_at = NOW()
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    return res.json({ updated: Number(result.affectedRows || 0) });
  } catch (error) {
    console.error('❌ Failed to mark all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read.' });
  }
});

router.patch('/notifications/:id/read', requireLoggedInUser, async (req, res) => {
  const userId = req.session.user.id;
  const notificationId = Number.parseInt(req.params.id, 10);

  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return res.status(400).json({ error: 'Invalid notification ID.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = 1,
           read_at = COALESCE(read_at, NOW()),
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

// Optional helper endpoint to create a notification for current user.
router.post('/notifications', requireLoggedInUser, async (req, res) => {
  const sessionUserId = req.session.user.id;
  const {
    userId,
    type = 'system',
    title,
    message,
    actionUrl = null,
    metadata = null,
  } = req.body || {};

  const targetUserId = Number.isFinite(Number(userId)) ? Number(userId) : sessionUserId;

  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO notifications
        (user_id, type, title, message, action_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [targetUserId, String(type), String(title), String(message), actionUrl, metadata ? JSON.stringify(metadata) : null]
    );

    return res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    return res.status(500).json({ error: 'Failed to create notification.' });
  }
});

module.exports = router;
