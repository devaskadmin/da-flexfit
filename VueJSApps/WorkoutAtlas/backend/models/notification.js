class Notification {
  constructor({
    id,
    userId,
    notificationType = 'SYSTEM',
    title = '',
    message = '',
    link = null,
    isRead = false,
    createdAt = null,
    updatedAt = null,
    readAt = null,
  } = {}) {
    this.id = Number(id);
    this.userId = Number(userId);
    this.notificationType = String(notificationType || 'SYSTEM').toUpperCase();
    this.title = String(title || '');
    this.message = String(message || '');
    this.link = link;
    this.isRead = Boolean(isRead);
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.readAt = readAt;
  }

  static fromRow(row = {}) {
    return new Notification({
      id: row.id,
      userId: row.userId ?? row.user_id,
      notificationType: row.notificationType ?? row.notification_type ?? row.type ?? 'SYSTEM',
      title: row.title,
      message: row.message,
      link: row.link ?? row.actionUrl ?? row.action_url ?? null,
      isRead: row.isRead ?? row.is_read ?? false,
      createdAt: row.createdAt ?? row.created_at ?? null,
      updatedAt: row.updatedAt ?? row.updated_at ?? null,
      readAt: row.readAt ?? row.read_at ?? null,
    });
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      notificationType: this.notificationType,
      title: this.title,
      message: this.message,
      link: this.link,
      isRead: this.isRead,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      readAt: this.readAt,
    };
  }
}

module.exports = Notification;