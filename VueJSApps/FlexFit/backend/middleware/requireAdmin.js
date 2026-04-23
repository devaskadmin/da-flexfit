/**
 * requireAdmin middleware
 * Ensures the request has an active session AND that the session user
 * holds the 'admin' role in the user_roles / roles tables.
 */
const pool = require('../db');

const ADMIN_ROLE_SLUGS = ['admin', 'administrator'];
const ADMIN_PROFILE_ROLES = ['admin', 'administrator'];

const requireAdmin = async (req, res, next) => {
  // 1. Must be logged in
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  try {
    const userId = req.session.user.id;
    let isAdmin = false;

    // 2a. Preferred source: user_roles -> roles
    try {
      const [rows] = await pool.query(
        `SELECT 1
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ?
           AND LOWER(TRIM(r.slug)) IN (?, ?)
           AND r.is_active = 1
         LIMIT 1`,
        [userId, ADMIN_ROLE_SLUGS[0], ADMIN_ROLE_SLUGS[1]]
      );
      isAdmin = rows.length > 0;
    } catch (rolesErr) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(rolesErr?.code)) {
        throw rolesErr;
      }
    }

    // 2b. Backward-compat fallback: user_profiles.user_role
    if (!isAdmin) {
      try {
        const [profileRows] = await pool.query(
          `SELECT 1
           FROM user_profiles
           WHERE user_id = ?
             AND LOWER(TRIM(user_role)) IN (?, ?)
           LIMIT 1`,
          [userId, ADMIN_PROFILE_ROLES[0], ADMIN_PROFILE_ROLES[1]]
        );
        isAdmin = profileRows.length > 0;
      } catch (profileErr) {
        if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(profileErr?.code)) {
          throw profileErr;
        }
      }
    }

    // 2c. Legacy fallback: users.membershipType = 'Admin'
    if (!isAdmin) {
      try {
        const [userRows] = await pool.query(
          `SELECT 1
           FROM users
           WHERE id = ?
             AND LOWER(TRIM(membershipType)) = 'admin'
           LIMIT 1`,
          [userId]
        );
        isAdmin = userRows.length > 0;
      } catch (userErr) {
        if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(userErr?.code)) {
          throw userErr;
        }
      }
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    next();
  } catch (err) {
    console.error('❌ requireAdmin error:', err);
    res.status(500).json({ error: 'Authorization check failed.' });
  }
};

module.exports = requireAdmin;
