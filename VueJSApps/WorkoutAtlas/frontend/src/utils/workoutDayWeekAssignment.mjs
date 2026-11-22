export const DEFAULT_WEEK_NAME = 'Week 1';

const groupKey = (value) => String(value ?? '').trim().toLowerCase();

const uniqueLabels = (labels) => {
  const seen = new Set();
  return (Array.isArray(labels) ? labels : [])
    .map((label) => String(label ?? '').trim())
    .filter((label) => {
      const key = label.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const sameAssignments = (left, right) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key]);
};

/**
 * Default week for unassigned days: an existing "Week 1" (case-insensitive),
 * otherwise the first existing week. Returns '' when the plan has no weeks.
 */
export const resolveDefaultWeek = (weekGroups = []) => {
  const weeks = uniqueLabels(weekGroups);
  return weeks.find((label) => groupKey(label) === groupKey(DEFAULT_WEEK_NAME)) || weeks[0] || '';
};

/**
 * Week dropdown options built from the existing weeks only. `value` is always the
 * stored week name; only the label of the default "Week 1" gets a "(Default)" suffix.
 */
export const buildWeekOptions = (weekGroups = []) =>
  uniqueLabels(weekGroups).map((week) => ({
    value: week,
    label: groupKey(week) === groupKey(DEFAULT_WEEK_NAME) ? `${week} (Default)` : week,
  }));

/**
 * Week to show as selected: the current selection when it still exists (returned with
 * the stored spelling), otherwise Week 1, otherwise the first week, otherwise ''.
 */
export const resolveSelectedWeek = (weekGroups = [], current = '') => {
  const weeks = uniqueLabels(weekGroups);
  return weeks.find((week) => groupKey(week) === groupKey(current)) || resolveDefaultWeek(weeks);
};

/**
 * True when the given week has at least one day assigned to it that holds at least one
 * exercise. Only that week's assignments are looked at; other weeks and the rest of the plan
 * are ignored. `countExercises` lets the caller reuse its own exercise-counting rule.
 */
export const weekHasDayWithExercise = ({
  week = '',
  dayGroups = [],
  assignments = {},
  exercises = [],
  countExercises = (list) => list.length,
} = {}) => {
  const weekKey = groupKey(week);
  if (!weekKey || !assignments || typeof assignments !== 'object') {
    return false;
  }
  const list = Array.isArray(exercises) ? exercises : [];
  return uniqueLabels(dayGroups).some((day) => {
    const dayKey = groupKey(day);
    if (!Object.prototype.hasOwnProperty.call(assignments, dayKey) || groupKey(assignments[dayKey]) !== weekKey) {
      return false;
    }
    return countExercises(list.filter((exercise) => groupKey(exercise?.scheduleGroup) === dayKey)) > 0;
  });
};

/** Next unused "Week N" (N starting at 2), compared case-insensitively against existing weeks. */
export const buildNextWeekName = (weekGroups = []) => {
  const used = new Set(uniqueLabels(weekGroups).map(groupKey));
  let number = 2;
  while (used.has(groupKey(`Week ${number}`))) {
    number += 1;
  }
  return `Week ${number}`;
};

/**
 * Rename one week in place. The week keeps its position in the list, every day assigned to it
 * stays assigned to it (under the new name), and no other week, day or exercise is touched.
 * Another week with the same name (case-insensitive) is a duplicate; the renamed week itself is
 * not, so changing only the capitalisation is allowed. Inputs are never mutated.
 * Returns { ok, changed, weekGroups, assignments } or { ok: false, message }.
 */
export const renameWeekInPlan = ({
  weekGroups = [],
  assignments = {},
  oldWeek = '',
  newWeek = '',
} = {}) => {
  const weeks = Array.isArray(weekGroups) ? weekGroups : [];
  const oldKey = groupKey(oldWeek);
  const label = String(newWeek ?? '').trim();
  const newKey = groupKey(label);
  const current = assignments && typeof assignments === 'object' ? assignments : {};

  if (!oldKey || !weeks.some((week) => groupKey(week) === oldKey)) {
    return { ok: false, message: 'Workout week was not found.' };
  }
  if (!newKey) {
    return { ok: false, message: 'Workout week name cannot be empty.' };
  }
  if (newKey !== oldKey && weeks.some((week) => groupKey(week) === newKey)) {
    return { ok: false, message: `${label} already exists.` };
  }

  const currentLabel = weeks.find((week) => groupKey(week) === oldKey);
  if (currentLabel === label) {
    return { ok: true, changed: false, weekGroups: weeks, assignments: current };
  }

  return {
    ok: true,
    changed: true,
    weekGroups: weeks.map((week) => (groupKey(week) === oldKey ? label : week)),
    assignments: Object.fromEntries(
      Object.entries(current).map(([day, week]) => [day, groupKey(week) === oldKey ? label : week])
    ),
  };
};

/**
 * In-memory day-to-week mapping: { [normalized day name]: week label }.
 * Each day appears at most once, so a day can never be assigned twice.
 * Valid assignments (day and week both still exist) are kept; entries for
 * missing days or weeks are dropped; unassigned days get the default week.
 * Day names, exercises, and exercise group labels are never touched.
 */
export const reconcileDayWeekAssignments = ({
  dayGroups = [],
  weekGroups = [],
  assignments = {},
} = {}) => {
  const current = assignments && typeof assignments === 'object' ? assignments : {};
  const weeks = uniqueLabels(weekGroups);
  const weekByKey = new Map(weeks.map((label) => [groupKey(label), label]));
  const defaultWeek = resolveDefaultWeek(weeks);
  const next = {};
  let defaultedCount = 0;

  uniqueLabels(dayGroups).forEach((dayName) => {
    const dayKey = groupKey(dayName);
    const validWeek = weekByKey.get(groupKey(current[dayKey]));
    if (validWeek) {
      next[dayKey] = validWeek;
      return;
    }
    if (defaultWeek) {
      next[dayKey] = defaultWeek;
      defaultedCount += 1;
    }
  });

  return {
    assignments: sameAssignments(current, next) ? current : next,
    changed: !sameAssignments(current, next),
    defaultedCount,
  };
};

export const renameDayInAssignments = (assignments = {}, oldDay, newDay) => {
  const oldKey = groupKey(oldDay);
  const newKey = groupKey(newDay);
  if (!oldKey || !newKey || oldKey === newKey || !(oldKey in assignments)) {
    return assignments;
  }
  const { [oldKey]: week, ...rest } = assignments;
  return newKey in rest ? rest : { ...rest, [newKey]: week };
};

export const renameWeekInAssignments = (assignments = {}, oldWeek, newWeek) => {
  const oldKey = groupKey(oldWeek);
  const label = String(newWeek ?? '').trim();
  if (!oldKey || !label || oldKey === groupKey(label)) {
    return assignments;
  }
  return Object.fromEntries(
    Object.entries(assignments).map(([day, week]) => [day, groupKey(week) === oldKey ? label : week])
  );
};

export const copyDayAssignment = (assignments = {}, sourceDay, newDay) => {
  const sourceKey = groupKey(sourceDay);
  const newKey = groupKey(newDay);
  if (!sourceKey || !newKey || !(sourceKey in assignments) || newKey in assignments) {
    return assignments;
  }
  return { ...assignments, [newKey]: assignments[sourceKey] };
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// Week a day belongs to: its saved assignment, otherwise the default week (the same fallback reconcile applies).
const weekOfDay = (assignments, weekGroups, day) => {
  const dayKey = groupKey(day);
  if (assignments && typeof assignments === 'object' && hasOwn(assignments, dayKey) && groupKey(assignments[dayKey])) {
    return String(assignments[dayKey]).trim();
  }
  return resolveDefaultWeek(weekGroups);
};

/**
 * The days that belong to one week, in their current order and with their original labels.
 * Only the display is filtered: nothing is removed or edited. With no week selected ('')
 * every day is returned so the planner never hides its days while the selection is unresolved.
 */
export const getDaysForWeek = ({
  dayGroups = [],
  weekGroups = [],
  assignments = {},
  week = '',
} = {}) => {
  const days = Array.isArray(dayGroups) ? dayGroups : [];
  const weekKey = groupKey(week);
  if (!weekKey) {
    return days;
  }
  return days.filter((day) => groupKey(weekOfDay(assignments, weekGroups, day)) === weekKey);
};

/** Assign one day to a week (used for newly created days). Returns a new object; other entries are untouched. */
export const assignDayToWeek = (assignments = {}, day, week) => {
  const dayKey = groupKey(day);
  const label = String(week ?? '').trim();
  if (!dayKey || !label || BLOCKED_ASSIGNMENT_KEYS.has(dayKey)) {
    return assignments;
  }
  return { ...assignments, [dayKey]: label };
};

/**
 * 0.85.313.a8.1: a day name only has to be unique inside its own week. The same label may be used in
 * another week because each day has its own internal key (see buildUniqueDayKey) and database id.
 * Returns the internal key of the day in `week` that already uses `name` (case-insensitive), or ''.
 * `ignoreDay` skips the day being renamed so it never collides with itself.
 */
export const findDayWithLabelInWeek = ({
  name = '',
  dayGroups = [],
  weekGroups = [],
  assignments = {},
  week = '',
  labelOverrides = {},
  ignoreDay = '',
} = {}) => {
  const labelKey = groupKey(name);
  const weekKey = groupKey(week);
  const ignoreKey = groupKey(ignoreDay);
  if (!labelKey) {
    return '';
  }
  const found = (Array.isArray(dayGroups) ? dayGroups : []).find((day) => {
    if (ignoreKey && groupKey(day) === ignoreKey) {
      return false;
    }
    if (groupKey(resolveDayLabel(day, labelOverrides)) !== labelKey) {
      return false;
    }
    return !weekKey || groupKey(weekOfDay(assignments, weekGroups, day)) === weekKey;
  });
  return found === undefined ? '' : found;
};

/** Message for a day name that already exists in the same week. */
export const buildDuplicateDayMessage = ({
  name = '',
  week = '',
} = {}) => {
  const label = String(name ?? '').trim();
  const weekLabel = String(week ?? '').trim();
  return weekLabel ? `${label} already exists in ${weekLabel}.` : `${label} already exists.`;
};

/** Display label of a day: its saved label when it differs from the internal key, else the key itself. */
export const resolveDayLabel = (name, labelOverrides = {}) => {
  const raw = String(name ?? '').trim();
  const override = labelOverrides && typeof labelOverrides === 'object'
    ? labelOverrides[groupKey(raw)]
    : '';
  return typeof override === 'string' && override.trim() ? override.trim() : raw;
};

/**
 * Internal key for a day with the display label `label` in `week`. The bare label is used while it is free;
 * otherwise "<label> (<week>)" and finally "<label> (n)". Mirrors the compatibility names the API returns,
 * so a reload yields the same keys. `ignoreDay` is the day being renamed (its own key does not count).
 */
export const buildUniqueDayKey = ({
  label = '',
  week = '',
  dayGroups = [],
  ignoreDay = '',
} = {}) => {
  const base = String(label ?? '').trim();
  const ignoreKey = groupKey(ignoreDay);
  const used = new Set(
    (Array.isArray(dayGroups) ? dayGroups : [])
      .filter((day) => !ignoreKey || groupKey(day) !== ignoreKey)
      .map(groupKey)
  );
  if (!base || !used.has(groupKey(base))) {
    return base;
  }
  const weekLabel = String(week ?? '').trim();
  const withWeek = weekLabel ? `${base} (${weekLabel})` : '';
  if (withWeek && !used.has(groupKey(withWeek))) {
    return withWeek;
  }
  let counter = 2;
  while (used.has(groupKey(`${base} (${counter})`))) {
    counter += 1;
  }
  return `${base} (${counter})`;
};

/** Returns new overrides with `key` shown as `label`; an override equal to the key is dropped. */
export const setDayLabelOverride = (labelOverrides = {}, key, label) => {
  const dayKey = groupKey(key);
  const next = { ...(labelOverrides && typeof labelOverrides === 'object' ? labelOverrides : {}) };
  if (!dayKey || BLOCKED_ASSIGNMENT_KEYS.has(dayKey)) {
    return next;
  }
  const text = String(label ?? '').trim();
  if (!text || text === String(key ?? '').trim()) {
    delete next[dayKey];
  } else {
    next[dayKey] = text;
  }
  return next;
};

/** Moves an override from one key to another (rename); overrides of other days are untouched. */
export const moveDayLabelOverride = (labelOverrides = {}, oldKey, newKey) => {
  const from = groupKey(oldKey);
  const to = groupKey(newKey);
  const next = { ...(labelOverrides && typeof labelOverrides === 'object' ? labelOverrides : {}) };
  if (!from || !to || from === to) {
    return next;
  }
  const carried = next[from];
  delete next[from];
  if (carried && !BLOCKED_ASSIGNMENT_KEYS.has(to)) {
    next[to] = carried;
  }
  return next;
};

/**
 * Move a day up or down among the days that are currently visible: it swaps places with its
 * visible neighbour, so hidden days from other weeks keep their positions. Returns the new full
 * list, or null when the day cannot move that way.
 */
export const moveDayAmongVisible = ({
  groups = [],
  visibleGroups = [],
  name = '',
  direction = 'up',
} = {}) => {
  const all = Array.isArray(groups) ? [...groups] : [];
  const visibleKeys = (Array.isArray(visibleGroups) ? visibleGroups : []).map(groupKey);
  const key = groupKey(name);
  const from = visibleKeys.indexOf(key);
  const to = direction === 'down' ? from + 1 : from - 1;
  if (from < 0 || to < 0 || to >= visibleKeys.length) {
    return null;
  }
  const a = all.findIndex((group) => groupKey(group) === key);
  const b = all.findIndex((group) => groupKey(group) === visibleKeys[to]);
  if (a < 0 || b < 0) {
    return null;
  }
  [all[a], all[b]] = [all[b], all[a]];
  return all;
};

const BLOCKED_ASSIGNMENT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Reads saved assignments from a loaded planner (`planner.settings.dayWeekAssignments`,
 * persisted in workout_schedules.settings_json). Anything malformed is ignored; the
 * result still goes through reconcileDayWeekAssignments before use.
 */
export const readSavedDayWeekAssignments = (planner) => {
  const saved = planner?.settings?.dayWeekAssignments;
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    return {};
  }
  const out = {};
  Object.entries(saved).forEach(([day, week]) => {
    const dayKey = groupKey(day);
    const weekLabel = typeof week === 'string' ? week.trim() : '';
    if (dayKey && weekLabel && !BLOCKED_ASSIGNMENT_KEYS.has(dayKey)) {
      out[dayKey] = weekLabel;
    }
  });
  return out;
};

/** Save-payload fragment sent with the planner (merged into settings_json by the backend). */
export const buildDayWeekAssignmentsSettings = (assignments = {}) => ({
  dayWeekAssignments: { ...assignments },
});

/** Order-independent snapshot used by unsaved-change detection. */
export const serializeDayWeekAssignments = (assignments = {}) =>
  JSON.stringify(Object.keys(assignments || {}).sort().map((day) => [day, assignments[day]]));

/**
 * Save-payload entries for one family: { key, id, label, sortOrder } in list order.
 * `key` is the internal name the exercises and assignments refer to, `id` the saved database id (null for a
 * group created in this session) and `label` the real display name. The server matches groups by id only.
 */
export const buildGroupEntries = ({
  names = [],
  idByName = () => null,
  labelOverrides = {},
} = {}) =>
  (Array.isArray(names) ? names : [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean)
    .map((name, index) => {
      const rawId = Number(idByName(name));
      return {
        key: name,
        id: Number.isInteger(rawId) && rawId > 0 ? rawId : null,
        label: resolveDayLabel(name, labelOverrides),
        sortOrder: index + 1,
      };
    });

/**
 * Reads the entries a loaded planner carries (`dayGroupEntries` / `weekGroupEntries`).
 * Returns { names, ids, labelOverrides }: names in saved order, ids as { [lowercase name]: id } and the
 * label overrides for entries whose real label differs from the unique name. Without entries (older
 * payloads) it returns null so the caller keeps the name-only behaviour.
 */
export const readGroupEntries = (rawEntries) => {
  if (!Array.isArray(rawEntries) || !rawEntries.length) {
    return null;
  }
  const names = [];
  const ids = {};
  let labelOverrides = {};
  const seen = new Set();
  [...rawEntries]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => (Number(left.entry?.sortOrder || 0) - Number(right.entry?.sortOrder || 0)) || (left.index - right.index))
    .forEach(({ entry }) => {
      const key = String(entry?.key ?? entry?.label ?? '').trim();
      const normalized = groupKey(key);
      if (!normalized || seen.has(normalized) || BLOCKED_ASSIGNMENT_KEYS.has(normalized)) {
        return;
      }
      seen.add(normalized);
      names.push(key);
      const id = Number(entry?.id);
      if (Number.isInteger(id) && id > 0) {
        ids[normalized] = id;
      }
      labelOverrides = setDayLabelOverride(labelOverrides, key, entry?.label);
    });
  return names.length ? { names, ids, labelOverrides } : null;
};

/**
 * After a save, the server returns the saved entries. Entries are matched to the entries that were sent by
 * position and real label (the server keeps the sent order), so newly created groups pick up their database
 * ids and the next save updates them in place. Returns { [lowercase sent key]: id }.
 */
export const matchSavedGroupIds = (sentEntries = [], savedEntries = []) => {
  const sent = Array.isArray(sentEntries) ? sentEntries : [];
  const saved = [...(Array.isArray(savedEntries) ? savedEntries : [])]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => (Number(left.entry?.sortOrder || 0) - Number(right.entry?.sortOrder || 0)) || (left.index - right.index))
    .map(({ entry }) => entry);
  const out = {};
  if (sent.length !== saved.length) {
    return out;
  }
  sent.forEach((entry, index) => {
    const id = Number(saved[index]?.id);
    const sameLabel = groupKey(saved[index]?.label) === groupKey(entry?.label);
    const sentKey = groupKey(entry?.key);
    if (sameLabel && sentKey && Number.isInteger(id) && id > 0) {
      out[sentKey] = id;
    }
  });
  return out;
};

