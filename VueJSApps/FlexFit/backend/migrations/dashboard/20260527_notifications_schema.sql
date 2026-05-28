-- Notifications schema for per-user in-app notifications
-- MySQL 8+

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'system',
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(255) NULL,
  metadata JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_read (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional user notification preferences table.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INT NOT NULL,
  workout_reminders TINYINT(1) NOT NULL DEFAULT 1,
  nutrition_reminders TINYINT(1) NOT NULL DEFAULT 1,
  weekly_report TINYINT(1) NOT NULL DEFAULT 1,
  streak_alerts TINYINT(1) NOT NULL DEFAULT 1,
  coach_messages TINYINT(1) NOT NULL DEFAULT 1,
  product_updates TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_notification_preferences_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed a few sample notifications for one user (replace 1 with a real user id)
-- INSERT INTO notifications (user_id, type, title, message, action_url)
-- VALUES
--   (1, 'workout', 'Workout reminder', 'Your Upper Body session starts in 30 minutes.', '/workouts'),
--   (1, 'nutrition', 'Nutrition reminder', 'Don\'t forget to log lunch.', '/Nutrition'),
--   (1, 'system', 'Welcome', 'Your account notification center is ready.', '/notifications');
