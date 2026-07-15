class Conversation {
  constructor({
    id,
    conversationType = 'DIRECT',
    createdAt = null,
    updatedAt = null,
    participantCount = 0,
    unreadCount = 0,
    lastMessage = null,
    participants = [],
  } = {}) {
    this.id = Number(id);
    this.conversationType = String(conversationType || 'DIRECT').toUpperCase();
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.participantCount = Number(participantCount || 0);
    this.unreadCount = Number(unreadCount || 0);
    this.lastMessage = lastMessage;
    this.participants = participants;
  }

  static fromRow(row = {}) {
    return new Conversation({
      id: row.id,
      conversationType: row.conversationType ?? row.conversation_type,
      createdAt: row.createdAt ?? row.created_at ?? null,
      updatedAt: row.updatedAt ?? row.updated_at ?? null,
      participantCount: row.participantCount ?? row.participant_count ?? 0,
      unreadCount: row.unreadCount ?? row.unread_count ?? 0,
      lastMessage: row.lastMessage || null,
      participants: Array.isArray(row.participants) ? row.participants : [],
    });
  }

  toJSON() {
    return {
      id: this.id,
      conversationType: this.conversationType,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      participantCount: this.participantCount,
      unreadCount: this.unreadCount,
      lastMessage: this.lastMessage,
      participants: this.participants,
    };
  }
}

module.exports = Conversation;