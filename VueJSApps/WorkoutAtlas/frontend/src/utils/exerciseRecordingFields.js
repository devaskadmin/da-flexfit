export const normalizeRecordingType = (exerciseOrValue = {}) => {
  const raw = typeof exerciseOrValue === 'object'
    ? String(exerciseOrValue.recordingType ?? exerciseOrValue.RecordingType ?? '').trim()
    : String(exerciseOrValue || '').trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

  if (normalized === 'custom') return 'custom';
  if (normalized === 'time & distance' || normalized === 'time distance') return 'time-distance';
  if (normalized === 'sets & reps' || normalized === 'sets reps') return 'sets-reps';

  if (!raw && typeof exerciseOrValue === 'object') {
    const workoutType = String(exerciseOrValue.workoutType ?? exerciseOrValue.WorkoutType ?? '').trim().toLowerCase();
    if (workoutType === 'cardio') return 'time-distance';
    if (workoutType === 'strength') return 'sets-reps';
  }
  return '';
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
  weight: 'Weight (lbs)',
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
