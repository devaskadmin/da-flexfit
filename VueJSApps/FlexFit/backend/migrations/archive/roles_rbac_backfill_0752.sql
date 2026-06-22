-- FlexFit 0.75.2 RBAC role-source correction
-- Purpose:
--   1) Ensure base role slugs exist in roles
--   2) Backfill missing user_roles mappings so access control is driven by user_roles
--
-- Notes:
--   - Runtime authorization now reads from user_roles -> roles only.
--   - This script can be run safely multiple times.

START TRANSACTION;

-- Ensure core roles exist
INSERT INTO roles (name, slug, description, is_active)
SELECT 'Member', 'member', 'Standard user access', 1
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE LOWER(TRIM(slug)) = 'member'
);

INSERT INTO roles (name, slug, description, is_active)
SELECT 'Trainer', 'trainer', 'Trainer access', 1
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE LOWER(TRIM(slug)) = 'trainer'
);

INSERT INTO roles (name, slug, description, is_active)
SELECT 'Admin', 'admin', 'Administrator access', 1
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE LOWER(TRIM(slug)) IN ('admin', 'administrator')
);

-- Backfill user_roles from user_profiles.user_role (preferred legacy signal)
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  up.user_id,
  r.id AS role_id,
  up.user_id AS assigned_by
FROM user_profiles up
JOIN roles r
  ON LOWER(TRIM(r.slug)) = CASE
    WHEN LOWER(TRIM(COALESCE(up.user_role, ''))) IN ('admin', 'administrator') THEN 'admin'
    WHEN LOWER(TRIM(COALESCE(up.user_role, ''))) = 'trainer' THEN 'trainer'
    ELSE 'member'
  END
LEFT JOIN user_roles ur
  ON ur.user_id = up.user_id AND ur.role_id = r.id
WHERE ur.id IS NULL;

-- Backfill from users.membershipType only for users that still have zero user_roles
-- membershipType is only used here as a one-time fallback for legacy users. All access control is now via user_roles/roles (RBAC).
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  u.id AS user_id,
  r.id AS role_id,
  u.id AS assigned_by
FROM users u
JOIN roles r
  ON LOWER(TRIM(r.slug)) = CASE
    WHEN LOWER(TRIM(COALESCE(u.membershipType, ''))) IN ('admin', 'administrator') THEN 'admin'
    WHEN LOWER(TRIM(COALESCE(u.membershipType, ''))) = 'trainer' THEN 'trainer'
    ELSE 'member'
  END
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles urx WHERE urx.user_id = u.id
);

COMMIT;
