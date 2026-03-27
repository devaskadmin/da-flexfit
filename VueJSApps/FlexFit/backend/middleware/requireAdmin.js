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
    // 2. Must have admin role
    const [rows] = await pool.query(
      `SELECT 1
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.slug = 'admin' AND r.is_active = 1
       LIMIT 1`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    next();
  } catch (err) {
    console.error('❌ requireAdmin error:', err);
    res.status(500).json({ error: 'Authorization check failed.' });
  }
};

module.exports = requireAdmin;
