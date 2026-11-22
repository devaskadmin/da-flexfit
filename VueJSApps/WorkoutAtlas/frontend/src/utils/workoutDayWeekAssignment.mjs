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
 * Message for a day name that already exists. Day names are unique across the whole plan
 * (exercises, saved groups and assignments are all keyed by day name), so a duplicate that lives
 * in another week says so instead of looking like a bug in the filtered view.
 */
export const buildDuplicateDayMessage = ({
  name = '',
  dayGroups = [],
  weekGroups = [],
  assignments = {},
  week = '',
} = {}) => {
  const label = String(name ?? '').trim();
  const existing = (Array.isArray(dayGroups) ? dayGroups : []).find((day) => groupKey(day) === groupKey(label));
  if (existing === undefined) {
    return `${label} already exists.`;
  }
  const existingWeek = weekOfDay(assignments, weekGroups, existing);
  if (existingWeek && groupKey(existingWeek) !== groupKey(week)) {
    return `${label} already exists in ${existingWeek}. Day names must be unique across all weeks.`;
  }
  return `${label} already exists.`;
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

