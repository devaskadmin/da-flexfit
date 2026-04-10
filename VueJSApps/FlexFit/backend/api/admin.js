/**
 * Admin – Member Management API
 * All routes require an active session + admin role (via requireAdmin middleware).
 *
 * Endpoints:
 *  GET    /api/admin/members            – paginated list with profile + membership
 *  GET    /api/admin/members/:id        – single member full detail
 *  POST   /api/admin/members            – create a new member (admin flow)
 *  PUT    /api/admin/members/:id        – edit core profile fields
 *  PATCH  /api/admin/members/:id/role   – assign / change role
 *  PATCH  /api/admin/members/:id/membership – change tier / status / billing
 *  PATCH  /api/admin/members/:id/credit – grant a manual membership credit
 *  DELETE /api/admin/members/:id        – soft-delete (or hard-delete)
 */

const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const requireAdmin = require('../middleware/requireAdmin');
const pool       = require('../db');
const { sanitizeText } = require('../utils/sanitize');

// Apply admin guard to every route in this file
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────────────
// Shared helper – full member SELECT
// ─────────────────────────────────────────────────────────────────
const MEMBER_SELECT = `
  SELECT
    u.id,
    u.FirstName,
    u.LastName,
    u.username,
    up.user_role,
    up.tier,
    up.settings,
    mt.name        AS tier_name,
    mt.slug        AS tier_slug,
    um.status      AS membership_status,
    um.billing_cycle,
    um.started_at,
    um.expires_at,
    um.payment_ref,
    GROUP_CONCAT(r.slug ORDER BY r.slug SEPARATOR ',') AS roles
  FROM users u
  LEFT JOIN user_profiles    up ON up.user_id    = u.id
  LEFT JOIN user_memberships um ON um.user_id    = u.id
  LEFT JOIN membership_tiers mt ON mt.id         = up.tier
  LEFT JOIN user_roles       ur ON ur.user_id    = u.id
  LEFT JOIN roles            r  ON r.id          = ur.role_id
`;

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/members
// Query params: ?page=1&limit=20&search=name&role=admin&tier=2
// ─────────────────────────────────────────────────────────────────
router.get('/members', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const role   = req.query.role   || null;
    const tier   = req.query.tier   ? parseInt(req.query.tier) : null;

    let where  = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (u.FirstName LIKE ? OR u.LastName LIKE ? OR u.username LIKE ?)';
      params.push(search, search, search);
    }
    if (role) {
      where += ' AND EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON r2.id=ur2.role_id WHERE ur2.user_id=u.id AND r2.slug=?)';
      params.push(role);
    }
    if (tier) {
      where += ' AND up.tier = ?';
      params.push(tier);
    }

    const [rows] = await pool.query(
      `${MEMBER_SELECT} ${where} GROUP BY u.id ORDER BY u.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(DISTINCT u.id) AS total FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN user_roles    ur ON ur.user_id = u.id
       LEFT JOIN roles          r ON r.id       = ur.role_id
       ${where}`,
      params
    );

    res.json({ data: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('❌ admin/members list:', err);
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/members/:id
// ─────────────────────────────────────────────────────────────────
router.get('/members/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${MEMBER_SELECT} WHERE u.id = ? GROUP BY u.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ admin/members/:id:', err);
    res.status(500).json({ error: 'Failed to fetch member.' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/members  –  Admin creates a new member
// Body: { firstName, lastName, username, password, role, tier, billingCycle }
// ─────────────────────────────────────────────────────────────────
router.post('/members', async (req, res) => {
  const { firstName, lastName, username, password,
          role = 'member', tier = 1, billingCycle = 'none' } = req.body;

  if (!firstName || !lastName || !username || !password) {
    return res.status(400).json({ error: 'firstName, lastName, username, password are required.' });
  }

  const safeFirst = sanitizeText(firstName, 100);
  const safeLast  = sanitizeText(lastName,  100);
  const safeUser  = sanitizeText(username,  100);
  const safePwd   = await bcrypt.hash(password, 10);
  const safeTier  = parseInt(tier) || 1;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[exists]] = await conn.query('SELECT id FROM users WHERE username = ?', [safeUser]);
    if (exists) {
      await conn.rollback();
      return res.status(409).json({ error: 'Username already exists.' });
    }

    // 1. users
    const [userRes] = await conn.query(
      'INSERT INTO users (FirstName, LastName, username, Password) VALUES (?, ?, ?, ?)',
      [safeFirst, safeLast, safeUser, safePwd]
    );
    const uid = userRes.insertId;

    // 2. user_profiles
    await conn.query(
      `INSERT INTO user_profiles (user_id, user_role, tier, settings) VALUES (?, ?, ?, '[]')`,
      [uid, role, safeTier]
    );

    // 3. user_memberships
    const expires = billingCycle === 'monthly'
      ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      : billingCycle === 'yearly'
        ? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
        : null;

    await conn.query(
      `INSERT INTO user_memberships (user_id, tier_id, status, billing_cycle, started_at, expires_at)
       VALUES (?, ?, 'active', ?, CURDATE(), ?)`,
      [uid, safeTier, billingCycle, expires]
    );

    // 4. user_roles pivot
    await conn.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       SELECT ?, id, ? FROM roles WHERE slug = ? LIMIT 1`,
      [uid, req.session.user.id, role]
    );

    await conn.commit();
    res.status(201).json({ message: 'Member created.', userId: uid });
  } catch (err) {
    await conn.rollback();
    console.error('❌ admin/members POST:', err);
    res.status(500).json({ error: 'Failed to create member.' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/admin/members/:id  –  Edit core profile fields
// Body: { firstName, lastName, username, settings }
// ─────────────────────────────────────────────────────────────────
router.put('/members/:id', async (req, res) => {
  const { firstName, lastName, username, settings } = req.body;
  const uid = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (firstName || lastName || username) {
      const updates = [];
      const vals    = [];
      if (firstName) { updates.push('FirstName = ?'); vals.push(sanitizeText(firstName, 100)); }
      if (lastName)  { updates.push('LastName = ?');  vals.push(sanitizeText(lastName,  100)); }
      if (username)  { updates.push('username = ?');  vals.push(sanitizeText(username,  100)); }
      vals.push(uid);
      await conn.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, vals);
    }

    if (settings !== undefined) {
      await conn.query(
        'UPDATE user_profiles SET settings = ? WHERE user_id = ?',
        [typeof settings === 'string' ? settings : JSON.stringify(settings), uid]
      );
    }

    await conn.commit();
    res.json({ message: 'Member updated.' });
  } catch (err) {
    await conn.rollback();
    console.error('❌ admin/members PUT:', err);
    res.status(500).json({ error: 'Failed to update member.' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/admin/members/:id/role  –  Assign / change role
// Body: { role: 'coach' }   (slug from roles table)
// ─────────────────────────────────────────────────────────────────
router.patch('/members/:id/role', async (req, res) => {
  const { role } = req.body;
  const uid = req.params.id;

  if (!role) return res.status(400).json({ error: 'role is required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get role id
    const [[roleRow]] = await conn.query('SELECT id FROM roles WHERE slug = ? AND is_active = 1', [role]);
    if (!roleRow) {
      await conn.rollback();
      return res.status(404).json({ error: `Role '${role}' not found.` });
    }

    // Upsert user_roles
    await conn.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by), assigned_at = NOW()`,
      [uid, roleRow.id, req.session.user.id]
    );

    // Sync user_profiles.user_role
    await conn.query('UPDATE user_profiles SET user_role = ? WHERE user_id = ?', [role, uid]);

    await conn.commit();
    res.json({ message: `Role updated to '${role}'.` });
  } catch (err) {
    await conn.rollback();
    console.error('❌ admin/members/role PATCH:', err);
    res.status(500).json({ error: 'Failed to update role.' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/admin/members/:id/membership  –  Change tier / status / billing
// Body: { tier, status, billingCycle, expiresAt, paymentRef }
// ─────────────────────────────────────────────────────────────────
router.patch('/members/:id/membership', async (req, res) => {
  const { tier, status, billingCycle, expiresAt, paymentRef } = req.body;
  const uid = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const umUpdates = [];
    const umVals    = [];

    if (tier) {
      umUpdates.push('tier_id = ?');
      umVals.push(parseInt(tier));
      await conn.query('UPDATE user_profiles SET tier = ? WHERE user_id = ?', [parseInt(tier), uid]);
    }
    if (status)       { umUpdates.push('status = ?');        umVals.push(status); }
    if (billingCycle) { umUpdates.push('billing_cycle = ?'); umVals.push(billingCycle); }
    if (expiresAt)    { umUpdates.push('expires_at = ?');    umVals.push(expiresAt); }
    if (paymentRef)   { umUpdates.push('payment_ref = ?');   umVals.push(paymentRef); }

    if (umUpdates.length) {
      umVals.push(uid);
      await conn.query(
        `UPDATE user_memberships SET ${umUpdates.join(', ')} WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
        umVals
      );
    }

    await conn.commit();
    res.json({ message: 'Membership updated.' });
  } catch (err) {
    await conn.rollback();
    console.error('❌ admin/members/membership PATCH:', err);
    res.status(500).json({ error: 'Failed to update membership.' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/admin/members/:id/credit
// Grants a manual membership credit: upgrades tier and extends expiry
// Body: { tier, days, note }   e.g. { tier: 2, days: 30, note: 'Promo code' }
// ─────────────────────────────────────────────────────────────────
router.patch('/members/:id/credit', async (req, res) => {
  const { tier = null, days = 30, note = '' } = req.body;
  const uid = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch current membership
    const [[current]] = await conn.query(
      'SELECT tier_id, expires_at FROM user_memberships WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [uid]
    );

    const newTier    = tier ? parseInt(tier) : (current?.tier_id || 1);
    const baseDate   = current?.expires_at && new Date(current.expires_at) > new Date()
      ? new Date(current.expires_at)
      : new Date();
    const newExpiry  = new Date(baseDate.getTime() + parseInt(days) * 86400000)
                         .toISOString().slice(0, 10);
    const creditNote = note ? `[CREDIT +${days}d] ${note}` : `[CREDIT +${days}d by admin]`;

    await conn.query(
      `UPDATE user_memberships
       SET tier_id = ?, status = 'active', expires_at = ?, notes = CONCAT(IFNULL(notes,''), '\n', ?)
       WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [newTier, newExpiry, creditNote, uid]
    );

    await conn.query('UPDATE user_profiles SET tier = ? WHERE user_id = ?', [newTier, uid]);

    await conn.commit();
    res.json({ message: `Credit applied. Tier ${newTier}, expires ${newExpiry}.`, expiresAt: newExpiry });
  } catch (err) {
    await conn.rollback();
    console.error('❌ admin/members/credit PATCH:', err);
    res.status(500).json({ error: 'Failed to apply credit.' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/members/:id
// ─────────────────────────────────────────────────────────────────
router.delete('/members/:id', async (req, res) => {
  const uid = req.params.id;

  // Prevent admin from deleting themselves
  if (parseInt(uid) === req.session.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account via admin.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // FK CASCADE handles child rows; just delete the user
    await conn.query('DELETE FROM users WHERE id = ?', [uid]);
    await conn.commit();
    res.json({ message: 'Member deleted.' });
  } catch (err) {
    await conn.rollback();
    console.error('❌ admin/members DELETE:', err);
    res.status(500).json({ error: 'Failed to delete member.' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/roles  –  List all available roles (for dropdowns)
// ─────────────────────────────────────────────────────────────────
router.get('/roles', async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const sql = includeInactive
      ? 'SELECT id, name, slug, description, is_active, created_at FROM roles ORDER BY id'
      : 'SELECT id, name, slug, description, is_active, created_at FROM roles WHERE is_active = 1 ORDER BY id';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles.' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/roles  –  Create a role
// Body: { name, slug, description, isActive }
// ─────────────────────────────────────────────────────────────────
router.post('/roles', async (req, res) => {
  try {
    const { name, slug, description = '', isActive = 1 } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required.' });
    }

    const safeName = sanitizeText(name, 50);
    const safeSlug = sanitizeText(slug, 50)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
    const safeDesc = sanitizeText(description, 255);

    const [existing] = await pool.query('SELECT id FROM roles WHERE slug = ? LIMIT 1', [safeSlug]);
    if (existing.length) {
      return res.status(409).json({ error: 'Role slug already exists.' });
    }

    const [result] = await pool.query(
      'INSERT INTO roles (name, slug, description, is_active) VALUES (?, ?, ?, ?)',
      [safeName, safeSlug, safeDesc, isActive ? 1 : 0]
    );

    res.status(201).json({ message: 'Role created.', roleId: result.insertId });
  } catch (err) {
    console.error('❌ admin/roles POST:', err);
    res.status(500).json({ error: 'Failed to create role.' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/admin/roles/:id  –  Update role
// Body: { name, slug, description, isActive }
// ─────────────────────────────────────────────────────────────────
router.put('/roles/:id', async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    const { name, slug, description, isActive } = req.body;

    // Block editing protected system roles
    const [[existing]] = await pool.query('SELECT slug, name FROM roles WHERE id = ? LIMIT 1', [roleId]);
    if (!existing) return res.status(404).json({ error: 'Role not found.' });
    if (PROTECTED_ROLE_SLUGS.includes(existing.slug)) {
      return res.status(403).json({
        error: `The "${existing.name}" role is a built-in system role and cannot be edited.`,
      });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(sanitizeText(name, 50));
    }
    if (slug !== undefined) {
      const safeSlug = sanitizeText(slug, 50)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
      updates.push('slug = ?');
      values.push(safeSlug);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(sanitizeText(description, 255));
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    values.push(roleId);
    await pool.query(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Role updated.' });
  } catch (err) {
    console.error('❌ admin/roles PUT:', err);
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/roles/:id  –  Delete a role
// Protected slugs: member, trainer, admin (built-in system roles)
// ─────────────────────────────────────────────────────────────────
const PROTECTED_ROLE_SLUGS = ['member', 'trainer', 'admin'];

router.delete('/roles/:id', async (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    if (!roleId) return res.status(400).json({ error: 'Invalid role id.' });

    // Fetch role
    const [[role]] = await pool.query('SELECT id, name, slug FROM roles WHERE id = ? LIMIT 1', [roleId]);
    if (!role) return res.status(404).json({ error: 'Role not found.' });

    // Block protected system roles
    if (PROTECTED_ROLE_SLUGS.includes(role.slug)) {
      return res.status(403).json({
        error: `The "${role.name}" role is a built-in system role and cannot be deleted.`,
      });
    }

    // Remove pivot assignments first, then delete the role
    await pool.query('DELETE FROM user_roles WHERE role_id = ?', [roleId]);
    await pool.query('DELETE FROM roles WHERE id = ?', [roleId]);

    res.json({ message: 'Role deleted.' });
  } catch (err) {
    console.error('❌ admin/roles DELETE:', err);
    res.status(500).json({ error: 'Failed to delete role.' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/tiers  –  List all membership tiers (for dropdowns)
// ─────────────────────────────────────────────────────────────────
router.get('/tiers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug, price_monthly, price_yearly FROM membership_tiers WHERE is_active = 1 ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tiers.' });
  }
});

module.exports = router;
