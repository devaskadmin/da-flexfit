class Message {
  constructor({
    id,
    conversationId,
    senderId,
    subject = null,
    messageBody = '',
    isSystemMessage = false,
    createdAt = null,
    isRead = false,
    readAt = null,
  } = {}) {
    this.id = Number(id);
    this.conversationId = Number(conversationId);
    this.senderId = Number(senderId);
    this.subject = subject;
    this.messageBody = String(messageBody || '');
    this.isSystemMessage = Boolean(isSystemMessage);
    this.createdAt = createdAt;
    this.isRead = Boolean(isRead);
    this.readAt = readAt;
  }

  static fromRow(row = {}) {
    return new Message({
      id: row.id,
      conversationId: row.conversationId ?? row.conversation_id,
      senderId: row.senderId ?? row.sender_id,
      subject: row.subject ?? null,
      messageBody: row.messageBody ?? row.message_body ?? '',
      isSystemMessage: row.isSystemMessage ?? row.is_system_message ?? false,
      createdAt: row.createdAt ?? row.created_at ?? null,
      isRead: row.isRead ?? row.is_read ?? false,
      readAt: row.readAt ?? row.read_at ?? null,
    });
  }

  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      senderId: this.senderId,
      subject: this.subject,
      messageBody: this.messageBody,
      isSystemMessage: this.isSystemMessage,
      createdAt: this.createdAt,
      isRead: this.isRead,
      readAt: this.readAt,
    };
  }
}

module.exports = Message;class Message {
  constructor({
    id,
    conversationId,
    senderId,
    subject = null,
    messageBody = '',
    isSystemMessage = false,
    createdAt = null,
    isRead = false,
    readAt = null,
  } = {}) {
    this.id = Number(id);
    this.conversationId = Number(conversationId);
    this.senderId = Number(senderId);
    this.subject = subject;
    this.messageBody = String(messageBody || '');
    this.isSystemMessage = Boolean(isSystemMessage);
    this.createdAt = createdAt;
    this.isRead = Boolean(isRead);
    this.readAt = readAt;
  }

  static fromRow(row = {}) {
    return new Message({
      id: row.id,
      conversationId: row.conversationId ?? row.conversation_id,
      senderId: row.senderId ?? row.sender_id,
      subject: row.subject ?? null,
      messageBody: row.messageBody ?? row.message_body ?? '',
      isSystemMessage: row.isSystemMessage ?? row.is_system_message ?? false,
      createdAt: row.createdAt ?? row.created_at ?? null,
      isRead: row.isRead ?? row.is_read ?? false,
      readAt: row.readAt ?? row.read_at ?? null,
    });
  }

  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      senderId: this.senderId,
      subject: this.subject,
      messageBody: this.messageBody,
      isSystemMessage: this.isSystemMessage,
      createdAt: this.createdAt,
      isRead: this.isRead,
      readAt: this.readAt,
    };
  }
}

module.exports = Message;