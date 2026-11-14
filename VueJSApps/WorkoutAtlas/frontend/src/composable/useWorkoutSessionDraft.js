import { ref } from 'vue';
import { API_BASE } from '@/config/env';

const DRAFT_SAVE_DELAY_MS = 350;

const normalizeNumber = (value) => Number(value || 0);

const normalizeSet = (set = {}, fallbackSetNum = 0) => ({
  setNum: Number(set?.setNum || fallbackSetNum || 0),
  weight: normalizeNumber(set?.weight),
  reps: normalizeNumber(set?.reps),
  duration: normalizeNumber(set?.duration),
  caloriesBurned: normalizeNumber(set?.caloriesBurned),
  distanceMiles: normalizeNumber(set?.distanceMiles),
  speedMph: normalizeNumber(set?.speedMph),
  done: Boolean(set?.done),
  notes: typeof set?.notes === 'string' ? set.notes : '',
  prefilledFields: set?.prefilledFields && typeof set.prefilledFields === 'object'
    ? { ...set.prefilledFields }
    : {},
  prefilledFromLastWorkout: Boolean(set?.prefilledFromLastWorkout),
});

const inferWorkoutTypeFromSet = (set = {}) =>
  Number(set?.duration || 0) > 0 && Number(set?.reps || 0) === 0 ? 'Cardio' : 'Strength';

const normalizeExerciseType = (exercise = {}) => {
  const explicitType = String(exercise?.workoutType || exercise?.WorkoutType || '').trim();
  if (explicitType) {
    return explicitType;
  }

  const firstSet = Array.isArray(exercise?.sessionSets) ? exercise.sessionSets[0] : null;
  return inferWorkoutTypeFromSet(firstSet);
};

const serializeExercise = (exercise = {}) => ({
  id: String(exercise?.id || ''),
  exerciseId: exercise?.exerciseId ?? null,
  workoutScheduleGroupId: Number(exercise?.workoutScheduleGroupId || 0) || null,
  name: String(exercise?.name || '').trim(),
  image: String(exercise?.image || exercise?.ImageURL || '').trim(),
  workoutType: normalizeExerciseType(exercise),
  muscleGroup: String(exercise?.muscleGroup || '').trim(),
  equipment: String(exercise?.equipment || '').trim(),
  sets: Number(exercise?.sets || 0),
  reps: Number(exercise?.reps || 0),
  weight: Number(exercise?.weight || 0),
  duration: Number(exercise?.duration || 0),
  distance: Number(exercise?.distance || 0),
  calories: Number(exercise?.calories || 0),
  restTime: Number(exercise?.restTime || 0),
  notes: typeof exercise?.notes === 'string' ? exercise.notes : '',
  scheduleGroup: String(exercise?.scheduleGroup || '').trim(),
  sortOrder: Number(exercise?.sortOrder || 0),
  sessionSets: Array.isArray(exercise?.sessionSets)
    ? exercise.sessionSets.map((set, index) => normalizeSet(set, index + 1))
    : [],
});

const normalizeDraftExercise = (exercise = {}, index = 0) => {
  const sets = Array.isArray(exercise?.sessionSets)
    ? exercise.sessionSets.map((set, setIndex) => normalizeSet(set, setIndex + 1))
    : [];

  return {
    id: String(exercise?.id || `draft-${index + 1}`),
    exerciseId: Number(exercise?.exerciseId || 0) || null,
    workoutScheduleGroupId: Number(exercise?.workoutScheduleGroupId || 0) || null,
    name: String(exercise?.name || `Exercise ${index + 1}`).trim() || `Exercise ${index + 1}`,
    image: String(exercise?.image || '').trim(),
    workoutType: String(exercise?.workoutType || inferWorkoutTypeFromSet(sets[0])).trim() || inferWorkoutTypeFromSet(sets[0]),
    muscleGroup: String(exercise?.muscleGroup || '').trim(),
    equipment: String(exercise?.equipment || '').trim(),
    sets: Number(exercise?.sets || sets.length || 1),
    reps: Number(exercise?.reps || 0),
    weight: Number(exercise?.weight || 0),
    duration: Number(exercise?.duration || 0),
    distance: Number(exercise?.distance || 0),
    calories: Number(exercise?.calories || 0),
    restTime: Number(exercise?.restTime || 0),
    notes: typeof exercise?.notes === 'string' ? exercise.notes : '',
    scheduleGroup: String(exercise?.scheduleGroup || 'Any Day').trim() || 'Any Day',
    sortOrder: Number(exercise?.sortOrder || index + 1),
    sessionSets: sets,
  };
};

const parseDraftNotes = (notes) => {
  if (!notes) {
    return null;
  }

  if (typeof notes === 'object') {
    return notes;
  }

  if (typeof notes !== 'string') {
    return null;
  }

  try {
    return JSON.parse(notes);
  } catch {
    return null;
  }
};

export function useWorkoutSessionDraft({ activeSession, sessionExercises }) {
  const draftSaveTimer = ref(null);
  const isHydratingDraft = ref(false);
  const isSavingDraft = ref(false);

  const clearWorkoutDraftSave = () => {
    if (draftSaveTimer.value != null) {
      window.clearTimeout(draftSaveTimer.value);
      draftSaveTimer.value = null;
    }
  };

  const getSessionId = () => Number(activeSession.value?.id || 0);

  const buildDraftPayload = () => ({
    version: 2,
    exercises: Array.isArray(sessionExercises.value)
      ? sessionExercises.value.map((exercise) => serializeExercise(exercise))
      : [],
  });

  const applyWorkoutDraft = (draftNotes) => {
    const draft = parseDraftNotes(draftNotes);
    const draftExercises = Array.isArray(draft?.exercises) ? draft.exercises : [];

    if (!draftExercises.length || !Array.isArray(sessionExercises.value)) {
      return false;
    }

    const draftVersion = Number(draft?.version || 1);

    if (draftVersion >= 2) {
      isHydratingDraft.value = true;
      sessionExercises.value = draftExercises.map((exercise, index) => normalizeDraftExercise(exercise, index));
      isHydratingDraft.value = false;
      return true;
    }

    const draftById = new Map(
      draftExercises
        .map((exercise) => [String(exercise?.id || exercise?.exerciseId || ''), exercise])
        .filter(([key]) => Boolean(key))
    );

    if (draftById.size === 0) {
      return false;
    }

    isHydratingDraft.value = true;
    sessionExercises.value = sessionExercises.value.map((exercise) => {
      const draftExercise = draftById.get(String(exercise?.id || exercise?.exerciseId || ''));
      const draftSets = Array.isArray(draftExercise?.sessionSets) ? draftExercise.sessionSets : null;

      if (!draftSets || draftSets.length === 0) {
        return exercise;
      }

      return {
        ...exercise,
        sessionSets: draftSets.map((set, index) => normalizeSet(set, index + 1)),
      };
    });
    isHydratingDraft.value = false;
    return true;
  };

  const persistWorkoutDraft = async () => {
    clearWorkoutDraftSave();

    const sessionId = getSessionId();
    if (!sessionId || isHydratingDraft.value || !activeSession.value) {
      return false;
    }

    isSavingDraft.value = true;
    try {
      const response = await fetch(`${API_BASE}/api/workout-sessions/${sessionId}/draft`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDraftPayload()),
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      isSavingDraft.value = false;
    }
  };

  const queueWorkoutDraftSave = (immediate = false) => {
    if (isHydratingDraft.value || !activeSession.value) {
      return;
    }

    clearWorkoutDraftSave();

    if (immediate) {
      void persistWorkoutDraft();
      return;
    }

    draftSaveTimer.value = window.setTimeout(() => {
      void persistWorkoutDraft();
    }, DRAFT_SAVE_DELAY_MS);
  };

  return {
    applyWorkoutDraft,
    clearWorkoutDraftSave,
    isSavingDraft,
    persistWorkoutDraft,
    queueWorkoutDraftSave,
  };
}