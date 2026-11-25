export const normalizeRecordingType = (exerciseOrValue = {}) => {
  const raw = typeof exerciseOrValue === 'object'
    ? String(exerciseOrValue.recordingType ?? exerciseOrValue.RecordingType ?? '').trim()
    : String(exerciseOrValue || '').trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

  if (normalized === 'custom') return 'custom';
  if (normalized === 'time & distance' || normalized === 'time distance') return 'time-distance';
  if (normalized === 'sets & reps' || normalized === 'sets reps') return 'sets-reps';
  return '';
};

// 0.85.317: saved plan exercises do not carry Recording Type (the plan API returns no RecordingType column), so a loaded
// exercise is resolved from the Exercise Database catalog by exercise id. An explicit Recording Type on the exercise always
// wins; Workout Type is never used. Returns the stored catalog value (e.g. 'Time & Distance') or '' when unknown.
export const buildCatalogRecordingTypeMap = (catalog = []) => {
  const map = new Map();
  if (!Array.isArray(catalog)) return map;
  catalog.forEach((entry) => {
    const id = Number(entry?.ExerciseID ?? entry?.exerciseId ?? 0);
    if (id > 0 && normalizeRecordingType(entry)) {
      map.set(id, String(entry.RecordingType ?? entry.recordingType).trim());
    }
  });
  return map;
};

export const resolveExerciseRecordingType = (exercise = {}, catalogRecordingTypes = new Map()) => {
  if (normalizeRecordingType(exercise)) {
    return String(exercise.recordingType ?? exercise.RecordingType).trim();
  }
  const id = Number(exercise?.exerciseId ?? exercise?.ExerciseID ?? 0);
  return (id > 0 && catalogRecordingTypes.get(id)) || '';
};

export const getRecordingFieldGroups = (exerciseOrValue = {}) => {
  const recordingType = normalizeRecordingType(exerciseOrValue);
  const usesTimePrimary = recordingType === 'time-distance';

  return {
    recordingType,
    primary: usesTimePrimary
      ? ['duration', 'calories', 'distance']
      : ['weight', 'reps', 'sets'],
    secondary: usesTimePrimary
      ? ['weight', 'reps', 'sets']
      : ['duration', 'calories', 'distance'],
  };
};

export const getRecordingFieldLabels = () => ({
  weight: 'LBS',
  reps: 'Reps',
  sets: 'Sets',
  duration: 'Target Time (min)',
  calories: 'Target Calories',
  distance: 'Distance (mi)',
});

export const normalizeWorkoutTypeBadge = (exerciseOrValue = {}) => {
  const raw = typeof exerciseOrValue === 'object'
    ? String(
        exerciseOrValue.workoutType ??
        exerciseOrValue.WorkoutType ??
        exerciseOrValue.workout_type ??
        exerciseOrValue.type ??
        ''
      ).trim()
    : String(exerciseOrValue || '').trim();
  const normalized = raw.toLowerCase();
  if (normalized === 'cardio') return 'Cardio';
  if (normalized === 'other') return 'Other';
  if (normalized === 'strength') return 'Strength';
  return '';
};
