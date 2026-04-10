-- Adds password-reset support columns required by forgot-password flow
-- Run this against your FlexFit database once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS USER_PASSWORD_RESET VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS USER_PASSWORD_RESET_CODE VARCHAR(255) NULL;
