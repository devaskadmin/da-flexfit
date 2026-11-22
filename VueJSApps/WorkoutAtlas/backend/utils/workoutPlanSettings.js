// 0.85.313.a3: persist the builder's day-to-week assignments in the existing
// workout_schedules.settings_json column. Pure helpers plus one DB helper that
// takes an injected connection so it can be tested with isolated fixtures.
// Nothing here creates or alters schema; if the column is absent it is a no-op.

const DAY_WEEK_ASSIGNMENTS_KEY = 'dayWeekAssignments';
// 0.85.313.a8.1: id-keyed twin of dayWeekAssignments ({ "<dayGroupId>": <weekGroupId> }) so two days
// that share a display name in different weeks keep separate assignments. Stored in the same
// settings_json column; no schema change.
const DAY_WEEK_ASSIGNMENTS_BY_ID_KEY = 'dayWeekAssignmentsById';
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

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeDayWeekAssignmentsById = (raw) => {
  const out = {};
  if (!isPlainObject(raw)) {
    return out;
  }

  let count = 0;
  for (const [rawDayId, rawWeekId] of Object.entries(raw)) {
    if (count >= MAX_ASSIGNMENT_ENTRIES) {
      break;
    }
    const dayId = toPositiveInt(rawDayId);
    const weekId = toPositiveInt(rawWeekId);
    if (!dayId || !weekId) {
      continue;
    }
    out[String(dayId)] = weekId;
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

const extractDayWeekAssignmentsById = (rawSettingsJson) => {
  const parsed = parseStoredSettings(rawSettingsJson);
  return parsed.ok ? normalizeDayWeekAssignmentsById(parsed.settings[DAY_WEEK_ASSIGNMENTS_BY_ID_KEY]) : {};
};

// Merge assignments into existing settings, preserving every other key.
// assignmentsById: an id-keyed map to store alongside the name-keyed one, or null/undefined to drop any
// stored id-keyed map (a name-only save must not leave a stale id map that would override it).
const mergeDayWeekAssignmentsIntoSettings = (rawSettingsJson, assignments, assignmentsById = null) => {
  const parsed = parseStoredSettings(rawSettingsJson);
  if (!parsed.ok) {
    return { ok: false, json: null };
  }
  const merged = {
    ...parsed.settings,
    [DAY_WEEK_ASSIGNMENTS_KEY]: normalizeDayWeekAssignments(assignments),
  };
  if (isPlainObject(assignmentsById)) {
    merged[DAY_WEEK_ASSIGNMENTS_BY_ID_KEY] = normalizeDayWeekAssignmentsById(assignmentsById);
  } else {
    delete merged[DAY_WEEK_ASSIGNMENTS_BY_ID_KEY];
  }
  return { ok: true, json: JSON.stringify(merged) };
};

// Resolves the client's name/key-keyed assignments ({ dayKeyLower: weekKeyOrLabel }) to database ids.
// days / weeks: [{ key, label, id }] where id is the saved workout_schedule_groups.id.
// Returns { assignmentsById, legacyAssignments }; legacyAssignments is the name-keyed map by REAL
// label and only contains labels that are unique among the days (a shared label cannot key one week).
const resolveAssignmentsToIds = ({ assignments, days = [], weeks = [] } = {}) => {
  const lower = (value) => String(value ?? '').trim().toLowerCase();
  const source = normalizeDayWeekAssignments(assignments);
  const weekByName = new Map();
  weeks.forEach((week) => {
    const keyName = lower(week?.key);
    const labelName = lower(week?.label);
    if (keyName && !weekByName.has(keyName)) weekByName.set(keyName, week);
    if (labelName && !weekByName.has(labelName)) weekByName.set(labelName, week);
  });

  const labelCounts = new Map();
  days.forEach((day) => {
    const labelName = lower(day?.label);
    labelCounts.set(labelName, (labelCounts.get(labelName) || 0) + 1);
  });

  const assignmentsById = {};
  const legacyAssignments = {};
  days.forEach((day) => {
    const week = weekByName.get(lower(source[lower(day?.key)]));
    const dayId = toPositiveInt(day?.id);
    const weekId = toPositiveInt(week?.id);
    if (!week || !dayId || !weekId) {
      return;
    }
    assignmentsById[String(dayId)] = weekId;
    if (labelCounts.get(lower(day?.label)) === 1) {
      legacyAssignments[lower(day?.label)] = String(week.label || '').trim();
    }
  });

  return { assignmentsById, legacyAssignments };
};

// Remaps a stored id-keyed map when groups are copied to another schedule (oldId -> newId).
const remapAssignmentsById = (assignmentsById, idMap) => {
  const out = {};
  const source = normalizeDayWeekAssignmentsById(assignmentsById);
  for (const [dayId, weekId] of Object.entries(source)) {
    const nextDay = toPositiveInt(idMap?.get?.(Number(dayId)));
    const nextWeek = toPositiveInt(idMap?.get?.(Number(weekId)));
    if (nextDay && nextWeek) {
      out[String(nextDay)] = nextWeek;
    }
  }
  return out;
};

// Saves assignments inside the caller's transaction. Never touches other columns.
// Options a8.1: assignmentsById (+ optional legacyAssignments) override the planner's name-keyed map when the
// save resolved group identities; omit them for a name-only save.
// Returns { persisted, reason }.
const persistDayWeekAssignments = async (db, scheduleId, planner, {
  hasSettingsJson = false,
  assignmentsById = null,
  legacyAssignments = null,
} = {}) => {
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

  const useIdMap = isPlainObject(assignmentsById);
  const merged = mergeDayWeekAssignmentsIntoSettings(
    rows[0]?.settings_json,
    useIdMap && isPlainObject(legacyAssignments) ? legacyAssignments : planner.settings[DAY_WEEK_ASSIGNMENTS_KEY],
    useIdMap ? assignmentsById : null
  );
  if (!merged.ok) {
    return { persisted: false, reason: 'stored settings_json is not an object' };
  }

  await db.query('UPDATE workout_schedules SET settings_json = ? WHERE id = ?', [merged.json, scheduleId]);
  return { persisted: true, reason: '' };
};

module.exports = {
  DAY_WEEK_ASSIGNMENTS_KEY,
  DAY_WEEK_ASSIGNMENTS_BY_ID_KEY,
  MAX_ASSIGNMENT_ENTRIES,
  normalizeDayWeekAssignments,
  normalizeDayWeekAssignmentsById,
  hasIncomingDayWeekAssignments,
  parseStoredSettings,
  extractDayWeekAssignments,
  extractDayWeekAssignmentsById,
  mergeDayWeekAssignmentsIntoSettings,
  resolveAssignmentsToIds,
  remapAssignmentsById,
  persistDayWeekAssignments,
};
