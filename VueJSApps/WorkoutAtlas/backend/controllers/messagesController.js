const messageService = require('../services/messageService');
const { parseNumber, sanitizeText } = require('../utils/sanitize');

const parseRecipientIds = (body = {}) => {
  const candidates = [];

  if (body.recipientUserId !== undefined && body.recipientUserId !== null) {
    candidates.push(body.recipientUserId);
  }

  if (Array.isArray(body.recipientUserIds)) {
    candidates.push(...body.recipientUserIds);
  }

  return candidates
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
};

class MessagesController {
  async listConversations(req, res) {
    try {
      const userId = req.session.user.id;
      const requestedLimit = parseNumber(req.query.limit);
      const requestedOffset = parseNumber(req.query.offset);

      const result = await messageService.listMessages(userId, {
        limit: requestedLimit || 50,
        offset: requestedOffset || 0,
      });

      return res.json(result);
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to list conversations:', error);
      return res.status(status).json({ error: error?.message || 'Failed to list conversations.' });
    }
  }

  async getConversationHistory(req, res) {
    try {
      const userId = req.session.user.id;
      const conversationId = parseNumber(req.params.conversationId);

      if (!conversationId) {
        return res.status(400).json({ error: 'Invalid conversation ID.' });
      }

      const result = await messageService.getConversationHistory({
        userId,
        conversationId,
        limit: parseNumber(req.query.limit) || 100,
        offset: parseNumber(req.query.offset) || 0,
        markAsRead: true,
      });

      if (!result) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      return res.json(result);
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to load conversation history:', error);
      return res.status(status).json({ error: error?.message || 'Failed to load conversation history.' });
    }
  }

  async sendMessage(req, res) {
    try {
      const senderId = req.session.user.id;
      const conversationId = parseNumber(req.body?.conversationId);
      const subject = sanitizeText(req.body?.subject || '', 255);
      const messageBody = sanitizeText(req.body?.messageBody || req.body?.message || '', 5000);
      const recipientIds = parseRecipientIds(req.body || {});

      if (!messageBody) {
        return res.status(400).json({ error: 'messageBody is required.' });
      }

      const result = await messageService.sendMessage({
        senderId,
        conversationId,
        recipientUserId: recipientIds[0] || null,
        recipientUserIds: recipientIds,
        subject,
        messageBody,
        isSystemMessage: Boolean(req.body?.isSystemMessage),
      });

      return res.status(201).json({
        message: 'Message sent successfully.',
        ...result,
      });
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to send message:', error);
      return res.status(status).json({ error: error?.message || 'Failed to send message.' });
    }
  }

  async getUnreadCount(req, res) {
    try {
      const unreadCount = await messageService.countUnreadMessages(req.session.user.id);
      return res.json({ unreadCount });
    } catch (error) {
      const status = error?.status || 500;
      console.error('❌ Failed to load message unread count:', error);
      return res.status(status).json({ error: error?.message || 'Failed to load unread count.' });
    }
  }
}

module.exports = new MessagesController();