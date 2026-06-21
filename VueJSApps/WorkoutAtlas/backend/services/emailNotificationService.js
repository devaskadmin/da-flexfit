/**
 * WorkoutAtlas 0.85.6 – Email Notification Service
 *
 * Sends transactional emails for important account events.
 * All sends are best-effort (fire-and-forget) except sendPasswordResetEmail(),
 * which re-throws on SMTP misconfiguration so the reset route can return 500.
 *
 * Email templates are loaded from backend/templates/email/ at module startup
 * (cached in memory). Variables are interpolated with {{VARIABLE_NAME}} syntax.
 *
 * User email preferences are read from user_profiles.settings.emailNotifications.
 * Defaults: all enabled. If no email address is found for the user, the send is
 * silently skipped.
 *
 * SMTP configuration via environment variables:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const pool = require('../db');

// ── Template loading (cached at startup) ─────────────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, '../templates/email');

const loadTemplate = (filename) => {
  try {
    return fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf8');
  } catch (err) {
    console.error(`[EmailService] Template not found: ${filename} — ${err.message}`);
    return null;
  }
};

const TEMPLATES = {
  message:    loadTemplate('message-template.html'),
  workout:    loadTemplate('workout-template.html'),
  nutrition:  loadTemplate('nutrition-template.html'),
  membership: loadTemplate('membership-template.html'),
  admin:      loadTemplate('admin-template.html'),
  account:    loadTemplate('account-template.html'),
};

// ── Transport ─────────────────────────────────────────────────────────────────

const buildTransport = () => {
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch { return null; }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

// Lazy-initialized; reset to null when SMTP env vars change (restart required).
let _transporter = null;
const getTransporter = () => {
  if (_transporter) return _transporter;
  _transporter = buildTransport();
  return _transporter;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SITE_URL = () =>
  process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || 'https://workoutatlas.com';

const FROM_ADDRESS = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@workoutatlas.com';

/**
 * Replace all {{KEY}} placeholders in a template string with vars[KEY].
 * Unknown placeholders are replaced with an empty string.
 */
const render = (template, vars) => {
  if (!template) return null;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : ''
  );
};

/**
 * Send a raw email. Returns true on success, false if SMTP is not configured.
 * Never throws — callers should handle null/false silently.
 */
const sendRawEmail = async (to, subject, html) => {
  const transporter = getTransporter();
  if (!transporter) return false;

  const text = html
    ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : subject;

  await transporter.sendMail({
    from: FROM_ADDRESS(),
    to,
    subject,
    html,
    text,
  });
  return true;
};

/**
 * Fetch a user's email address and their email notification preferences.
 * Returns null if the user doesn't exist or has no valid email address.
 *
 * Email is resolved as: users.Email → users.username (fallback when username
 * is stored as an email address, which is common on this install).
 *
 * Preferences default to all-enabled when no settings record exists.
 */
const getUserEmailInfo = async (userId) => {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  // 1. Resolve email address
  let email = null;
  try {
    const [rows] = await pool.query(
      'SELECT Email, username FROM users WHERE id = ? LIMIT 1',
      [uid]
    );
    const row = rows[0];
    if (!row) return null;
    const candidate = String(row.Email || row.username || '').trim();
    // Only treat value as an email if it contains @
    if (!candidate || !candidate.includes('@')) return null;
    email = candidate;
  } catch {
    return null;
  }

  // 2. Resolve email preferences (defaults: all enabled)
  let prefs = {
    enabled: true,
    messages: true,
    workouts: true,
    nutrition: true,
    membership: true,
    admin: true,
  };
  try {
    const [pRows] = await pool.query(
      'SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1',
      [uid]
    );
    const raw = pRows[0]?.settings;
    const parsed = typeof raw === 'string' && raw.trim()
      ? JSON.parse(raw)
      : (raw && typeof raw === 'object' ? raw : {});

    if (parsed.emailNotifications && typeof parsed.emailNotifications === 'object') {
      const ep = parsed.emailNotifications;
      prefs = {
        enabled:    ep.enabled    !== false,
        messages:   ep.messages   !== false,
        workouts:   ep.workouts   !== false,
        nutrition:  ep.nutrition  !== false,
        membership: ep.membership !== false,
        admin:      ep.admin      !== false,
      };
    }
  } catch { /* use defaults */ }

  return { email, prefs };
};

// ── Service class ─────────────────────────────────────────────────────────────

class EmailNotificationService {

  /**
   * Message email: sent when a user receives a new message.
   */
  async sendMessageEmail(recipientUserId, senderName, messageSubject, conversationId) {
    try {
      const info = await getUserEmailInfo(recipientUserId);
      if (!info || !info.prefs.enabled || !info.prefs.messages) return;
      if (!TEMPLATES.message) return;

      const ctaUrl = conversationId
        ? `${SITE_URL()}/messages/${conversationId}`
        : `${SITE_URL()}/messages`;

      const html = render(TEMPLATES.message, {
        SENDER_NAME:     senderName || 'Someone',
        MESSAGE_SUBJECT: messageSubject || 'a new message',
        CTA_URL:         ctaUrl,
        SITE_URL:        SITE_URL(),
        SETTINGS_URL:    `${SITE_URL()}/settings`,
      });
      if (!html) return;

      await sendRawEmail(
        info.email,
        `New Message from ${senderName || 'WorkoutAtlas'}`,
        html
      );
    } catch (err) {
      console.error('[EmailService] sendMessageEmail error:', err?.message);
    }
  }

  /**
   * Workout email: sent when a trainer updates a member's workout plan.
   */
  async sendWorkoutEmail(recipientUserId, trainerName, workoutName) {
    try {
      const info = await getUserEmailInfo(recipientUserId);
      if (!info || !info.prefs.enabled || !info.prefs.workouts) return;
      if (!TEMPLATES.workout) return;

      const html = render(TEMPLATES.workout, {
        TRAINER_NAME: trainerName || 'Your trainer',
        WORKOUT_NAME: workoutName || 'your workout plan',
        CTA_URL:      `${SITE_URL()}/workout-builder`,
        SITE_URL:     SITE_URL(),
        SETTINGS_URL: `${SITE_URL()}/settings`,
      });
      if (!html) return;

      await sendRawEmail(info.email, 'Workout Updated', html);
    } catch (err) {
      console.error('[EmailService] sendWorkoutEmail error:', err?.message);
    }
  }

  /**
   * Nutrition email: sent when a trainer updates a member's nutrition plan.
   */
  async sendNutritionEmail(recipientUserId, trainerName) {
    try {
      const info = await getUserEmailInfo(recipientUserId);
      if (!info || !info.prefs.enabled || !info.prefs.nutrition) return;
      if (!TEMPLATES.nutrition) return;

      const html = render(TEMPLATES.nutrition, {
        TRAINER_NAME: trainerName || 'Your trainer',
        CTA_URL:      `${SITE_URL()}/nutrition`,
        SITE_URL:     SITE_URL(),
        SETTINGS_URL: `${SITE_URL()}/settings`,
      });
      if (!html) return;

      await sendRawEmail(info.email, 'Nutrition Plan Updated', html);
    } catch (err) {
      console.error('[EmailService] sendNutritionEmail error:', err?.message);
    }
  }

  /**
   * Membership expiry email: sent at 30/14/7/3/1 day thresholds.
   */
  async sendMembershipEmail(recipientUserId, daysRemaining, tierName) {
    try {
      const info = await getUserEmailInfo(recipientUserId);
      if (!info || !info.prefs.enabled || !info.prefs.membership) return;
      if (!TEMPLATES.membership) return;

      const days = Number(daysRemaining) || 0;
      const daysLabel = `${days} day${days !== 1 ? 's' : ''}`;

      const html = render(TEMPLATES.membership, {
        TIER_NAME:    tierName || 'Premium',
        DAYS_LABEL:   daysLabel,
        CTA_URL:      `${SITE_URL()}/settings`,
        SITE_URL:     SITE_URL(),
        SETTINGS_URL: `${SITE_URL()}/settings`,
      });
      if (!html) return;

      await sendRawEmail(
        info.email,
        `${tierName || 'Premium'} Membership Expiring in ${daysLabel}`,
        html
      );
    } catch (err) {
      console.error('[EmailService] sendMembershipEmail error:', err?.message);
    }
  }

  /**
   * Admin announcement email: sent for admin broadcasts.
   */
  async sendAdminEmail(recipientUserId, title, message, link = '/dashboard') {
    try {
      const info = await getUserEmailInfo(recipientUserId);
      if (!info || !info.prefs.enabled || !info.prefs.admin) return;
      if (!TEMPLATES.admin) return;

      const ctaUrl = link?.startsWith('http') ? link : `${SITE_URL()}${link}`;

      const html = render(TEMPLATES.admin, {
        ANNOUNCEMENT_TITLE: title || 'WorkoutAtlas Announcement',
        ANNOUNCEMENT_BODY:  message || 'A new announcement has been posted.',
        CTA_URL:            ctaUrl,
        SITE_URL:           SITE_URL(),
        SETTINGS_URL:       `${SITE_URL()}/settings`,
      });
      if (!html) return;

      await sendRawEmail(info.email, title || 'WorkoutAtlas Announcement', html);
    } catch (err) {
      console.error('[EmailService] sendAdminEmail error:', err?.message);
    }
  }

  /**
   * Account email: generic for registration, role change, password updated, etc.
   * Never checks emailPrefs.enabled — account emails are always sent (unless
   * the user has no email address on file).
   */
  async sendAccountEmail(recipientUserId, eventTitle, eventDetail, ctaPath = '/settings') {
    try {
      const info = await getUserEmailInfo(recipientUserId);
      if (!info) return; // no email address on file; skip silently
      if (!TEMPLATES.account) return;

      const ctaUrl = ctaPath?.startsWith('http') ? ctaPath : `${SITE_URL()}${ctaPath}`;

      const html = render(TEMPLATES.account, {
        EVENT_TITLE:  eventTitle || 'Account Update',
        EVENT_DETAIL: eventDetail || '',
        CTA_URL:      ctaUrl,
        SITE_URL:     SITE_URL(),
        SETTINGS_URL: `${SITE_URL()}/settings`,
      });
      if (!html) return;

      await sendRawEmail(info.email, eventTitle || 'WorkoutAtlas Account Update', html);
    } catch (err) {
      console.error('[EmailService] sendAccountEmail error:', err?.message);
    }
  }

  /**
   * Password reset email: used in the forgot-password flow.
   * THROWS if SMTP is not configured (so the route can return 500).
   */
  async sendPasswordResetEmail(recipientUserId, temporaryPassword) {
    const transporter = getTransporter();
    if (!transporter) {
      throw new Error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.'
      );
    }

    const uid = Number(recipientUserId);
    const [rows] = await pool.query(
      'SELECT Email, username FROM users WHERE id = ? LIMIT 1',
      [uid]
    );
    const row = rows[0];
    if (!row) throw new Error('User not found.');

    const email = String(row.Email || row.username || '').trim();
    if (!email || !email.includes('@')) {
      throw new Error('No valid email address on file for this user.');
    }

    const resetUrl = process.env.RESET_PASSWORD_URL ||
      `${SITE_URL()}/update-password`;

    const html = TEMPLATES.account
      ? render(TEMPLATES.account, {
          EVENT_TITLE:  'Password Reset',
          EVENT_DETAIL: `Your temporary password is: <strong style="font-family: monospace; font-size: 16px;">${temporaryPassword}</strong><br><br>Use it to sign in, then update your password immediately.`,
          CTA_URL:      resetUrl,
          SITE_URL:     SITE_URL(),
          SETTINGS_URL: `${SITE_URL()}/settings`,
        })
      : `<p>Your temporary password is: <strong>${temporaryPassword}</strong></p><p><a href="${resetUrl}">Reset Password</a></p>`;

    await transporter.sendMail({
      from: FROM_ADDRESS(),
      to: email,
      subject: 'WorkoutAtlas Password Reset',
      html,
      text: `Your temporary password is: ${temporaryPassword}\n\nSign in and update your password immediately.\n\n${resetUrl}`,
    });
  }

}

module.exports = new EmailNotificationService();
