// 0.85.313.a3.2: save BOTH day groups and week groups for a workout plan, whatever
// the selected schedule mode, and sync them in place so existing group IDs survive.
// Pure planning (planGroupSync) plus one DB helper (syncScheduleGroups) that takes an
// injected connection so both can be tested with isolated fixtures.
// No schema is created or altered here; only workout_schedule_groups rows of the
// supplied schedule are read, inserted, updated or deleted, inside the caller's transaction.

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

const isPlaceholderOnly = (entries, family) => (
  entries.length === 1 && entries[0].label.toLowerCase() === DEFAULT_GROUP_LABELS[family].toLowerCase()
);

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

module.exports = {
  DEFAULT_GROUP_LABELS,
  familyOfGroupType,
  buildGroupKey,
  planGroupSync,
  syncScheduleGroups,
};
