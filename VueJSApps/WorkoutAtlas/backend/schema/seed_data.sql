-- =============================================================================
-- FlexFit – Seed Data
-- File: backend/schema/seed_data.sql
-- Purpose: Default seed records required for the application to function.
--          Includes roles, exercise categories, and reference lookup values.
--
-- Safe to run multiple times – all INSERTs use WHERE NOT EXISTS guards.
-- Run after base_schema.sql and before any user-specific data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core Roles
-- ---------------------------------------------------------------------------
INSERT INTO roles (name, slug, description, is_active)
SELECT 'Member', 'member', 'Standard user access', 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'member');

INSERT INTO roles (name, slug, description, is_active)
SELECT 'Trainer', 'trainer', 'Trainer access', 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'trainer');

INSERT INTO roles (name, slug, description, is_active)
SELECT 'Admin', 'admin', 'Administrator access', 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'admin');

-- ---------------------------------------------------------------------------
-- Placeholder: Exercise Categories, Muscle Groups, Equipment Types
-- Add lookup inserts here as reference tables are formalized.
-- ---------------------------------------------------------------------------
