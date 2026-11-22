// 0.85.313.a3.2: save BOTH day groups and week groups for a workout plan, whatever
// the selected schedule mode, and sync them in place so existing group IDs survive.
// Pure planning (planGroupSync) plus one DB helper (syncScheduleGroups) that takes an
// injected connection so both can be tested with isolated fixtures.
// No schema is created or altered here; only workout_schedule_groups rows of the
// supplied schedule are read, inserted, updated or deleted, inside the caller's transaction.

const { resolveAssignmentsToIds } = require('./workoutPlanSettings');

const DEFAULT_GROUP_LABELS = { day: 'Any Day', week: 'Week 1' };

const familyOfGroupType = (groupType) => (
  String(groupType || '').trim().toLowerCase() === 'week' ? 'week' : 'day'
);

// Day and week groups may legitimately share a label, so lookups are keyed by family.
const buildGroupKey = (family, label) => `${family === 'week' ? 'week' : 'day'}:${String(label || '').trim().toLowerCase()}`;

const findSortOrder = (entries, label, fallbackIndex) => {
  const normalizedLabel = String(label || '').trim().toLowerCase();
  const found = entries.find((entry) => String(entry?.label || '').trim().toLowerCase() === normalizedLabel);
  const parsed = Number(found?.sortOrder);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackIndex + 1;
};

// Labels are trimmed and de-duplicated case-insensitively so a family never saves the same group twice.
const buildFamilyEntries = (planner, family) => {
  const rawLabels = family === 'week' ? planner?.weekGroups : planner?.dayGroups;
  const rawOrders = family === 'week' ? planner?.weekGroupOrders : planner?.dayGroupOrders;
  const orders = Array.isArray(rawOrders) ? rawOrders : [];

  const seen = new Set();
  const labels = [];
  (Array.isArray(rawLabels) ? rawLabels : []).forEach((value) => {
    const label = String(value || '').trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) {
      return;
    }
    seen.add(key);
    labels.push(label);
  });

  const finalLabels = labels.length ? labels : [DEFAULT_GROUP_LABELS[family]];
  return finalLabels
    .map((label, index) => ({
      family,
      label,
      groupType: family === 'week' ? 'week' : (label.toLowerCase() === 'any day' ? 'any' : 'day'),
      sortOrder: findSortOrder(orders, label, index),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
};

// Request-boundary validation for client-sent entries. validateLabel(raw, { label }) -> { ok, value, message }.
// Throws createError(message) for invalid labels, duplicate keys, oversized keys or too many entries.
const normalizeIdentityEntries = (rawEntries, family, { validateLabel, createError } = {}) => {
  if (!Array.isArray(rawEntries)) {
    return [];
  }
  if (rawEntries.length > MAX_GROUP_ENTRIES) {
    throw createError(`Too many workout ${family} entries.`);
  }

  const seenKeys = new Set();
  const prepared = rawEntries.map((entry, index) => {
    const validation = validateLabel(entry?.label, { label: `Workout ${family} ${index + 1}` });
    if (!validation.ok) {
      throw createError(validation.message);
    }
    const key = String(entry?.key ?? '').trim() || validation.value;
    if (key.length > 120) {
      throw createError(`Workout ${family} ${index + 1} key is too long.`);
    }
    const keyId = key.toLowerCase();
    if (seenKeys.has(keyId)) {
      throw createError(`Workout ${family} keys must be unique.`);
    }
    seenKeys.add(keyId);
    const parsedId = Number(entry?.id);
    const order = Number(entry?.sortOrder);
    return {
      key,
      id: Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null,
      label: validation.value,
      sortOrder: Number.isFinite(order) && order > 0 ? order : index + 1,
      index,
    };
  });

  return prepared
    .sort((left, right) => (left.sortOrder - right.sortOrder) || (left.index - right.index))
    .map(({ index, ...entry }, position) => ({ ...entry, sortOrder: position + 1 }));
};

const isPlaceholderOnly = (entries, family) => (
  entries.length === 1 && entries[0].label.toLowerCase() === DEFAULT_GROUP_LABELS[family].toLowerCase()
);

// 0.85.313.a8.1: identity-aware group entries. A planner may carry dayGroupEntries / weekGroupEntries,
// each { key, id, label, sortOrder }. `key` is the client's stable handle for the group inside one save
// request (exercises and day-to-week assignments refer to it), `id` is the existing
// workout_schedule_groups.id when the group was loaded from the database. Entries are matched to rows
// by id only, so two groups may share a label and a rename updates the row in place (id preserved).
const MAX_GROUP_ENTRIES = 200;

const buildEntryGroupKey = (family, key) => `${family === 'week' ? 'week' : 'day'}:key:${String(key ?? '').trim().toLowerCase()}`;

const buildEntriesForFamily = (planner, family) => {
  const raw = family === 'week' ? planner?.weekGroupEntries : planner?.dayGroupEntries;
  if (!Array.isArray(raw)) {
    return [];
  }

  const seenKeys = new Set();
  const seenIds = new Set();
  const out = [];
  raw.slice(0, MAX_GROUP_ENTRIES).forEach((entry, index) => {
    const label = String(entry?.label ?? '').trim();
    if (!label) {
      return;
    }
    const key = String(entry?.key ?? '').trim() || label;
    const keyId = key.toLowerCase();
    if (seenKeys.has(keyId)) {
      return;
    }
    seenKeys.add(keyId);

    const parsedId = Number(entry?.id);
    let id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
    if (id !== null) {
      if (seenIds.has(id)) {
        id = null;
      } else {
        seenIds.add(id);
      }
    }

    const order = Number(entry?.sortOrder);
    out.push({
      family,
      entryKey: key,
      id,
      label,
      groupType: family === 'week' ? 'week' : (label.toLowerCase() === 'any day' ? 'any' : 'day'),
      sortOrder: Number.isFinite(order) && order > 0 ? order : index + 1,
      index,
    });
  });

  return out
    .sort((left, right) => (left.sortOrder - right.sortOrder) || (left.index - right.index))
    .map(({ index, ...entry }) => entry);
};

// Decide which rows to update, insert and delete. Does no I/O.
//  - The active mode's groups are always written.
//  - The other mode's groups are written too, unless the client did not send that set
//    (planner.groupSetsProvided[family] === false: existing rows stay untouched) or it is
//    only the untouched placeholder and the plan has no rows of that family yet.
//  - Existing rows are matched by family + case-insensitive label and updated in place.
const planGroupSync = (planner, existingRows, { preserveCustomWorkoutLogOrder = false } = {}) => {
  const mode = planner?.scheduleMode === 'week' ? 'week' : 'day';
  const otherMode = mode === 'week' ? 'day' : 'week';
  const provided = planner?.groupSetsProvided;
  const existingByFamily = { day: [], week: [] };
  (Array.isArray(existingRows) ? existingRows : []).forEach((row) => {
    existingByFamily[familyOfGroupType(row?.group_type)].push(row);
  });

  const plan = { mode, entries: [], updates: [], inserts: [], deleteIds: [], skippedFamilies: [] };

  [mode, otherMode].forEach((family) => {
    const existing = existingByFamily[family];
    const isActive = family === mode;

    if (!isActive && provided && provided[family] === false) {
      plan.skippedFamilies.push(family);
      return;
    }

    const identityEntries = buildEntriesForFamily(planner, family);
    if (identityEntries.length) {
      if (!isActive && isPlaceholderOnly(identityEntries, family) && existing.length === 0) {
        plan.skippedFamilies.push(family);
        return;
      }

      // Identity path: match by id only (the row must belong to this schedule and family).
      const existingById = new Map(existing.map((row) => [Number(row.id), row]));
      const claimedIds = new Set();
      identityEntries.forEach((entry) => {
        const key = buildEntryGroupKey(family, entry.entryKey);
        const match = entry.id && existingById.has(entry.id) && !claimedIds.has(entry.id)
          ? existingById.get(entry.id)
          : null;
        if (match) {
          claimedIds.add(Number(match.id));
          const keptOrder = Number(match.workout_log_display_order);
          plan.updates.push({
            ...entry,
            key,
            id: Number(match.id),
            workoutLogDisplayOrder: preserveCustomWorkoutLogOrder && Number.isFinite(keptOrder) && keptOrder > 0
              ? keptOrder
              : null,
          });
        } else {
          plan.inserts.push({ ...entry, id: null, key });
        }
        plan.entries.push({ ...entry, key });
      });
      existing.forEach((row) => {
        if (!claimedIds.has(Number(row.id))) {
          plan.deleteIds.push(Number(row.id));
        }
      });
      return;
    }

    const entries = buildFamilyEntries(planner, family);
    if (!isActive && isPlaceholderOnly(entries, family) && existing.length === 0) {
      plan.skippedFamilies.push(family);
      return;
    }

    const unmatchedByKey = new Map();
    existing.forEach((row) => {
      const key = buildGroupKey(family, row?.label);
      if (!unmatchedByKey.has(key)) {
        unmatchedByKey.set(key, []);
      }
      unmatchedByKey.get(key).push(row);
    });

    entries.forEach((entry) => {
      const key = buildGroupKey(family, entry.label);
      const match = unmatchedByKey.get(key)?.shift();
      if (match) {
        const keptOrder = Number(match.workout_log_display_order);
        plan.updates.push({
          ...entry,
          key,
          id: Number(match.id),
          workoutLogDisplayOrder: preserveCustomWorkoutLogOrder && Number.isFinite(keptOrder) && keptOrder > 0
            ? keptOrder
            : null,
        });
      } else {
        plan.inserts.push({ ...entry, key });
      }
      plan.entries.push({ ...entry, key });
    });

    unmatchedByKey.forEach((rows) => {
      rows.forEach((row) => plan.deleteIds.push(Number(row.id)));
    });
  });

  return plan;
};

// Applies planGroupSync to workout_schedule_groups for one schedule.
// Returns { groupIdByKey, plan } where groupIdByKey maps buildGroupKey(family, label) to the row id.
const syncScheduleGroups = async (db, scheduleId, planner, {
  hasWorkoutLogDisplayOrder = false,
  preserveCustomWorkoutLogOrder = false,
} = {}) => {
  const selectFields = hasWorkoutLogDisplayOrder
    ? 'id, label, group_type, sort_order, workout_log_display_order'
    : 'id, label, group_type, sort_order';

  const [existingRows] = await db.query(
    `SELECT ${selectFields}
     FROM workout_schedule_groups
     WHERE workout_schedule_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [scheduleId]
  );

  const plan = planGroupSync(planner, existingRows, { preserveCustomWorkoutLogOrder });
  const groupIdByKey = new Map();

  if (plan.deleteIds.length) {
    await db.query(
      `DELETE FROM workout_schedule_groups
       WHERE workout_schedule_id = ?
         AND id IN (${plan.deleteIds.map(() => '?').join(', ')})`,
      [scheduleId, ...plan.deleteIds]
    );
  }

  for (const update of plan.updates) {
    if (hasWorkoutLogDisplayOrder) {
      await db.query(
        `UPDATE workout_schedule_groups
         SET label = ?, group_type = ?, sort_order = ?, workout_log_display_order = ?
         WHERE id = ? AND workout_schedule_id = ?`,
        [update.label, update.groupType, update.sortOrder, update.workoutLogDisplayOrder, update.id, scheduleId]
      );
    } else {
      await db.query(
        `UPDATE workout_schedule_groups
         SET label = ?, group_type = ?, sort_order = ?
         WHERE id = ? AND workout_schedule_id = ?`,
        [update.label, update.groupType, update.sortOrder, update.id, scheduleId]
      );
    }
    groupIdByKey.set(update.key, update.id);
  }

  for (const insert of plan.inserts) {
    let insertResult;
    if (hasWorkoutLogDisplayOrder) {
      [insertResult] = await db.query(
        `INSERT INTO workout_schedule_groups
          (workout_schedule_id, label, group_type, sort_order, workout_log_display_order)
         VALUES (?, ?, ?, ?, ?)`,
        [scheduleId, insert.label, insert.groupType, insert.sortOrder, null]
      );
    } else {
      [insertResult] = await db.query(
        `INSERT INTO workout_schedule_groups
          (workout_schedule_id, label, group_type, sort_order)
         VALUES (?, ?, ?, ?)`,
        [scheduleId, insert.label, insert.groupType, insert.sortOrder]
      );
    }
    groupIdByKey.set(insert.key, insertResult.insertId);
  }

  return { groupIdByKey, plan };
};

// 0.85.313.a8.1: the saved group id for an exercise. With identity entries an exercise is matched by
// its key (scheduleGroupKey, falling back to scheduleGroup); otherwise by family + label as before.
const resolveExerciseGroupId = (planner, mode, exercise, groupIdByKey, fallbackLabel = '') => {
  const identityEntries = buildEntriesForFamily(planner, mode);
  if (identityEntries.length) {
    const requestedKey = String(exercise?.scheduleGroupKey || exercise?.scheduleGroup || '').trim()
      || identityEntries[0].entryKey;
    return groupIdByKey.get(buildEntryGroupKey(mode, requestedKey)) || null;
  }
  const label = String(exercise?.scheduleGroup || fallbackLabel || '').trim();
  return groupIdByKey.get(buildGroupKey(mode, label)) || null;
};

// Resolves the planner's day-to-week assignments to the saved group ids after syncScheduleGroups.
// Returns { assignmentsById, legacyAssignments }, or both null when the save did not use identity entries
// for both sets (a name-only save then stores just the name-keyed map, as before).
const resolveSavedAssignments = (planner, groupIdByKey) => {
  const dayEntries = buildEntriesForFamily(planner, 'day');
  const weekEntries = buildEntriesForFamily(planner, 'week');
  const hasId = (family, entry) => groupIdByKey.has(buildEntryGroupKey(family, entry.entryKey));
  if (!dayEntries.length || !weekEntries.length
    || !weekEntries.some((entry) => hasId('week', entry))
    || !dayEntries.some((entry) => hasId('day', entry))) {
    return { assignmentsById: null, legacyAssignments: null };
  }
  return resolveAssignmentsToIds({
    assignments: planner?.settings?.dayWeekAssignments,
    days: dayEntries.map((entry) => ({
      key: entry.entryKey,
      label: entry.label,
      id: groupIdByKey.get(buildEntryGroupKey('day', entry.entryKey)),
    })),
    weeks: weekEntries.map((entry) => ({
      key: entry.entryKey,
      label: entry.label,
      id: groupIdByKey.get(buildEntryGroupKey('week', entry.entryKey)),
    })),
  });
};

module.exports = {
  resolveExerciseGroupId,
  resolveSavedAssignments,
  DEFAULT_GROUP_LABELS,
  familyOfGroupType,
  buildGroupKey,
  buildEntryGroupKey,
  buildEntriesForFamily,
  normalizeIdentityEntries,
  planGroupSync,
  syncScheduleGroups,
};
