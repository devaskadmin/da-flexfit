CREATE TABLE IF NOT EXISTS broadcast_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message_body TEXT NOT NULL,
  recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
  broadcast_type VARCHAR(50) NOT NULL DEFAULT 'TARGETED',
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_broadcast_sender_created (sender_id, created_at),
  CONSTRAINT fk_broadcast_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_message_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  broadcast_id BIGINT UNSIGNED NOT NULL,
  recipient_id INT NOT NULL,
  conversation_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_broadcast_recipient (broadcast_id, recipient_id),
  KEY idx_bcast_recip_conversation (broadcast_id, conversation_id),
  CONSTRAINT fk_bcast_recip_broadcast FOREIGN KEY (broadcast_id) REFERENCES broadcast_messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_bcast_recip_user FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
