import { computed, unref } from 'vue';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

export const filterExerciseRows = (rows = [], filters = {}) => {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const searchTerm = normalizeText(filters.search);
  const workoutType = normalizeText(filters.workoutType || 'all');
  const muscleGroup = normalizeText(filters.muscleGroup || 'all');
  const equipment = normalizeText(filters.equipment || 'all');
  const ownership = normalizeText(filters.ownership || 'all');

  return normalizedRows.filter((exercise) => {
    const title = normalizeText(exercise?.ExerciseTitle);
    const muscle = normalizeText(exercise?.MuscleGroup);
    const equip = normalizeText(exercise?.Equipment);
    const type = normalizeText(exercise?.WorkoutType);
    const isGlobal = Number(exercise?.IsGlobalExercise || 0) === 1;
    const isOwnedByCurrentUser = Number(exercise?.IsOwnedByCurrentUser || 0) === 1;

    if (workoutType !== 'all' && type !== workoutType) {
      return false;
    }

    if (muscleGroup !== 'all' && muscle !== muscleGroup) {
      return false;
    }

    if (equipment !== 'all' && equip !== equipment) {
      return false;
    }

    if (ownership === 'global' && !isGlobal) {
      return false;
    }

    if ((ownership === 'custom' || ownership === 'mine') && !isOwnedByCurrentUser) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    return title.includes(searchTerm) || muscle.includes(searchTerm) || equip.includes(searchTerm);
  });
};

export const useExerciseFiltering = ({ rowsRef, filtersRef }) => {
  return computed(() => {
    const rows = unref(rowsRef);
    const filters = unref(filtersRef);
    return filterExerciseRows(rows, filters);
  });
};
