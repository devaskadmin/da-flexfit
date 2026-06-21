-- Migration: Add avatar columns to users table
-- Created: 2026-04-30
-- Description: Adds avatarName and avatarPath columns to support custom user avatar selection

ALTER TABLE users
ADD COLUMN avatarName VARCHAR(255) NULL COMMENT 'Selected avatar filename',
ADD COLUMN avatarPath VARCHAR(500) NULL COMMENT 'Public URL path to avatar image';

-- Add index for faster avatar lookups
CREATE INDEX idx_users_avatar ON users(avatarName);
