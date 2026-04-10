/**
 * requireAdmin middleware
 * Ensures the request has an active session AND that the session user
 * holds the 'admin' role in the user_roles / roles tables.
 */
const pool = require('../db');

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
           AND LOWER(TRIM(r.slug)) = 'admin'
           AND r.is_active = 1
         LIMIT 1`,
        [userId]
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
             AND LOWER(TRIM(user_role)) = 'admin'
           LIMIT 1`,
          [userId]
        );
        isAdmin = profileRows.length > 0;
      } catch (profileErr) {
        if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(profileErr?.code)) {
          throw profileErr;
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
