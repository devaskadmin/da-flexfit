const pool = require('../db');
const Conversation = require('../models/conversation');
const ConversationParticipant = require('../models/conversationParticipant');

const DEFAULT_ROLE = 'MEMBER';

const normalizeRole = (value) => {
  const role = String(value || '').trim().toUpperCase();
  if (!role) {
    return DEFAULT_ROLE;
  }
  if (['ADMIN', 'ADMINISTRATOR'].includes(role)) {
    return 'ADMIN';
  }
  if (role === 'TRAINER') {
    return 'TRAINER';
  }
  return DEFAULT_ROLE;
};

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

class ConversationService {
  constructor(db = pool) {
    this.db = db;
  }

  async resolveUserRole(userId, db = this.db) {
    const [rows] = await db.query(
      `SELECT LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) AS roleValue
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?
         AND r.is_active = 1
       ORDER BY CASE
         WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) IN ('admin', 'administrator') THEN 1
         WHEN LOWER(TRIM(COALESCE(NULLIF(r.slug, ''), r.name))) = 'trainer' THEN 2
         ELSE 3
       END,
       ur.assigned_at DESC,
       ur.id DESC
       LIMIT 1`,
      [userId]
    );

    if (!rows.length || !rows[0]?.roleValue) {
      return DEFAULT_ROLE;
    }

    return normalizeRole(rows[0].roleValue);
  }

  async createConversation({ conversationType = 'DIRECT', participants = [], db = this.db } = {}) {
    const normalizedType = String(conversationType || 'DIRECT').trim().toUpperCase() || 'DIRECT';
    const normalizedParticipants = uniqueIds(participants.map((participant) => participant?.userId ?? participant));

    if (normalizedParticipants.length < 2) {
      throw Object.assign(new Error('A conversation requires at least two participants.'), { status: 400 });
    }

    const [conversationResult] = await db.query(
      `INSERT INTO conversations (conversation_type)
       VALUES (?)`,
      [normalizedType]
    );

    const conversationId = conversationResult.insertId;
    const participantRows = [];

    for (const participant of participants) {
      const userId = Number(participant?.userId ?? participant);
      if (!Number.isFinite(userId) || userId <= 0) {
        continue;
      }

      const role = normalizeRole(participant?.role || DEFAULT_ROLE);
      participantRows.push([conversationId, userId, role]);
    }

    if (participantRows.length === 0) {
      throw Object.assign(new Error('Unable to add conversation participants.'), { status: 400 });
    }

    await db.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role)
       VALUES ?`,
      [participantRows]
    );

    return this.findConversationById(conversationId, { db, includeParticipants: true });
  }

  async getOrCreateDirectConversation({ senderId, recipientId, db = this.db } = {}) {
    const senderUserId = Number(senderId);
    const recipientUserId = Number(recipientId);

    if (!Number.isFinite(senderUserId) || senderUserId <= 0 || !Number.isFinite(recipientUserId) || recipientUserId <= 0) {
      throw Object.assign(new Error('A valid sender and recipient are required.'), { status: 400 });
    }

    const [existingRows] = await db.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
       WHERE c.conversation_type = 'DIRECT'
       GROUP BY c.id
       HAVING COUNT(*) = 2
          AND (SELECT COUNT(*) FROM conversation_participants cp3 WHERE cp3.conversation_id = c.id) = 2
       LIMIT 1`,
      [senderUserId, recipientUserId]
    );

    if (existingRows.length > 0) {
      return this.findConversationById(existingRows[0].id, { db, includeParticipants: true });
    }

    const senderRole = await this.resolveUserRole(senderUserId, db);
    const recipientRole = await this.resolveUserRole(recipientUserId, db);

    return this.createConversation({
      conversationType: 'DIRECT',
      participants: [
        { userId: senderUserId, role: senderRole },
        { userId: recipientUserId, role: recipientRole },
      ],
      db,
    });
  }

  async findConversationById(conversationId, { db = this.db, userId = null, includeParticipants = true } = {}) {
    const numericConversationId = Number(conversationId);
    if (!Number.isFinite(numericConversationId) || numericConversationId <= 0) {
      return null;
    }

    const params = [numericConversationId];
    let accessClause = '';
    if (Number.isFinite(Number(userId)) && Number(userId) > 0) {
      params.push(Number(userId));
      accessClause = 'AND EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = ?)';
    }

    const [rows] = await db.query(
      `SELECT
         c.id,
         c.conversation_type AS conversationType,
         c.created_at AS createdAt,
         c.updated_at AS updatedAt,
         (SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = c.id) AS participantCount,
         (SELECT COUNT(*)
            FROM messages m
            JOIN message_status ms ON ms.message_id = m.id
           WHERE m.conversation_id = c.id
             AND ms.user_id = ?
             AND ms.is_read = 0) AS unreadCount,
         (SELECT m.id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageId,
         (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageSenderId,
         (SELECT m.subject FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageSubject,
         (SELECT LEFT(m.message_body, 160) FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessagePreview,
         (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageCreatedAt
       FROM conversations c
       WHERE c.id = ?
       ${accessClause}
       LIMIT 1`,
      [Number(userId) || 0, ...params]
    );

    if (!rows.length) {
      return null;
    }

    const conversation = Conversation.fromRow(rows[0]).toJSON();

    if (!includeParticipants) {
      return conversation;
    }

    const participants = await this.listParticipants(numericConversationId, db);
    conversation.participants = participants.map((participant) => participant.toJSON());
    return conversation;
  }

  async listParticipants(conversationId, db = this.db) {
    const numericConversationId = Number(conversationId);
    if (!Number.isFinite(numericConversationId) || numericConversationId <= 0) {
      return [];
    }

    const [rows] = await db.query(
      `SELECT
         cp.id,
         cp.conversation_id AS conversationId,
         cp.user_id AS userId,
         cp.role,
         cp.created_at AS createdAt
       FROM conversation_participants cp
       WHERE cp.conversation_id = ?
       ORDER BY cp.id ASC`,
      [numericConversationId]
    );

    return rows.map((row) => ConversationParticipant.fromRow(row));
  }

  async findConversationsForUser(userId, { limit = 50, offset = 0, db = this.db } = {}) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT c.id) AS total
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = ?`,
      [numericUserId]
    );

    const [rows] = await db.query(
      `SELECT
         c.id,
         c.conversation_type AS conversationType,
         c.created_at AS createdAt,
         c.updated_at AS updatedAt,
         (SELECT COUNT(*) FROM conversation_participants cp2 WHERE cp2.conversation_id = c.id) AS participantCount,
         (SELECT COUNT(*)
            FROM messages m
            JOIN message_status ms ON ms.message_id = m.id
           WHERE m.conversation_id = c.id
             AND ms.user_id = ?
             AND ms.is_read = 0) AS unreadCount,
         (SELECT m.id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageId,
         (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageSenderId,
         (SELECT m.subject FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageSubject,
         (SELECT LEFT(m.message_body, 160) FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessagePreview,
         (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS lastMessageCreatedAt
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = ?
       GROUP BY c.id
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [numericUserId, numericUserId, safeLimit, safeOffset]
    );

    const conversationIds = rows.map((row) => Number(row.id));
    const participants = conversationIds.length > 0
      ? await this.getParticipantsByConversationIds(conversationIds, db)
      : [];

    const participantMap = new Map();
    for (const participant of participants) {
      const key = Number(participant.conversationId);
      if (!participantMap.has(key)) {
        participantMap.set(key, []);
      }
      participantMap.get(key).push(participant.toJSON());
    }

    const items = rows.map((row) => {
      const conversation = Conversation.fromRow(row).toJSON();
      conversation.participants = participantMap.get(Number(conversation.id)) || [];
      conversation.lastMessage = row.lastMessageId
        ? {
            id: Number(row.lastMessageId),
            senderId: Number(row.lastMessageSenderId || 0) || null,
            subject: row.lastMessageSubject || null,
            messageBodyPreview: row.lastMessagePreview || null,
            createdAt: row.lastMessageCreatedAt || null,
          }
        : null;
      return conversation;
    });

    return {
      items,
      total: Number(countRows[0]?.total || 0),
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  async getParticipantsByConversationIds(conversationIds, db = this.db) {
    const ids = uniqueIds(conversationIds);
    if (ids.length === 0) {
      return [];
    }

    const [rows] = await db.query(
      `SELECT
         cp.id,
         cp.conversation_id AS conversationId,
         cp.user_id AS userId,
         cp.role,
         cp.created_at AS createdAt
       FROM conversation_participants cp
       WHERE cp.conversation_id IN (?)
       ORDER BY cp.conversation_id ASC, cp.id ASC`,
      [ids]
    );

    return rows.map((row) => ConversationParticipant.fromRow(row));
  }
}

module.exports = new ConversationService();