// 0.85.313.a8.1: stable schedule group identity view.
//
// workout_schedule_groups has no unique (schedule, label) constraint, so two days in different
// weeks may share a display name. Group IDs are the identity; labels are display only.
// Many readers (Workout Log, plan detail, previews) still key a day by its label, so the API exposes
// each day under a unique compatibility name:
//   - the first day (sort order, id) with a label keeps the bare label (legacy plans are unchanged);
//   - later days that share the label are exposed as "<label> (<week label>)" (or "<label> (2)").
// The real label is always kept in `label`. Pure helpers; nothing here reads or writes a database.

const {
  extractDayWeekAssignments,
  extractDayWeekAssignmentsById,
} = require('./workoutPlanSettings');

const DAY_GROUP_TYPES = new Set(['day', 'any', 'section']);

const lower = (value) => String(value ?? '').trim().toLowerCase();
const labelOf = (row) => String(row?.label ?? '').trim();
const typeOf = (row) => String(row?.group_type ?? '').trim().toLowerCase();

const sortRows = (rows) => [...rows].sort((left, right) => (
  (Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
  || (Number(left?.id || 0) - Number(right?.id || 0))
));

const buildUniqueNames = (days) => {
  const used = new Set();
  return days.map((day) => {
    const baseKey = lower(day.label);
    let name = day.label;
    if (used.has(baseKey)) {
      const withWeek = day.weekLabel ? `${day.label} (${day.weekLabel})` : '';
      if (withWeek && !used.has(lower(withWeek))) {
        name = withWeek;
      } else {
        let counter = 2;
        while (used.has(lower(`${day.label} (${counter})`))) {
          counter += 1;
        }
        name = `${day.label} (${counter})`;
      }
    }
    used.add(lower(name));
    return name;
  });
};

// groupRows: workout_schedule_groups rows ({ id, label, group_type, sort_order }).
// settingsJson: workout_schedules.settings_json (raw string/object/null).
const buildScheduleGroupView = ({ groupRows = [], settingsJson = null } = {}) => {
  const rows = sortRows((Array.isArray(groupRows) ? groupRows : []).filter((row) => labelOf(row)));
  const weekRows = rows.filter((row) => typeOf(row) === 'week');
  const dayRows = rows.filter((row) => DAY_GROUP_TYPES.has(typeOf(row)));

  const legacyAssignments = extractDayWeekAssignments(settingsJson);
  const assignmentsById = extractDayWeekAssignmentsById(settingsJson);
  const hasIdAssignments = Object.keys(assignmentsById).length > 0;

  const weekById = new Map(weekRows.map((row) => [Number(row.id), row]));
  const weekByLabel = new Map();
  weekRows.forEach((row) => {
    if (!weekByLabel.has(lower(row.label))) {
      weekByLabel.set(lower(row.label), row);
    }
  });

  const days = dayRows.map((row) => {
    const explicit = weekById.get(Number(assignmentsById[String(row.id)])) || null;
    const legacy = explicit ? null : (weekByLabel.get(lower(legacyAssignments[lower(row.label)])) || null);
    const assignedWeek = explicit || legacy;
    const displayWeek = assignedWeek || weekRows[0] || null;
    return {
      id: Number(row.id),
      label: labelOf(row),
      groupType: typeOf(row),
      sortOrder: Number(row.sort_order || 0),
      weekId: assignedWeek ? Number(assignedWeek.id) : null,
      weekLabel: displayWeek ? labelOf(displayWeek) : '',
      assignedWeekLabel: assignedWeek ? labelOf(assignedWeek) : '',
      row,
    };
  });

  const names = buildUniqueNames(days);
  days.forEach((day, index) => {
    day.name = names[index];
  });

  const weeks = weekRows.map((row) => ({
    id: Number(row.id),
    label: labelOf(row),
    name: labelOf(row),
    groupType: 'week',
    sortOrder: Number(row.sort_order || 0),
    row,
  }));

  const hasDuplicateLabels = days.some((day) => day.name !== day.label);
  let assignments = legacyAssignments;
  if (hasIdAssignments || hasDuplicateLabels) {
    assignments = {};
    days.forEach((day) => {
      if (day.assignedWeekLabel) {
        assignments[lower(day.name)] = day.assignedWeekLabel;
      }
    });
  }

  const nameByGroupId = new Map(days.map((day) => [day.id, day.name]));
  return { days, weeks, assignments, nameByGroupId, hasDuplicateLabels };
};

// Compatibility names for a schedule's day rows ordered like the input rows' sort order.
// Returns Map(groupId -> unique name). Used by readers that only have group rows.
const buildDayNameMapForRows = (groupRows, settingsJson) => (
  buildScheduleGroupView({ groupRows, settingsJson }).nameByGroupId
);

module.exports = {
  buildScheduleGroupView,
  buildDayNameMapForRows,
};
