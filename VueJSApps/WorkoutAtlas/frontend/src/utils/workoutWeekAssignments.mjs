export const DEFAULT_WORKOUT_WEEK_NAME = 'Week 1';

const cleanLabel = (value) => String(value || '').trim();

export function normalizeWeekAssignments(assignments = {}, dayGroups = [], weekGroups = []) {
  const weeks = (Array.isArray(weekGroups) ? weekGroups : [])
    .map(cleanLabel)
    .filter(Boolean);
  const fallbackWeek = weeks.find((week) => week.toLowerCase() === DEFAULT_WORKOUT_WEEK_NAME.toLowerCase())
    || weeks[0]
    || DEFAULT_WORKOUT_WEEK_NAME;

  const validWeeks = new Set(weeks.map((week) => week.toLowerCase()));
  const result = {};
  const source = assignments && typeof assignments === 'object' ? assignments : {};

  (Array.isArray(dayGroups) ? dayGroups : []).map(cleanLabel).filter(Boolean).forEach((day) => {
    const direct = cleanLabel(source[day]);
    const matchedKey = Object.keys(source).find((key) => cleanLabel(key).toLowerCase() === day.toLowerCase());
    const matched = direct || cleanLabel(matchedKey ? source[matchedKey] : '');
    const week = validWeeks.size && matched && validWeeks.has(matched.toLowerCase())
      ? weeks.find((candidate) => candidate.toLowerCase() === matched.toLowerCase())
      : fallbackWeek;
    result[day] = week;
  });

  return result;
}

export function ensureDefaultWorkoutWeek(weekGroups = []) {
  const normalized = (Array.isArray(weekGroups) ? weekGroups : []).map(cleanLabel).filter(Boolean);
  const seen = new Set();
  const deduplicated = normalized.filter((week) => {
    const key = week.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduplicated.some((week) => week.toLowerCase() === DEFAULT_WORKOUT_WEEK_NAME.toLowerCase())) {
    return deduplicated.map((week) => week.toLowerCase() === DEFAULT_WORKOUT_WEEK_NAME.toLowerCase()
      ? DEFAULT_WORKOUT_WEEK_NAME
      : week);
  }
  return [DEFAULT_WORKOUT_WEEK_NAME, ...deduplicated];
}

export function validateAdditionalWeekCreation({ weekName, dayGroups = [], weekAssignments = {}, exercises = [] }) {
  const selected = cleanLabel(weekName);
  if (!selected) {
    return { ok: false, message: 'Select a workout week before adding another week.' };
  }

  const normalizedAssignments = weekAssignments && typeof weekAssignments === 'object'
    ? weekAssignments
    : {};
  const assignedDayNames = (Array.isArray(dayGroups) ? dayGroups : [])
    .map(cleanLabel)
    .filter((day) => {
      const assignment = Object.keys(normalizedAssignments).find(
        (key) => cleanLabel(key).toLowerCase() === day.toLowerCase()
      );
      const assignedWeek = assignment ? cleanLabel(normalizedAssignments[assignment]) : DEFAULT_WORKOUT_WEEK_NAME;
      return assignedWeek.toLowerCase() === selected.toLowerCase();
    });

  if (!assignedDayNames.length) {
    return { ok: false, message: 'Add at least one workout day to the selected week before adding another week.' };
  }

  const assignedDayKeys = new Set(assignedDayNames.map((day) => day.toLowerCase()));
  const hasExercise = (Array.isArray(exercises) ? exercises : []).some((exercise) => {
    const scheduleGroup = cleanLabel(exercise?.scheduleGroup);
    return assignedDayKeys.has(scheduleGroup.toLowerCase());
  });

  if (!hasExercise) {
    return { ok: false, message: 'Add at least one exercise to a workout day in the selected week before adding another week.' };
  }

  return { ok: true };
}

export function resolveSelectedWorkoutWeek(selectedWeekName = '', weekGroups = []) {
  const weeks = ensureDefaultWorkoutWeek(weekGroups);
  const selected = cleanLabel(selectedWeekName);
  if (selected) {
    const matched = weeks.find((week) => week.toLowerCase() === selected.toLowerCase());
    if (matched) return matched;
  }
  return DEFAULT_WORKOUT_WEEK_NAME;
}

export function resolveAssignedWorkoutDays(dayGroups = [], weekAssignments = {}, selectedWeekName = DEFAULT_WORKOUT_WEEK_NAME) {
  const selected = cleanLabel(selectedWeekName) || DEFAULT_WORKOUT_WEEK_NAME;
  return (Array.isArray(dayGroups) ? dayGroups : []).map(cleanLabel).filter(Boolean).filter((day) => {
    const exactKey = Object.keys(weekAssignments || {}).find((key) => cleanLabel(key).toLowerCase() === day.toLowerCase());
    const assigned = exactKey ? cleanLabel(weekAssignments[exactKey]) : DEFAULT_WORKOUT_WEEK_NAME;
    return (assigned || DEFAULT_WORKOUT_WEEK_NAME).toLowerCase() === selected.toLowerCase();
  });
}
