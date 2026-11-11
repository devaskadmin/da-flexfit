<script setup>
import { computed, ref, watch } from 'vue';
import { DEFAULT_EXERCISE_IMAGE, getExerciseImage } from '@/utils/exerciseImage';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  exercises: {
    type: Array,
    default: () => [],
  },
  userId: {
    type: [Number, String],
    default: null,
  },
  waitForAddConfirmation: {
    type: Boolean,
    default: false,
  },
  selectionOnlyWorkflow: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'add']);

const search = ref('');
const muscle = ref('All');
const equipment = ref('All');
const viewFilter = ref('all'); // 'all' | 'mine' | 'favorites'
const selectedExerciseIds = ref([]);
const selectedExercisesById = ref(new Map());
const addingSelectedExercises = ref(false);
const showSelectedExercises = ref(false);
const PAGE_SIZE = 5;
const visibleCount = ref(PAGE_SIZE);

const clearExerciseSelection = () => {
  selectedExerciseIds.value = [];
  selectedExercisesById.value = new Map();
  addingSelectedExercises.value = false;
};

const completeExerciseAddition = () => {
  clearExerciseSelection();
  if (props.selectionOnlyWorkflow) {
    emit('close');
  }
};

const rejectExerciseAddition = () => {
  addingSelectedExercises.value = false;
};

watch(
  () => props.isOpen,
  (open) => {
    if (!open) {
      search.value = '';
      muscle.value = 'All';
      equipment.value = 'All';
      viewFilter.value = 'all';
      showSelectedExercises.value = false;
      visibleCount.value = PAGE_SIZE;
      clearExerciseSelection();
    }
  }
);

// Reset pagination when any filter changes
watch([search, muscle, equipment, viewFilter], () => {
  visibleCount.value = PAGE_SIZE;
});

const muscleOptions = computed(() => {
  const values = new Set(props.exercises.map((exercise) => exercise.MuscleGroup).filter(Boolean));
  return ['All', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
});

const equipmentOptions = computed(() => {
  const values = new Set(props.exercises.map((exercise) => exercise.Equipment).filter(Boolean));
  return ['All', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
});

const filteredExercises = computed(() => {
  const searchValue = search.value.trim().toLowerCase();
  const currentUserId = Number(props.userId || 0);

  return props.exercises.filter((exercise) => {
    // View filter
    if (viewFilter.value === 'mine') {
      if (!currentUserId || Number(exercise.IsOwnedByCurrentUser || 0) !== 1) return false;
    } else if (viewFilter.value === 'favorites') {
      if (Number(exercise.IsFavorite || 0) !== 1) return false;
    }

    const title = (exercise.ExerciseTitle || '').toLowerCase();
    const exerciseMuscle = exercise.MuscleGroup || '';
    const exerciseEquipment = exercise.Equipment || '';

    const matchesSearch = !searchValue || title.includes(searchValue);
    const matchesMuscle = muscle.value === 'All' || exerciseMuscle === muscle.value;
    const matchesEquipment = equipment.value === 'All' || exerciseEquipment === equipment.value;

    return matchesSearch && matchesMuscle && matchesEquipment;
  });
});

const emptyMessage = computed(() => {
  if (viewFilter.value === 'mine') return 'No custom exercises found.';
  if (viewFilter.value === 'favorites') return 'No favorite exercises found.';
  return 'No exercises match your filters.';
});

const loadMore = () => {
  visibleCount.value += PAGE_SIZE;
};

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    emit('close');
  }
};

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  },
  { immediate: true }
);

const getPrimaryImage = (exercise) => getExerciseImage(exercise);

const onImageError = (event) => {
  if (event?.target && event.target.src !== DEFAULT_EXERCISE_IMAGE) {
    event.target.src = DEFAULT_EXERCISE_IMAGE;
  }
};

const mapExerciseForEmit = (exercise) => ({
  ExerciseID: exercise.ExerciseID,
  ExerciseTitle: exercise.ExerciseTitle,
  WorkoutType: exercise.WorkoutType,
  MuscleGroup: exercise.MuscleGroup,
  Equipment: exercise.Equipment,
  image: getPrimaryImage(exercise),
});

const toggleExerciseSelection = (exercise) => {
  const id = Number(exercise?.ExerciseID || 0);
  if (!id) {
    return;
  }

  const index = selectedExerciseIds.value.indexOf(id);
  if (index >= 0) {
    selectedExerciseIds.value.splice(index, 1);
    const nextExercisesById = new Map(selectedExercisesById.value);
    nextExercisesById.delete(id);
    selectedExercisesById.value = nextExercisesById;
    return;
  }

  selectedExerciseIds.value.push(id);
  selectedExercisesById.value = new Map(selectedExercisesById.value).set(id, mapExerciseForEmit(exercise));
};

const isExerciseSelected = (exercise) => {
  const id = Number(exercise?.ExerciseID || 0);
  return id > 0 && selectedExerciseIds.value.includes(id);
};

const selectedExercisesPayload = computed(() => {
  if (!selectedExerciseIds.value.length) {
    return [];
  }

  // Preserve explicit click-selection order.
  return selectedExerciseIds.value
    .map((id) => selectedExercisesById.value.get(id))
    .filter(Boolean);
});

const visibleExercises = computed(() => {
  if (props.selectionOnlyWorkflow && showSelectedExercises.value) {
    return selectedExercisesPayload.value;
  }

  return filteredExercises.value.slice(0, visibleCount.value);
});

const addSelectedExercises = () => {
  if (!selectedExercisesPayload.value.length || addingSelectedExercises.value) {
    return;
  }

  addingSelectedExercises.value = true;
  if (props.waitForAddConfirmation) {
    emit('add', selectedExercisesPayload.value, completeExerciseAddition, rejectExerciseAddition);
    return;
  }

  emit('add', selectedExercisesPayload.value);
  clearExerciseSelection();
};

const quickAdd = (exercise) => {
  emit('add', mapExerciseForEmit(exercise));
};
</script>

<template>
  <div v-if="isOpen" class="picker-overlay" @click.self="emit('close')">
    <div class="picker-modal">
      <div class="picker-head">
        <div>
          <h3>Add Exercise</h3>
          <p>Search and add exercises without leaving your workout flow.</p>
        </div>
        <button type="button" class="btn-close" @click="emit('close')">✕</button>
      </div>

      <!-- View segmented control -->
      <div class="picker-view-tabs">
        <div class="picker-view-tabs__inner picker-content-shell">
          <button
            type="button"
            :class="['view-tab', viewFilter === 'all' && 'view-tab--active']"
            @click="viewFilter = 'all'"
          >All Exercises</button>
          <button
            type="button"
            :class="['view-tab', viewFilter === 'mine' && 'view-tab--active']"
            @click="viewFilter = 'mine'"
          >My Exercises</button>
          <button
            type="button"
            :class="['view-tab', viewFilter === 'favorites' && 'view-tab--active']"
            @click="viewFilter = 'favorites'"
          >Favorites</button>
        </div>
      </div>

      <div class="picker-filters">
        <div class="picker-filters__inner picker-content-shell">
          <div class="picker-filter-field">
            <label for="picker-search">Search</label>
            <input
              id="picker-search"
              v-model="search"
              type="text"
              placeholder="Search by exercise name"
            />
          </div>

          <div class="picker-filter-field">
            <label for="picker-category">Category</label>
            <select id="picker-category" v-model="muscle">
              <option v-for="option in muscleOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <div class="picker-filter-field">
            <label for="picker-equipment">Equipment</label>
            <select id="picker-equipment" v-model="equipment">
              <option v-for="option in equipmentOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="selectionOnlyWorkflow || filteredExercises.length > 0" class="picker-count">
        <div class="picker-count__inner picker-content-shell">
          <span v-if="showSelectedExercises">
            Showing {{ selectedExerciseIds.length }} selected {{ selectedExerciseIds.length === 1 ? 'exercise' : 'exercises' }}
          </span>
          <span v-else>
            Showing {{ Math.min(visibleCount, filteredExercises.length) }} of {{ filteredExercises.length }} exercises
          </span>
          <button
            v-if="selectionOnlyWorkflow"
            type="button"
            class="btn-show-selected"
            :aria-pressed="showSelectedExercises"
            @click="showSelectedExercises = !showSelectedExercises"
          >
            {{ showSelectedExercises ? 'Show All Exercises' : `Show Selected (${selectedExerciseIds.length})` }}
          </button>
        </div>
      </div>

      <div class="picker-results">
        <div class="picker-results__inner picker-content-shell">
          <article
            v-for="exercise in visibleExercises"
            :key="exercise.ExerciseID"
            :class="['picker-card', isExerciseSelected(exercise) && 'picker-card--selected']"
          >
            <img
              :src="getPrimaryImage(exercise)"
              :alt="exercise.ExerciseTitle"
              loading="lazy"
              @error="onImageError"
            />
            <div class="picker-card__meta">
              <h4>{{ exercise.ExerciseTitle }}</h4>
              <div class="picker-chip-row">
                <span class="picker-chip">{{ exercise.WorkoutType || 'General' }}</span>
                <span class="picker-chip">{{ exercise.MuscleGroup || 'N/A' }}</span>
                <span class="picker-chip">{{ exercise.Equipment || 'Bodyweight' }}</span>
              </div>
            </div>
            <div class="picker-card__actions">
              <button
                v-if="!selectionOnlyWorkflow"
                type="button"
                :class="['picker-icon-btn', 'picker-icon-btn--select', isExerciseSelected(exercise) && 'is-active']"
                :aria-pressed="isExerciseSelected(exercise)"
                :title="isExerciseSelected(exercise) ? 'Deselect exercise' : 'Select exercise'"
                @click="toggleExerciseSelection(exercise)"
              >
                <span class="icon-check" aria-hidden="true"></span>
                <span class="sr-only">Select exercise</span>
              </button>
              <button
                type="button"
                :class="['picker-icon-btn', 'picker-icon-btn--add', selectionOnlyWorkflow && isExerciseSelected(exercise) && 'is-active']"
                :aria-pressed="selectionOnlyWorkflow ? isExerciseSelected(exercise) : undefined"
                :title="selectionOnlyWorkflow ? (isExerciseSelected(exercise) ? 'Deselect exercise' : 'Select exercise') : 'Add exercise'"
                @click="selectionOnlyWorkflow ? toggleExerciseSelection(exercise) : quickAdd(exercise)"
              >
                <span :class="selectionOnlyWorkflow && isExerciseSelected(exercise) ? 'icon-minus' : 'icon-plus'" aria-hidden="true"></span>
                <span class="sr-only">{{ selectionOnlyWorkflow ? (isExerciseSelected(exercise) ? 'Deselect exercise' : 'Select exercise') : 'Add exercise' }}</span>
              </button>
            </div>
          </article>

          <div v-if="visibleExercises.length === 0" class="picker-empty">
            {{ showSelectedExercises ? 'No exercises selected.' : emptyMessage }}
          </div>

          <div v-if="!showSelectedExercises && visibleCount < filteredExercises.length" class="picker-load-more">
            <button type="button" class="btn-load-more" @click="loadMore">Load More</button>
          </div>
        </div>
      </div>

      <div class="picker-footer">
        <div class="picker-footer__inner picker-content-shell">
          <span class="picker-footer__count">
            {{ selectionOnlyWorkflow ? `Add to Workout Day (${selectedExerciseIds.length})` : `${selectedExerciseIds.length} selected` }}
          </span>
          <button
            type="button"
            class="btn-add-selected"
            :disabled="selectedExerciseIds.length === 0 || addingSelectedExercises"
            @click="addSelectedExercises"
          >
            {{ selectionOnlyWorkflow ? 'Add Selected Exercises & Close' : `Add to Workout Day (${selectedExerciseIds.length})` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 10, 24, 0.78);
  display: grid;
  place-items: center;
  z-index: 2000;
  padding: 16px;
  pointer-events: auto;
}

.picker-modal {
  --picker-side-gutter: 18px;
  position: relative;
  z-index: 1;
  width: min(720px, 100%);
  max-height: 72vh;
  overflow: hidden;
  background: linear-gradient(180deg, #132646 0%, #172c4f 100%);
  border-radius: 18px;
  border: 1px solid rgba(147, 185, 245, 0.38);
  box-shadow: 0 24px 44px rgba(1, 7, 18, 0.58), inset 0 1px 0 rgba(228, 240, 255, 0.08);
  display: grid;
  grid-template-rows: auto auto auto auto 1fr auto;
}

.picker-modal,
.picker-modal * {
  box-sizing: border-box;
}

.picker-content-shell {
  width: calc(100% - (var(--picker-side-gutter) * 2));
  margin-inline: auto;
}

.picker-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px var(--picker-side-gutter);
  border-bottom: 1px solid rgba(142, 180, 241, 0.32);
  background: linear-gradient(180deg, #10213d 0%, #152a4a 100%);
}

.picker-head h3 {
  margin: 0;
  font-size: 1rem;
  color: #eef5ff;
}

.picker-head p {
  margin: 2px 0 0;
  color: #c2d8f6;
  font-size: 0.9rem;
}

.btn-close {
  border: 1px solid var(--wa-btn-danger-border, #dc2626);
  background: var(--wa-btn-danger, #3b1d2b);
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: 5px;
  margin: 4px 0 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-image: none;
  opacity: 1;
}

.btn-close:hover,
.btn-close:focus {
  background: var(--wa-btn-danger-hover, #512334);
  border-color: var(--wa-btn-danger-border, #dc2626);
  color: #ffffff;
  opacity: 1;
}

.picker-filters {
  position: relative;
  z-index: 1;
  padding: 12px 0 10px;
  border-top: none;
  border-bottom: 1px solid rgba(142, 180, 241, 0.28);
  background: linear-gradient(180deg, #142946 0%, #182f52 100%);
}

.picker-filters__inner {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 8px;
}

.picker-filter-field {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.picker-filter-field label {
  color: #d7e7ff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.picker-filters input,
.picker-filters select {
  position: relative;
  z-index: 2;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid rgba(168, 199, 245, 0.46);
  border-radius: 10px;
  background: #0f213d;
  color: #eef5ff;
  padding: 8px 10px;
  font-size: 0.88rem;
  height: 38px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-filters select {
  -webkit-appearance: none;
  appearance: none;
  padding-right: 26px;
  background-image: linear-gradient(45deg, transparent 50%, #b9d2fb 50%),
    linear-gradient(135deg, #b9d2fb 50%, transparent 50%);
  background-position: calc(100% - 16px) center, calc(100% - 11px) center;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.picker-filters input::placeholder {
  color: #b4cbeb;
}

.picker-filters input:focus,
.picker-filters select:focus {
  border-color: rgba(190, 216, 255, 0.72);
  box-shadow: 0 0 0 0.2rem rgba(37, 99, 235, 0.25);
  outline: none;
}

.picker-filters select option {
  background: #132746;
  color: #eef5ff;
}

.picker-view-tabs {
  padding: 7px 0;
  border-bottom: none;
  background: #142a49;
}

.picker-view-tabs__inner {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 6px;
}

.view-tab {
  border: 1px solid transparent;
  background: #1e4f9d;
  border-radius: 0 !important;
  margin: 0;
  padding: 7px 10px;
  min-height: 32px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  text-align: center;
  transition: filter 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
}

.picker-view-tabs .view-tab:first-child,
.picker-view-tabs .view-tab:last-child {
  border-radius: 0 !important;
}

.view-tab:nth-child(1) {
  background: #1d4f9f;
}

.view-tab:nth-child(2) {
  background: #0d5b55;
}

.view-tab:nth-child(3) {
  background: #8f1f2a;
}

.view-tab:hover {
  filter: brightness(1.08);
}

.view-tab--active {
  color: #ffffff;
  box-shadow: inset 0 -2px 0 #9fc3ff, 0 0 0 1px rgba(196, 220, 255, 0.28);
  filter: brightness(1.2);
}

.view-tab:active {
  transform: translateY(1px);
}

.picker-count {
  padding: 5px 0;
  font-size: 0.76rem;
  color: #c2d8f6;
  border-bottom: 1px solid rgba(142, 180, 241, 0.24);
  background: #162d4f;
}

.picker-count__inner {
  width: calc(100% - (var(--picker-side-gutter) * 2));
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn-show-selected {
  flex: 0 0 auto;
  border: 1px solid rgba(145, 184, 242, 0.6);
  background: #1f4f91;
  color: #ffffff;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.1;
  cursor: pointer;
}

.btn-show-selected:hover,
.btn-show-selected:focus-visible,
.btn-show-selected[aria-pressed='true'] {
  background: #2563a9;
  border-color: #9fc3ff;
}

.picker-results {
  overflow: auto;
  padding: 10px 0;
  background: #152c4d;
  scrollbar-width: thin;
  scrollbar-color: rgba(154, 191, 246, 0.55) transparent;
}

.picker-results__inner {
  display: grid;
  gap: 10px;
}

.picker-results::-webkit-scrollbar {
  width: 8px;
}

.picker-results::-webkit-scrollbar-track {
  background: transparent;
}

.picker-results::-webkit-scrollbar-thumb {
  background: rgba(154, 191, 246, 0.45);
  border-radius: 8px;
}

.picker-load-more {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.btn-load-more {
  border: 1px solid #4f87f7;
  background: #1f3d6d;
  color: #f6faff;
  font-weight: 700;
  border-radius: 10px;
  padding: 8px 24px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}

.btn-load-more:hover {
  background: #2c4e86;
  color: #ffffff;
}

.picker-card {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(147, 186, 245, 0.34);
  border-radius: 10px;
  padding: 9px;
  background: linear-gradient(180deg, #182f53 0%, #1d375e 100%);
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.picker-card:hover {
  border-color: rgba(133, 180, 252, 0.56);
  transform: translateY(-1px);
}

.picker-card--selected {
  border-color: #4f87f7;
  background: linear-gradient(180deg, #1b3963 0%, #224573 100%);
  box-shadow: inset 0 0 0 1px rgba(111, 160, 248, 0.5), 0 0 0 1px rgba(111, 160, 248, 0.24);
}

.picker-card img {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 8px;
  background: #0f213b;
  border: 1px solid rgba(140, 178, 237, 0.32);
}

.picker-card__meta h4 {
  margin: 0;
  color: #f0f7ff;
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.2;
}

.picker-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 4px;
}

.picker-chip {
  background: rgba(71, 127, 220, 0.2);
  color: #d9e9ff;
  border: 1px solid rgba(145, 184, 242, 0.36);
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
}

.btn-add {
  border: 1px solid #2f6be7;
  background: #2563eb;
  color: #fff;
  font-weight: 600;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.78rem;
  line-height: 1.1;
}

.btn-add:hover,
.btn-add:focus {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.picker-card__actions {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  min-width: 100px;
}

.picker-icon-btn {
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  max-width: 42px;
  max-height: 42px;
  flex: 0 0 42px;
  border-radius: 10px;
  border: none;
  background: #244a7e;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: transform 0.12s ease, filter 0.15s ease;
}

.picker-icon-btn:hover {
  filter: brightness(1.08);
}

.picker-icon-btn:active {
  transform: translateY(1px);
}

.picker-icon-btn--select {
  background: #2563eb;
}

.picker-icon-btn--select:hover {
  background: #3b82f6;
}

.picker-icon-btn--select.is-active {
  background: #1d4ed8;
  box-shadow: 0 0 0 2px rgba(168, 208, 255, 0.5), inset 0 1px 0 rgba(233, 244, 255, 0.2);
}

.picker-icon-btn--add {
  background: #0f766e;
}

.picker-icon-btn--add:hover {
  background: #0d9488;
}

.picker-icon-btn--add.is-active {
  background: #115e59;
  box-shadow: 0 0 0 2px rgba(94, 234, 212, 0.5), inset 0 1px 0 rgba(204, 251, 241, 0.2);
}

.icon-plus,
.icon-minus,
.icon-check {
  position: relative;
  width: 16px;
  height: 16px;
  display: inline-block;
}

.icon-plus::before,
.icon-plus::after,
.icon-minus::before,
.icon-check::before,
.icon-check::after {
  content: '';
  position: absolute;
  background: currentColor;
  border-radius: 2px;
}

.icon-plus::before {
  width: 12px;
  height: 2px;
  top: 7px;
  left: 2px;
}

.icon-plus::after {
  width: 2px;
  height: 12px;
  top: 2px;
  left: 7px;
}

.icon-minus::before {
  width: 12px;
  height: 2px;
  top: 7px;
  left: 2px;
}

.icon-check::before {
  width: 2px;
  height: 6px;
  top: 6px;
  left: 4px;
  transform: rotate(-42deg);
}

.icon-check::after {
  width: 2px;
  height: 10px;
  top: 2px;
  left: 8px;
  transform: rotate(42deg);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.picker-footer {
  border-top: 1px solid rgba(142, 180, 241, 0.32);
  padding: 10px 0 12px;
  background: linear-gradient(180deg, #122543 0%, #172d50 100%);
}

.picker-footer__inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.picker-footer__count {
  font-size: 0.76rem;
  color: #c8dcf8;
  font-weight: 600;
}

.btn-add-selected {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #ffffff;
  border-radius: 9px;
  padding: 8px 14px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.83rem;
  line-height: 1.1;
  box-shadow: inset 0 1px 0 rgba(221, 236, 255, 0.14);
}

.btn-add-selected:hover,
.btn-add-selected:focus {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.btn-add-selected:disabled {
  opacity: 1;
  background: #344b72;
  border-color: #344b72;
  color: #d5e3f8;
  cursor: not-allowed;
  box-shadow: none;
}

.picker-empty {
  text-align: center;
  color: #c8dcf8;
  padding: 14px;
  border: 1px dashed rgba(153, 192, 248, 0.4);
  border-radius: 10px;
  background: #122542;
}

@media (max-width: 640px) {
  .btn-close {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
  }

  .picker-modal {
    --picker-side-gutter: 14px;
  }

  .view-tab {
    font-size: 0.7rem;
    padding: 6px 6px;
    min-height: 30px;
  }

  .picker-filters__inner {
    grid-template-columns: 1fr;
  }

  .picker-filter-field {
    gap: 3px;
  }

  .picker-card {
    grid-template-columns: 52px 1fr;
    text-align: left;
  }

  .picker-card__actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    align-items: center;
    min-width: 0;
  }

  .picker-icon-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    max-width: 44px;
    max-height: 44px;
    flex-basis: 44px;
    border-radius: 10px;
  }

  .picker-footer {
    flex-wrap: wrap;
  }

  .picker-card img {
    width: 52px;
    height: 52px;
  }
}
</style>
