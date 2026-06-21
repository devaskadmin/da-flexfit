const pool = require('../db');
const Message = require('../models/message');
const conversationService = require('./conversationService');
const notificationService = require('./notificationService');
const emailService = require('./emailNotificationService');

const DEFAULT_LIMIT = 50;

const uniqueIds = (values = []) => {
  const normalized = [];
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0 && !normalized.includes(numericValue)) {
      normalized.push(numericValue);
    }
  }
  return normalized;
};

class MessageService {
  constructor(db = pool) {
    this.db = db;
  }

  async sendMessage({
    senderId,
    conversationId = null,
    recipientUserId = null,
    recipientUserIds = [],
    subject = null,
    messageBody,
    isSystemMessage = false,
    db = this.db,
  } = {}) {
    const numericSenderId = Number(senderId);
    if (!Number.isFinite(numericSenderId) || numericSenderId <= 0) {
      throw Object.assign(new Error('Invalid sender ID.'), { status: 400 });
    }

    const cleanBody = String(messageBody || '').trim();
    if (!cleanBody) {
      throw Object.assign(new Error('messageBody is required.'), { status: 400 });
    }

    let conversation = null;
    let targetConversationId = Number(conversationId) || null;

    if (targetConversationId) {
      conversation = await conversationService.findConversationById(targetConversationId, {
        db,
        userId: numericSenderId,
      });

      if (!conversation) {
        throw Object.assign(new Error('Conversation not found.'), { status: 404 });
      }
    } else {
      const recipientIds = uniqueIds([
        recipientUserId,
        ...(Array.isArray(recipientUserIds) ? recipientUserIds : []),
      ]);

      if (recipientIds.length !== 1) {
        throw Object.assign(new Error('A single recipient is required when creating a new conversation.'), { status: 400 });
      }

      conversation = await conversationService.getOrCreateDirectConversation({
        senderId: numericSenderId,
        recipientId: recipientIds[0],
        db,
      });
      targetConversationId = Number(conversation.id);
    }

    const [insertResult] = await db.query(
      `INSERT INTO messages
         (conversation_id, sender_id, subject, message_body, is_system_message, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        targetConversationId,
        numericSenderId,
        subject ? String(subject).trim().substring(0, 255) : null,
        cleanBody,
        Boolean(isSystemMessage) ? 1 : 0,
      ]
    );

    const messageId = insertResult.insertId;

    const [recipientRows] = await db.query(
      `SELECT user_id AS userId
       FROM conversation_participants
       WHERE conversation_id = ?
         AND user_id <> ?`,
      [targetConversationId, numericSenderId]
    );

    const recipientIds = uniqueIds(recipientRows.map((row) => row.userId));

    if (recipientIds.length > 0) {
      const statusRows = recipientIds.map((recipientId) => [messageId, recipientId, 0, null]);
      await db.query(
        `INSERT INTO message_status
           (message_id, user_id, is_read, read_at)
         VALUES ?`,
        [statusRows]
      );

      // Resolve sender display name for a human-readable notification message
      let senderLabel = 'Someone';
      try {
        const [nameRows] = await db.query(
          'SELECT FirstName, LastName, username FROM users WHERE id = ? LIMIT 1',
          [numericSenderId]
        );
        const nameRow = nameRows[0];
        if (nameRow) {
          const firstName = String(nameRow.FirstName || '').trim();
          const lastName = String(nameRow.LastName || '').trim();
          const fullName = `${firstName} ${lastName}`.trim();
          senderLabel = fullName || String(nameRow.username || '').trim() || 'Someone';
        }
      } catch { /* best-effort */ }

      await Promise.all(
        recipientIds.map((recipientId) => notificationService.createMessageNotification(
          recipientId,
          senderLabel,
          targetConversationId
        ))
      );

      // Send email notifications (best-effort, does not affect message delivery)
      for (const recipientId of recipientIds) {
        emailService.sendMessageEmail(
          recipientId,
          senderLabel,
          subject ? String(subject).trim().substring(0, 200) : 'New message',
          targetConversationId
        ).catch(() => {});
      }
    }

    await db.query(
      `UPDATE conversations
       SET updated_at = NOW()
       WHERE id = ?`,
      [targetConversationId]
    );

    return {
      conversationId: targetConversationId,
      message: Message.fromRow({
        id: messageId,
        conversationId: targetConversationId,
        senderId: numericSenderId,
        subject: subject ? String(subject).trim().substring(0, 255) : null,
        messageBody: cleanBody,
        isSystemMessage: Boolean(isSystemMessage),
        createdAt: new Date().toISOString(),
      }).toJSON(),
      recipients: recipientIds,
    };
  }

  async getConversationHistory({
    userId,
    conversationId,
    limit = DEFAULT_LIMIT,
    offset = 0,
    markAsRead = true,
    db = this.db,
  } = {}) {
    const numericUserId = Number(userId);
    const numericConversationId = Number(conversationId);

    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    if (!Number.isFinite(numericConversationId) || numericConversationId <= 0) {
      throw Object.assign(new Error('Invalid conversation ID.'), { status: 400 });
    }

    const conversation = await conversationService.findConversationById(numericConversationId, {
      db,
      userId: numericUserId,
      includeParticipants: true,
    });

    if (!conversation) {
      return null;
    }

    if (markAsRead) {
      await db.query(
        `UPDATE message_status ms
         JOIN messages m ON m.id = ms.message_id
         SET ms.is_read = 1,
             ms.read_at = COALESCE(ms.read_at, NOW())
         WHERE ms.user_id = ?
           AND m.conversation_id = ?
           AND ms.is_read = 0`,
        [numericUserId, numericConversationId]
      );
    }

    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const [rows] = await db.query(
      `SELECT
         m.id,
         m.conversation_id AS conversationId,
         m.sender_id AS senderId,
         m.subject,
         m.message_body AS messageBody,
         m.is_system_message AS isSystemMessage,
         m.created_at AS createdAt,
         COALESCE(ms.is_read, 0) AS isRead,
         ms.read_at AS readAt
       FROM messages m
       LEFT JOIN message_status ms
         ON ms.message_id = m.id
        AND ms.user_id = ?
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT ? OFFSET ?`,
      [numericUserId, numericConversationId, safeLimit, safeOffset]
    );

    return {
      conversation,
      items: rows.map((row) => Message.fromRow(row).toJSON()),
      total: rows.length,
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  async listMessages(userId, options = {}) {
    const conversationId = Number(options.conversationId);
    if (Number.isFinite(conversationId) && conversationId > 0) {
      return this.getConversationHistory({
        userId,
        conversationId,
        limit: options.limit,
        offset: options.offset,
        markAsRead: options.markAsRead,
        db: options.db || this.db,
      });
    }

    return conversationService.findConversationsForUser(userId, {
      limit: options.limit,
      offset: options.offset,
      db: options.db || this.db,
    });
  }

  async countUnreadMessages(userId, db = this.db) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    const [rows] = await db.query(
      `SELECT COUNT(*) AS unreadCount
       FROM message_status
       WHERE user_id = ?
         AND is_read = 0`,
      [numericUserId]
    );

    return Number(rows[0]?.unreadCount || 0);
  }
}

module.exports = new MessageService();