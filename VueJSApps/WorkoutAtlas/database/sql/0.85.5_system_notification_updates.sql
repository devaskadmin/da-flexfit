-- =============================================================================
-- WorkoutAtlas 0.85.5 – System Notification Updates
-- =============================================================================
-- Purpose:
--   Add performance indexes to the notifications table to support:
--     - Efficient cleanup of notifications older than 365 days
--     - Fast deduplication checks by type + creation time
--
-- No structural schema changes are required. The notification_type column is
-- VARCHAR(50) and already supports the new PROGRESS and ACCOUNT type values
-- added to the application in this release.
--
-- Safe to run multiple times (IF NOT EXISTS guards each index).
-- =============================================================================

-- Index: speed up cleanup DELETE WHERE created_at < ?
ALTER TABLE notifications
  ADD INDEX IF NOT EXISTS idx_notifications_created_at (created_at);

-- Index: speed up deduplication SELECT WHERE user_id + type + created_at
ALTER TABLE notifications
  ADD INDEX IF NOT EXISTS idx_notifications_user_type_created (user_id, notification_type, created_at);

-- =============================================================================
-- End of 0.85.5 migration
-- =============================================================================
