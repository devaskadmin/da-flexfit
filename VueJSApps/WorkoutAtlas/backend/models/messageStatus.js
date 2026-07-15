class MessageStatus {
  constructor({
    id,
    messageId,
    userId,
    isRead = false,
    readAt = null,
  } = {}) {
    this.id = Number(id);
    this.messageId = Number(messageId);
    this.userId = Number(userId);
    this.isRead = Boolean(isRead);
    this.readAt = readAt;
  }

  static fromRow(row = {}) {
    return new MessageStatus({
      id: row.id,
      messageId: row.messageId ?? row.message_id,
      userId: row.userId ?? row.user_id,
      isRead: row.isRead ?? row.is_read ?? false,
      readAt: row.readAt ?? row.read_at ?? null,
    });
  }

  toJSON() {
    return {
      id: this.id,
      messageId: this.messageId,
      userId: this.userId,
      isRead: this.isRead,
      readAt: this.readAt,
    };
  }
}

module.exports = MessageStatus;