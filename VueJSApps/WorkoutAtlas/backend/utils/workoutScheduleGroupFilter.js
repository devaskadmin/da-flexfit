// 0.85.313.a3.3: schedule group filtering.
//
// Since 0.85.313.a3.2 a plan stores both its day set (group_type day/any/section) and its
// week set (group_type week). Week rows are containers, not workout days. Readers that
// list or count "days" must use only the family that matches the plan's schedule_mode:
//   - schedule_mode 'day' (default): every group_type except 'week'.
//   - schedule_mode 'week' (legacy Week View): only 'week' groups, exactly as before,
//     because in that mode the week groups are the plan's workout groups.
// Pure helpers only; nothing here reads or writes a database.

const normalizeScheduleMode = (mode) => (
  String(mode || 'day').trim().toLowerCase() === 'week' ? 'week' : 'day'
);

const isWeekGroupType = (groupType) => String(groupType || '').trim().toLowerCase() === 'week';

// True when a group of this type is a workout group for a plan in this schedule mode.
const isGroupInScheduleMode = (groupType, scheduleMode) => (
  normalizeScheduleMode(scheduleMode) === 'week'
    ? isWeekGroupType(groupType)
    : !isWeekGroupType(groupType)
);

const filterGroupsForScheduleMode = (groupRows, scheduleMode) => (
  (Array.isArray(groupRows) ? groupRows : []).filter((row) => isGroupInScheduleMode(row?.group_type, scheduleMode))
);

// SQL predicate with the same rule. Both aliases are developer-supplied constants
// (never user input) and are validated as plain identifiers.
const buildScheduleModeGroupFilterSql = (groupAlias, scheduleAlias) => {
  const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (!identifier.test(groupAlias) || !identifier.test(scheduleAlias)) {
    throw new Error('Invalid SQL alias for schedule group filter.');
  }
  return `((${scheduleAlias}.schedule_mode = 'week' AND ${groupAlias}.group_type = 'week')
          OR (COALESCE(${scheduleAlias}.schedule_mode, 'day') <> 'week' AND ${groupAlias}.group_type <> 'week'))`;
};

module.exports = {
  normalizeScheduleMode,
  isWeekGroupType,
  isGroupInScheduleMode,
  filterGroupsForScheduleMode,
  buildScheduleModeGroupFilterSql,
};
