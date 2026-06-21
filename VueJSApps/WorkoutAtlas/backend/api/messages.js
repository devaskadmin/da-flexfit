const express = require('express');
const router = express.Router();
const pool = require('../db');
const messagesController = require('../controllers/messagesController');
const messageService = require('../services/messageService');

const requireLoggedInUser = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  return next();
};

// Only trainers and admins may access broadcast endpoints
const requireTrainerOrAdmin = (req, res, next) => {
  const role = normalizeRole(req.session.user?.roleSlug || req.session.user?.role || 'member');
  if (role !== 'trainer' && role !== 'admin') {
    return res.status(403).json({ error: 'Only trainers and administrators can access broadcast features.' });
  }
  return next();
};

// Normalize role slug to canonical: 'admin', 'trainer', or 'member'
const normalizeRole = (slug) => {
  const s = String(slug || '').toLowerCase().trim();
  if (s === 'admin' || s === 'administrator') return 'admin';
  if (s === 'trainer') return 'trainer';
  return 'member';
};

// Resolve highest-priority role for a user from user_roles/roles
const resolveUserRole = async (userId) => {
  const [rows] = await pool.query(
    `SELECT LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) AS roleValue
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
     WHERE ur.user_id = ?
     ORDER BY CASE
       WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) IN ('admin','administrator') THEN 1
       WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) = 'trainer' THEN 2
       ELSE 3
     END
     LIMIT 1`,
    [Number(userId)]
  );
  return normalizeRole(rows[0]?.roleValue || 'member');
};

// Return user_profiles.tier (tier >= 2 = premium)
const getUserTier = async (userId) => {
  const [rows] = await pool.query(
    'SELECT tier FROM user_profiles WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  return Number(rows[0]?.tier || 1);
};

// GET /messages/recipients — returns permission metadata and filtered recipient list
// Must be defined before /messages/:conversationId to avoid param capture
router.get('/messages/recipients', requireLoggedInUser, async (req, res) => {
  try {
    const senderId = Number(req.session.user.id);
    const senderRole = normalizeRole(req.session.user?.roleSlug || req.session.user?.role || 'member');

    let canSend = true;
    let premiumRequired = false;

    if (senderRole === 'member') {
      const tier = await getUserTier(senderId);
      if (tier < 2) {
        canSend = false;
        premiumRequired = true;
      }
    }

    let rows = [];

    if (senderRole === 'admin') {
      // Admin can message any other user
      [rows] = await pool.query(
        `SELECT u.id, u.username, u.FirstName, u.LastName,
                LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name, 'member'))) AS roleSlug
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
         WHERE u.id != ?
         GROUP BY u.id
         ORDER BY u.FirstName, u.LastName, u.username`,
        [senderId]
      );
    } else if (senderRole === 'trainer') {
      // Trainer can message members and admins
      [rows] = await pool.query(
        `SELECT DISTINCT u.id, u.username, u.FirstName, u.LastName,
                LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) AS roleSlug
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
         WHERE u.id != ?
           AND LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) IN ('member','user','admin','administrator')
         ORDER BY u.FirstName, u.LastName, u.username`,
        [senderId]
      );
    } else {
      // Member can message trainers and admins
      [rows] = await pool.query(
        `SELECT DISTINCT u.id, u.username, u.FirstName, u.LastName,
                LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) AS roleSlug
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
         WHERE u.id != ?
           AND LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) IN ('trainer','admin','administrator')
         ORDER BY u.FirstName, u.LastName, u.username`,
        [senderId]
      );
    }

    const recipients = rows.map((u) => ({
      id: Number(u.id),
      username: String(u.username || ''),
      firstName: String(u.FirstName || u.firstName || ''),
      lastName: String(u.LastName || u.lastName || ''),
      displayName:
        [u.FirstName || '', u.LastName || ''].filter(Boolean).join(' ').trim() ||
        String(u.username || '') ||
        `User ${u.id}`,
      role: normalizeRole(u.roleSlug),
    }));

    return res.json({ canSend, premiumRequired, senderRole, recipients });
  } catch (err) {
    console.error('❌ Failed to fetch messaging recipients:', err);
    return res.status(500).json({ error: 'Failed to load recipients.' });
  }
});

// Middleware: enforce send permissions (premium tier + role-based recipient rules)
const checkSendPermissions = async (req, res, next) => {
  try {
    const senderId = Number(req.session.user.id);
    const senderRole = normalizeRole(req.session.user?.roleSlug || req.session.user?.role || 'member');

    // Members must have tier >= 2 (premium) to send or reply
    if (senderRole === 'member') {
      const tier = await getUserTier(senderId);
      if (tier < 2) {
        return res.status(403).json({
          error: 'Messaging is available with Premium membership.',
          premiumRequired: true,
        });
      }
    }

    // Role-based recipient check applies to new conversations only
    const recipientUserId = Number(req.body?.recipientUserId || 0);
    const existingConversationId = Number(req.body?.conversationId || 0);

    if (recipientUserId > 0 && !existingConversationId) {
      const recipientRole = await resolveUserRole(recipientUserId);

      let allowed = false;
      if (senderRole === 'admin') {
        allowed = true;
      } else if (senderRole === 'trainer') {
        allowed = recipientRole === 'member' || recipientRole === 'admin';
      } else {
        // member
        allowed = recipientRole === 'trainer' || recipientRole === 'admin';
      }

      if (!allowed) {
        return res.status(403).json({
          error: 'You are not permitted to message this recipient.',
        });
      }
    }

    return next();
  } catch (err) {
    console.error('❌ Send permission check failed:', err);
    return res.status(500).json({ error: 'Failed to validate messaging permissions.' });
  }
};

router.get('/messages/unread-count', requireLoggedInUser, messagesController.getUnreadCount.bind(messagesController));
router.get('/messages', requireLoggedInUser, messagesController.listConversations.bind(messagesController));

// ─── Broadcast: recipient list ─────────────────────────────────────────────
// GET /api/messages/broadcast/recipients
// Returns all eligible recipients for the caller (trainer → members; admin → everyone).
// Includes tier and lastActive for frontend filter UI.
router.get('/messages/broadcast/recipients', requireLoggedInUser, requireTrainerOrAdmin, async (req, res) => {
  try {
    const senderId = Number(req.session.user.id);
    const senderRole = normalizeRole(req.session.user?.roleSlug || req.session.user?.role || 'member');

    let rows;
    if (senderRole === 'admin') {
      [rows] = await pool.query(
        `SELECT u.id, u.username, u.FirstName, u.LastName,
                LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name, 'member'))) AS roleSlug,
                COALESCE(up.tier, 1) AS tier,
                (SELECT MAX(c.updated_at)
                   FROM conversations c
                   JOIN conversation_participants cp ON cp.conversation_id = c.id
                  WHERE cp.user_id = u.id) AS lastActive
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id != ?
         GROUP BY u.id
         ORDER BY u.FirstName, u.LastName, u.username`,
        [senderId]
      );
    } else {
      // Trainer broadcasts to members only
      [rows] = await pool.query(
        `SELECT DISTINCT u.id, u.username, u.FirstName, u.LastName,
                LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) AS roleSlug,
                COALESCE(up.tier, 1) AS tier,
                (SELECT MAX(c.updated_at)
                   FROM conversations c
                   JOIN conversation_participants cp ON cp.conversation_id = c.id
                  WHERE cp.user_id = u.id) AS lastActive
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id != ?
           AND LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) IN ('member','user')
         ORDER BY u.FirstName, u.LastName, u.username`,
        [senderId]
      );
    }

    const recipients = rows.map((u) => ({
      id: Number(u.id),
      username: String(u.username || ''),
      firstName: String(u.FirstName || ''),
      lastName: String(u.LastName || ''),
      displayName:
        [u.FirstName, u.LastName].filter(Boolean).join(' ').trim() ||
        String(u.username || '') ||
        `User ${u.id}`,
      role: normalizeRole(u.roleSlug),
      tier: Number(u.tier || 1),
      lastActive: u.lastActive || null,
    }));

    return res.json({ senderRole, recipients });
  } catch (err) {
    console.error('❌ Broadcast recipients failed:', err);
    return res.status(500).json({ error: 'Failed to load broadcast recipients.' });
  }
});

// ─── Broadcast: send ───────────────────────────────────────────────────────
// POST /api/messages/broadcast
// Body: { subject, messageBody, recipientIds: number[] }
router.post('/messages/broadcast', requireLoggedInUser, requireTrainerOrAdmin, async (req, res) => {
  try {
    const senderId = Number(req.session.user.id);
    const senderRole = normalizeRole(req.session.user?.roleSlug || req.session.user?.role || 'member');

    const rawSubject = String(req.body?.subject || '').trim();
    const rawBody    = String(req.body?.messageBody || '').trim();
    const rawIds     = req.body?.recipientIds;

    if (!rawSubject)  return res.status(400).json({ error: 'subject is required.' });
    if (rawSubject.length > 255) return res.status(400).json({ error: 'subject must be 255 characters or fewer.' });
    if (!rawBody)     return res.status(400).json({ error: 'messageBody is required.' });
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: 'recipientIds must be a non-empty array.' });
    }

    const MAX_RECIPIENTS = 500;
    const safeIds = [...new Set(
      rawIds.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n !== senderId)
    )].slice(0, MAX_RECIPIENTS);

    if (safeIds.length === 0) {
      return res.status(400).json({ error: 'No valid recipient IDs provided.' });
    }

    // Prevent duplicate broadcast (same sender + subject + body within 60 seconds)
    const [recentRows] = await pool.query(
      `SELECT id FROM broadcast_messages
       WHERE sender_id = ? AND subject = ? AND message_body = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)
       LIMIT 1`,
      [senderId, rawSubject, rawBody]
    );
    if (recentRows.length > 0) {
      return res.status(429).json({ error: 'Duplicate broadcast detected. Please wait before resending.' });
    }

    // Validate that all IDs are eligible for this sender role
    let eligibleSet;
    if (senderRole === 'admin') {
      const [rows] = await pool.query('SELECT id FROM users WHERE id IN (?)', [safeIds]);
      eligibleSet = new Set(rows.map((r) => Number(r.id)));
    } else {
      const [rows] = await pool.query(
        `SELECT DISTINCT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
         WHERE u.id IN (?)
           AND LOWER(TRIM(COALESCE(NULLIF(r.slug,''), r.name))) IN ('member','user')`,
        [safeIds]
      );
      eligibleSet = new Set(rows.map((r) => Number(r.id)));
    }

    const validIds = safeIds.filter((id) => eligibleSet.has(id));
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'None of the specified recipients are eligible for this broadcast.' });
    }

    // Send individual messages to each recipient via the existing message system
    const conversationRecords = [];
    const failedIds = [];

    for (const recipientId of validIds) {
      try {
        const result = await messageService.sendMessage({
          senderId,
          recipientUserId: recipientId,
          subject: rawSubject,
          messageBody: rawBody,
        });
        conversationRecords.push({ recipientId, conversationId: result.conversationId });
      } catch (sendErr) {
        console.error(`❌ [Broadcast] Failed to send to recipient ${recipientId}:`, sendErr?.message);
        failedIds.push(recipientId);
      }
    }

    const sent = conversationRecords.length;
    const status = sent === validIds.length ? 'sent' : sent > 0 ? 'partial' : 'failed';

    // Create audit record
    const [insertResult] = await pool.query(
      `INSERT INTO broadcast_messages
         (sender_id, subject, message_body, recipient_count, broadcast_type, status)
       VALUES (?, ?, ?, ?, 'TARGETED', ?)`,
      [senderId, rawSubject, rawBody, sent, status]
    );

    const broadcastId = insertResult.insertId;

    if (conversationRecords.length > 0) {
      const recipientRows = conversationRecords.map((r) => [broadcastId, r.recipientId, r.conversationId]);
      await pool.query(
        `INSERT INTO broadcast_message_recipients
           (broadcast_id, recipient_id, conversation_id)
         VALUES ?`,
        [recipientRows]
      );
    }

    return res.status(201).json({
      broadcastId,
      sent,
      failed: failedIds.length,
      total: validIds.length,
      status,
    });
  } catch (err) {
    console.error('❌ Broadcast send failed:', err);
    return res.status(500).json({ error: err?.message || 'Failed to send broadcast.' });
  }
});

// ─── Broadcast: history ────────────────────────────────────────────────────
// GET /api/messages/broadcast/history?limit=20&offset=0
// Admin sees all; trainer sees own only.
router.get('/messages/broadcast/history', requireLoggedInUser, requireTrainerOrAdmin, async (req, res) => {
  try {
    const userId     = Number(req.session.user.id);
    const senderRole = normalizeRole(req.session.user?.roleSlug || req.session.user?.role || 'member');

    const limit  = Math.min(Number(req.query.limit)  || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0,  0);

    const isAdmin = senderRole === 'admin';
    const whereClause = isAdmin ? '' : 'WHERE bm.sender_id = ?';
    const baseParams  = isAdmin ? [] : [userId];

    const [rows] = await pool.query(
      `SELECT
         bm.id,
         bm.subject,
         bm.recipient_count  AS recipientCount,
         bm.broadcast_type   AS broadcastType,
         bm.status,
         bm.created_at       AS createdAt,
         u.FirstName         AS senderFirstName,
         u.LastName          AS senderLastName,
         u.username          AS senderUsername
       FROM broadcast_messages bm
       JOIN users u ON u.id = bm.sender_id
       ${whereClause}
       ORDER BY bm.created_at DESC, bm.id DESC
       LIMIT ? OFFSET ?`,
      [...baseParams, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM broadcast_messages bm ${whereClause}`,
      baseParams
    );

    const items = rows.map((row) => ({
      id:             Number(row.id),
      subject:        String(row.subject || ''),
      recipientCount: Number(row.recipientCount || 0),
      broadcastType:  String(row.broadcastType || 'TARGETED'),
      status:         String(row.status || 'sent'),
      createdAt:      row.createdAt,
      sender: {
        displayName:
          [row.senderFirstName, row.senderLastName].filter(Boolean).join(' ').trim() ||
          row.senderUsername ||
          'Unknown',
        username: row.senderUsername,
      },
    }));

    return res.json({
      items,
      total:  Number(countRow?.total || 0),
      limit,
      offset,
    });
  } catch (err) {
    console.error('❌ Broadcast history failed:', err);
    return res.status(500).json({ error: 'Failed to fetch broadcast history.' });
  }
});

// ─── Broadcast: detail ─────────────────────────────────────────────────────
// GET /api/messages/broadcast/:broadcastId
router.get('/messages/broadcast/:broadcastId', requireLoggedInUser, requireTrainerOrAdmin, async (req, res) => {
  try {
    const userId      = Number(req.session.user.id);
    const senderRole  = normalizeRole(req.session.user?.roleSlug || req.session.user?.role || 'member');
    const broadcastId = Number(req.params.broadcastId);

    if (!Number.isFinite(broadcastId) || broadcastId <= 0) {
      return res.status(400).json({ error: 'Invalid broadcast ID.' });
    }

    const isAdmin    = senderRole === 'admin';
    const accessClause = isAdmin ? '' : 'AND bm.sender_id = ?';
    const queryParams  = isAdmin ? [broadcastId] : [broadcastId, userId];

    const [[broadcast]] = await pool.query(
      `SELECT
         bm.id,
         bm.subject,
         bm.message_body     AS messageBody,
         bm.recipient_count  AS recipientCount,
         bm.broadcast_type   AS broadcastType,
         bm.status,
         bm.created_at       AS createdAt,
         u.id                AS senderId,
         u.FirstName         AS senderFirstName,
         u.LastName          AS senderLastName,
         u.username          AS senderUsername
       FROM broadcast_messages bm
       JOIN users u ON u.id = bm.sender_id
       WHERE bm.id = ? ${accessClause}`,
      queryParams
    );

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found.' });
    }

    const [recipientRows] = await pool.query(
      `SELECT
         bmr.recipient_id    AS recipientId,
         bmr.conversation_id AS conversationId,
         u.FirstName         AS firstName,
         u.LastName          AS lastName,
         u.username
       FROM broadcast_message_recipients bmr
       JOIN users u ON u.id = bmr.recipient_id
       WHERE bmr.broadcast_id = ?
       ORDER BY u.FirstName, u.LastName`,
      [broadcastId]
    );

    return res.json({
      id:             Number(broadcast.id),
      subject:        broadcast.subject,
      messageBody:    broadcast.messageBody,
      recipientCount: Number(broadcast.recipientCount || 0),
      broadcastType:  broadcast.broadcastType,
      status:         broadcast.status,
      createdAt:      broadcast.createdAt,
      sender: {
        id:          Number(broadcast.senderId),
        displayName:
          [broadcast.senderFirstName, broadcast.senderLastName].filter(Boolean).join(' ').trim() ||
          broadcast.senderUsername,
        username: broadcast.senderUsername,
      },
      recipients: recipientRows.map((r) => ({
        userId:         Number(r.recipientId),
        conversationId: r.conversationId ? Number(r.conversationId) : null,
        displayName:
          [r.firstName, r.lastName].filter(Boolean).join(' ').trim() ||
          r.username ||
          `User ${r.recipientId}`,
      })),
    });
  } catch (err) {
    console.error('❌ Broadcast detail failed:', err);
    return res.status(500).json({ error: 'Failed to fetch broadcast details.' });
  }
});

router.get('/messages/:conversationId', requireLoggedInUser, messagesController.getConversationHistory.bind(messagesController));
router.post('/messages/send', requireLoggedInUser, checkSendPermissions, messagesController.sendMessage.bind(messagesController));

module.exports = router;