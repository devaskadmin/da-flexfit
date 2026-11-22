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
