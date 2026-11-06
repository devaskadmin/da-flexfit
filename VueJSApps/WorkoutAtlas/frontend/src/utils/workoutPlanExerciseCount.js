const normalizeExerciseName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return normalized.replace(/\s+/g, ' ');
};

const toUniqueExerciseKey = (exercise = {}) => {
  const candidateIds = [exercise?.exerciseId, exercise?.ExerciseID];
  for (const candidate of candidateIds) {
    const numericId = Number(candidate || 0);
    if (Number.isFinite(numericId) && numericId > 0) {
      return `id:${numericId}`;
    }
  }

  const normalizedName = normalizeExerciseName(
    exercise?.name || exercise?.exerciseName || exercise?.ExerciseTitle || exercise?.title || ''
  );
  if (!normalizedName) {
    return '';
  }
  return `name:${normalizedName}`;
};

export const countUniqueWorkoutPlanExercises = (exercises = []) => {
  if (!Array.isArray(exercises) || !exercises.length) {
    return 0;
  }

  const unique = new Set();
  exercises.forEach((exercise) => {
    const key = toUniqueExerciseKey(exercise);
    if (key) {
      unique.add(key);
    }
  });

  return unique.size;
};
