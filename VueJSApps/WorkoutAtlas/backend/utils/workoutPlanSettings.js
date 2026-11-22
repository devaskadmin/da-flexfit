// 0.85.313.a3: persist the builder's day-to-week assignments in the existing
// workout_schedules.settings_json column. Pure helpers plus one DB helper that
// takes an injected connection so it can be tested with isolated fixtures.
// Nothing here creates or alters schema; if the column is absent it is a no-op.

const DAY_WEEK_ASSIGNMENTS_KEY = 'dayWeekAssignments';
const MAX_ASSIGNMENT_ENTRIES = 200;
const MAX_ASSIGNMENT_LABEL_LENGTH = 120;
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeDayWeekAssignments = (raw) => {
  const out = {};
  if (!isPlainObject(raw)) {
    return out;
  }

  let count = 0;
  for (const [rawDay, rawWeek] of Object.entries(raw)) {
    if (count >= MAX_ASSIGNMENT_ENTRIES) {
      break;
    }
    const day = String(rawDay ?? '').trim().toLowerCase();
    const week = typeof rawWeek === 'string' ? rawWeek.trim() : '';
    if (!day || !week || day.length > MAX_ASSIGNMENT_LABEL_LENGTH || week.length > MAX_ASSIGNMENT_LABEL_LENGTH) {
      continue;
    }
    if (BLOCKED_KEYS.has(day)) {
      continue;
    }
    out[day] = week;
    count += 1;
  }
  return out;
};

const hasIncomingDayWeekAssignments = (planner) => {
  return isPlainObject(planner?.settings) && isPlainObject(planner.settings[DAY_WEEK_ASSIGNMENTS_KEY]);
};

// Returns { ok, settings }. ok=false when stored JSON is not an object (never overwritten).
const parseStoredSettings = (raw) => {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, settings: {} };
  }
  if (isPlainObject(raw)) {
    return { ok: true, settings: raw };
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null) {
        return { ok: true, settings: {} };
      }
      return isPlainObject(parsed) ? { ok: true, settings: parsed } : { ok: false, settings: {} };
    } catch (_) {
      return { ok: false, settings: {} };
    }
  }
  return { ok: false, settings: {} };
};

const extractDayWeekAssignments = (rawSettingsJson) => {
  const parsed = parseStoredSettings(rawSettingsJson);
  return parsed.ok ? normalizeDayWeekAssignments(parsed.settings[DAY_WEEK_ASSIGNMENTS_KEY]) : {};
};

// Merge assignments into existing settings, preserving every other key.
const mergeDayWeekAssignmentsIntoSettings = (rawSettingsJson, assignments) => {
  const parsed = parseStoredSettings(rawSettingsJson);
  if (!parsed.ok) {
    return { ok: false, json: null };
  }
  const merged = {
    ...parsed.settings,
    [DAY_WEEK_ASSIGNMENTS_KEY]: normalizeDayWeekAssignments(assignments),
  };
  return { ok: true, json: JSON.stringify(merged) };
};

// Saves assignments inside the caller's transaction. Never touches other columns.
// Returns { persisted, reason }.
const persistDayWeekAssignments = async (db, scheduleId, planner, { hasSettingsJson = false } = {}) => {
  if (!hasSettingsJson) {
    return { persisted: false, reason: 'settings_json column unavailable' };
  }
  if (!hasIncomingDayWeekAssignments(planner)) {
    return { persisted: false, reason: 'no assignments supplied' };
  }

  const [rows] = await db.query(
    'SELECT settings_json FROM workout_schedules WHERE id = ? LIMIT 1 FOR UPDATE',
    [scheduleId]
  );
  if (!rows || !rows.length) {
    return { persisted: false, reason: 'schedule not found' };
  }

  const merged = mergeDayWeekAssignmentsIntoSettings(rows[0]?.settings_json, planner.settings[DAY_WEEK_ASSIGNMENTS_KEY]);
  if (!merged.ok) {
    return { persisted: false, reason: 'stored settings_json is not an object' };
  }

  await db.query('UPDATE workout_schedules SET settings_json = ? WHERE id = ?', [merged.json, scheduleId]);
  return { persisted: true, reason: '' };
};

module.exports = {
  DAY_WEEK_ASSIGNMENTS_KEY,
  MAX_ASSIGNMENT_ENTRIES,
  normalizeDayWeekAssignments,
  hasIncomingDayWeekAssignments,
  parseStoredSettings,
  extractDayWeekAssignments,
  mergeDayWeekAssignmentsIntoSettings,
  persistDayWeekAssignments,
};
