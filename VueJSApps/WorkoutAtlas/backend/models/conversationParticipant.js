class ConversationParticipant {
  constructor({
    id,
    conversationId,
    userId,
    role = 'MEMBER',
    createdAt = null,
  } = {}) {
    this.id = Number(id);
    this.conversationId = Number(conversationId);
    this.userId = Number(userId);
    this.role = String(role || 'MEMBER').toUpperCase();
    this.createdAt = createdAt;
  }

  static fromRow(row = {}) {
    return new ConversationParticipant({
      id: row.id,
      conversationId: row.conversationId ?? row.conversation_id,
      userId: row.userId ?? row.user_id,
      role: row.role,
      createdAt: row.createdAt ?? row.created_at ?? null,
    });
  }

  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      userId: this.userId,
      role: this.role,
      createdAt: this.createdAt,
    };
  }
}

module.exports = ConversationParticipant;class ConversationParticipant {
  constructor({
    id,
    conversationId,
    userId,
    role = 'MEMBER',
    createdAt = null,
  } = {}) {
    this.id = Number(id);
    this.conversationId = Number(conversationId);
    this.userId = Number(userId);
    this.role = String(role || 'MEMBER').toUpperCase();
    this.createdAt = createdAt;
  }

  static fromRow(row = {}) {
    return new ConversationParticipant({
      id: row.id,
      conversationId: row.conversationId ?? row.conversation_id,
      userId: row.userId ?? row.user_id,
      role: row.role,
      createdAt: row.createdAt ?? row.created_at ?? null,
    });
  }

  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      userId: this.userId,
      role: this.role,
      createdAt: this.createdAt,
    };
  }
}

module.exports = ConversationParticipant;