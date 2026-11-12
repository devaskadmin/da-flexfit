const normalizeLabel = (value) => String(value || '').trim();

const normalizeKey = (value) => normalizeLabel(value).toLowerCase();

export const selectExpandedPlanDuringSessionRecovery = ({ currentPlan = null, sessionPlanId = '' } = {}) =>
  normalizeLabel(sessionPlanId) ? null : currentPlan;

export const selectTabDuringSessionRecovery = ({ currentTab = 'overview', activateTab = true } = {}) =>
  activateTab ? 'dayDetails' : currentTab;

export const buildWorkoutLogExerciseGroups = ({ groups = [], exercises = [] } = {}) => {
  const normalizedExercises = Array.isArray(exercises) ? exercises : [];
  const normalizedGroups = Array.isArray(groups) ? groups : [];

  const fallbackGroup = normalizeLabel(normalizedGroups[0] || 'Any Day') || 'Any Day';

  const exerciseBuckets = new Map();
  for (const exercise of normalizedExercises) {
    const label = normalizeLabel(exercise?.scheduleGroup || fallbackGroup) || fallbackGroup;
    const key = normalizeKey(label);
    if (!exerciseBuckets.has(key)) {
      exerciseBuckets.set(key, { name: label, exercises: [] });
    }
    exerciseBuckets.get(key).exercises.push(exercise);
  }

  const groupedByConfiguredOrder = [];
  for (const configuredGroup of normalizedGroups) {
    const label = normalizeLabel(configuredGroup);
    if (!label) continue;
    const key = normalizeKey(label);
    const bucket = exerciseBuckets.get(key);
    if (bucket && bucket.exercises.length) {
      groupedByConfiguredOrder.push({ name: label, exercises: bucket.exercises });
    }
  }

  if (groupedByConfiguredOrder.length > 0) {
    return groupedByConfiguredOrder;
  }

  return Array.from(exerciseBuckets.values()).filter((bucket) => bucket.exercises.length > 0);
};

export const filterWorkoutLogDayExercises = ({ selectedDay, exercises = [], fallbackGroup = '' } = {}) => {
  const selectedDayKey = normalizeKey(selectedDay);
  if (!selectedDayKey) return [];

  const normalizedExercises = Array.isArray(exercises) ? exercises : [];
  const safeFallback = normalizeLabel(fallbackGroup);

  return normalizedExercises.filter((exercise) => {
    const scheduleGroup = normalizeLabel(exercise?.scheduleGroup || safeFallback);
    return normalizeKey(scheduleGroup) === selectedDayKey;
  });
};
