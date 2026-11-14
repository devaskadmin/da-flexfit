<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { DEFAULT_EXERCISE_IMAGE, getExerciseImage } from '@/utils/exerciseImage';

const props = defineProps({
  exercise: {
    type: Object,
    required: true,
  },
  isCardio: {
    type: Boolean,
    default: false,
  },
  isExpanded: {
    type: Boolean,
    default: true,
  },
  canMoveUp: {
    type: Boolean,
    default: false,
  },
  canMoveDown: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'add-set',
  'remove-set',
  'update-set',
  'select',
  'exercise-completed',
  'move-up',
  'move-down',
  'edit-exercise',
  'remove-exercise',
]);

const managementMenuOpen = ref(false);
const managementMenuRoot = ref(null);

const failedImageSignatures = new Set();
const INLINE_IMAGE_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="12" fill="#e5e7eb"/><path d="M28 76l20-22 14 16 10-12 20 18" fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="44" cy="40" r="8" fill="#94a3b8"/></svg>');

const buildImageSignature = (exercise, imageSrc) => {
  const exerciseId = Number(exercise?.exerciseId || exercise?.ExerciseID || 0);
  const baseId = exerciseId > 0 ? String(exerciseId) : String(exercise?.id || exercise?.name || 'unknown');
  return `${baseId}::${String(imageSrc || '').trim()}`;
};

function completeExercise(exerciseId) {
  props.exercise.sessionSets.forEach((set, idx) => {
    if (!set.done) {
      emit('update-set', exerciseId, idx, 'done', true);
    }
  });
  emit('exercise-completed', exerciseId);
}

const workoutType = computed(() => {
  const raw = String(
    props.exercise.WorkoutType ||
    props.exercise.workoutType ||
    ''
  ).trim().toLowerCase();
  if (raw === 'cardio') return 'cardio';
  if (raw === 'other') return 'other';
  if (raw === 'strength') return 'strength';
  // Legacy fallback: honour the isCardio prop, default to strength
  if (props.isCardio) return 'cardio';
  return 'strength';
});

const completedSets = computed(() =>
  props.exercise.sessionSets.filter((s) => s.done).length
);
const totalSets = computed(() => props.exercise.sessionSets.length);
const allDone = computed(() => completedSets.value === totalSets.value && totalSets.value > 0);

const hasPrefilledValues = computed(() =>
  (props.exercise.sessionSets || []).some((set) => Boolean(set?.prefilledFromLastWorkout))
);

const prefillClass = (set, field) => (set?.prefilledFields?.[field] ? 'set-input--prefilled' : '');

const resolveExerciseImage = (exercise) => {
  const safeExercise = exercise && typeof exercise === 'object' ? exercise : {};
  const resolved = getExerciseImage({
    ...safeExercise,
    image:
      safeExercise.image ||
      safeExercise.exerciseImage ||
      safeExercise.exerciseImageUrl ||
      safeExercise.imageUrl ||
      safeExercise.ImageURL ||
      '',
  });

  const signature = buildImageSignature(safeExercise, resolved);
  if (failedImageSignatures.has(signature)) {
    return DEFAULT_EXERCISE_IMAGE;
  }

  return resolved;
};

const handleExerciseImageError = (event, exercise) => {
  const target = event?.target;
  if (!target) return;

  const attemptedSrc = String(target.currentSrc || target.src || '').trim();
  const signature = buildImageSignature(exercise, attemptedSrc);
  if (attemptedSrc) {
    failedImageSignatures.add(signature);
  }

  if (target.dataset.fallbackApplied === '1') {
    if (target.dataset.fallbackFinal !== '1') {
      target.dataset.fallbackFinal = '1';
      target.src = INLINE_IMAGE_FALLBACK;
    }
    return;
  }

  target.dataset.fallbackApplied = '1';
  target.src = DEFAULT_EXERCISE_IMAGE;
};

const closeManagementMenu = () => {
  managementMenuOpen.value = false;
};

const toggleManagementMenu = () => {
  managementMenuOpen.value = !managementMenuOpen.value;
};

const onDocumentPointerDown = (event) => {
  if (!managementMenuOpen.value) return;
  const target = event?.target;
  if (!target || typeof target.closest !== 'function') {
    closeManagementMenu();
    return;
  }
  if (!target.closest('.sec-management-menu')) {
    closeManagementMenu();
  }
};

const onDocumentKeyDown = (event) => {
  if (event?.key === 'Escape') {
    closeManagementMenu();
  }
};

const handleMenuAction = (action) => {
  closeManagementMenu();
  if (action === 'move-up') emit('move-up', props.exercise.id);
  if (action === 'move-down') emit('move-down', props.exercise.id);
  if (action === 'edit-exercise') emit('edit-exercise', props.exercise.id);
  if (action === 'remove-exercise') emit('remove-exercise', props.exercise.id);
};

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
});
</script>

<template>
  <article class="session-exercise-card" :class="{ 'session-exercise-card--active': isExpanded, 'session-exercise-card--done': allDone }">
    <!-- Exercise Header -->
    <div class="sec-header" :class="{ 'sec-header--active': isExpanded }" @click="emit('select', exercise.id)">
      <div class="sec-identity">
        <img
          :src="resolveExerciseImage(exercise)"
          :alt="exercise.name"
          class="sec-thumb"
          loading="lazy"
          decoding="async"
          @error="(event) => handleExerciseImageError(event, exercise)"
        />
        <div class="sec-meta">
          <h5>{{ exercise.name }}</h5>
          <p>
            <span v-if="exercise.muscleGroup">{{ exercise.muscleGroup }}</span>
            <span v-if="exercise.muscleGroup && exercise.equipment"> · </span>
            <span v-if="exercise.equipment">{{ exercise.equipment }}</span>
          </p>
        </div>
      </div>
      <div class="sec-header-actions">
        <span class="sec-type-chip">{{ exercise.workoutType || 'Strength' }}</span>
        <span class="sec-sets-summary" :class="{ 'sec-sets-summary--done': allDone }">
          <i v-if="allDone" class="fa-solid fa-circle-check"></i>
          <i v-else class="fa-regular fa-circle"></i>
          {{ completedSets }} / {{ totalSets }}
        </span>
        <button
          type="button"
          class="sec-select-btn exercise-collapse-btn"
          :class="{ 'sec-select-btn--active': isExpanded, 'is-collapsed': !isExpanded }"
          :title="isExpanded ? 'Collapse exercise' : 'Select exercise'"
          :aria-label="isExpanded ? 'Collapse exercise' : 'Select exercise'"
          :aria-expanded="isExpanded ? 'true' : 'false'"
          @click.stop="emit('select', exercise.id)"
        >
          <i :class="isExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
          <span class="sr-only">{{ isExpanded ? 'Collapse exercise' : 'Select exercise' }}</span>
        </button>
        <div class="sec-management-menu" ref="managementMenuRoot" @click.stop>
          <button
            type="button"
            class="sec-management-menu__trigger"
            aria-label="Exercise actions"
            :aria-expanded="managementMenuOpen ? 'true' : 'false'"
            @click.stop="toggleManagementMenu"
          >
            <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
          </button>

          <div
            v-if="managementMenuOpen"
            class="sec-management-menu__panel"
            role="menu"
            aria-label="Exercise management actions"
          >
            <button
              type="button"
              class="sec-management-menu__item"
              role="menuitem"
              :disabled="!canMoveUp"
              @click="handleMenuAction('move-up')"
            >
              <i class="fa-solid fa-arrow-up"></i>
              <span>Move Up</span>
            </button>
            <button
              type="button"
              class="sec-management-menu__item"
              role="menuitem"
              :disabled="!canMoveDown"
              @click="handleMenuAction('move-down')"
            >
              <i class="fa-solid fa-arrow-down"></i>
              <span>Move Down</span>
            </button>
            <button
              type="button"
              class="sec-management-menu__item"
              role="menuitem"
              @click="handleMenuAction('edit-exercise')"
            >
              <i class="fa-solid fa-pen"></i>
              <span>Edit Exercise</span>
            </button>
            <button
              type="button"
              class="sec-management-menu__item sec-management-menu__item--danger"
              role="menuitem"
              @click="handleMenuAction('remove-exercise')"
            >
              <i class="fa-solid fa-trash"></i>
              <span>Remove Exercise</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Collapsible body ─────────────────────────────────────────────── -->
    <div v-show="isExpanded" class="sec-body">

    <!-- ── STRENGTH Sets Table ─────────────────────────────────────────── -->
    <div v-if="workoutType === 'strength'" class="cardio-table-wrap strength-table strength-table--desktop">
      <div class="cardio-3col-table">
        <div class="c3-head">
          <span class="c3-col-set">Set</span>
          <span class="c3-col-info">Info</span>
          <span class="c3-col-value">Value</span>
        </div>
        <div
          v-for="(set, idx) in exercise.sessionSets"
          :key="idx"
          class="c3-set-group"
          :class="{ 'c3-set-done': set.done }"
        >
          <!-- Weight row -->
          <div class="c3-row">
            <span class="c3-col-set c3-set-num">{{ set.setNum }}</span>
            <span class="c3-col-info">Weight (lbs)</span>
            <div class="c3-col-value">
              <input
                type="number"
                :class="['set-input', prefillClass(set, 'weight')]"
                :value="set.weight"
                min="0"
                step="0.5"
                placeholder="0"
                @input="emit('update-set', exercise.id, idx, 'weight', $event.target.value)"
              />
            </div>
          </div>
          <!-- Reps row -->
          <div class="c3-row">
            <span class="c3-col-set"></span>
            <span class="c3-col-info">Reps</span>
            <div class="c3-col-value c3-col-value-inline-actions">
              <input
                type="number"
                :class="['set-input', prefillClass(set, 'reps')]"
                :value="set.reps"
                min="0"
                placeholder="0"
                @input="emit('update-set', exercise.id, idx, 'reps', $event.target.value)"
              />
              <div class="c3-inline-actions" role="group" aria-label="Set actions">
                <button
                  v-if="exercise.sessionSets.length > 1"
                  type="button"
                  class="c3-icon-btn c3-icon-btn--remove"
                  title="Remove this set"
                  aria-label="Remove this set"
                  @click="emit('remove-set', exercise.id, idx)"
                >
                  <i class="fa-solid fa-minus"></i>
                </button>
                <button
                  type="button"
                  class="c3-icon-btn c3-icon-btn--complete"
                  :class="{ 'c3-icon-btn--done': set.done }"
                  :title="set.done ? 'Set completed' : 'Mark set complete'"
                  :aria-label="set.done ? 'Set completed' : 'Mark set complete'"
                  @click="emit('update-set', exercise.id, idx, 'done', !set.done)"
                >
                  <i class="fa-solid fa-check"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="workoutType === 'strength'" class="strength-table strength-table--mobile">
      <div
        v-for="(set, idx) in exercise.sessionSets"
        :key="`mobile-strength-${idx}`"
        class="strength-mobile-row"
        :class="{ 'strength-mobile-row--done': set.done }"
      >
        <label class="strength-mobile-field">
          <span>Weight (lbs)</span>
          <input
            type="number"
            :class="['set-input', prefillClass(set, 'weight')]"
            :value="set.weight"
            min="0"
            step="0.5"
            placeholder="0"
            @input="emit('update-set', exercise.id, idx, 'weight', $event.target.value)"
          />
        </label>

        <label class="strength-mobile-field">
          <span>Reps</span>
          <input
            type="number"
            :class="['set-input', prefillClass(set, 'reps')]"
            :value="set.reps"
            min="0"
            placeholder="0"
            @input="emit('update-set', exercise.id, idx, 'reps', $event.target.value)"
          />
        </label>

        <button
          v-if="exercise.sessionSets.length > 1"
          type="button"
          class="c3-icon-btn c3-icon-btn--remove"
          title="Remove this set"
          aria-label="Remove this set"
          @click="emit('remove-set', exercise.id, idx)"
        >
          <i class="fa-solid fa-minus"></i>
        </button>

        <button
          type="button"
          class="c3-icon-btn c3-icon-btn--complete"
          :class="{ 'c3-icon-btn--done': set.done }"
          :title="set.done ? 'Set completed' : 'Mark set complete'"
          :aria-label="set.done ? 'Set completed' : 'Mark set complete'"
          @click="emit('update-set', exercise.id, idx, 'done', !set.done)"
        >
          <i class="fa-solid fa-check"></i>
        </button>
      </div>
    </div>

    <!-- ── OTHER Sets Table ──────────────────────────────────────────── -->
    <div v-if="workoutType === 'other'" class="cardio-table-wrap">
      <div class="cardio-3col-table">
        <div class="c3-head">
          <span class="c3-col-set">Set</span>
          <span class="c3-col-info">Info</span>
          <span class="c3-col-value">Value</span>
        </div>
        <div
          v-for="(set, idx) in exercise.sessionSets"
          :key="idx"
          class="c3-set-group"
          :class="{ 'c3-set-done': set.done }"
        >
          <!-- Duration row -->
          <div class="c3-row">
            <span class="c3-col-set c3-set-num">{{ set.setNum }}</span>
            <span class="c3-col-info">Duration (min)</span>
            <div class="c3-col-value">
              <input
                type="number"
                :class="['set-input', prefillClass(set, 'duration')]"
                :value="set.duration ?? 0"
                min="0"
                placeholder="0"
                @input="emit('update-set', exercise.id, idx, 'duration', $event.target.value)"
              />
            </div>
          </div>
          <!-- Notes row -->
          <div class="c3-row">
            <span class="c3-col-set"></span>
            <span class="c3-col-info">Notes</span>
            <div class="c3-col-value">
              <input
                type="text"
                class="set-input set-input--text"
                :value="set.notes ?? ''"
                placeholder="Optional notes"
                @input="emit('update-set', exercise.id, idx, 'notes', $event.target.value)"
              />
            </div>
          </div>
          <!-- Action row -->
          <div class="c3-row c3-row-done">
            <span class="c3-col-set"></span>
            <div class="c3-col-info c3-info-action">
              <button
                v-if="exercise.sessionSets.length > 1"
                type="button"
                class="c3-rm-btn"
                title="Remove this set"
                @click="emit('remove-set', exercise.id, idx)"
              >
                <i class="fa-solid fa-minus"></i>
                <span class="c3-btn-label">Remove Set</span>
              </button>
            </div>
            <div class="c3-col-value c3-done-cell">
              <button
                type="button"
                class="c3-complete-btn"
                :class="{ 'c3-complete-btn--done': set.done }"
                @click="emit('update-set', exercise.id, idx, 'done', !set.done)"
              >
                <i v-if="set.done" class="fa-solid fa-circle-check"></i>
                <i v-else class="fa-regular fa-circle"></i>
                <span class="c3-btn-label">{{ set.done ? 'Set Done' : 'Complete Set' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── CARDIO Sets Table ─────────────────────────────────────────── -->
    <div v-if="workoutType === 'cardio'" class="cardio-table-wrap">
      <div class="cardio-3col-table">
      <!-- Header -->
      <div class="c3-head">
        <span class="c3-col-set">Set</span>
        <span class="c3-col-info">Info</span>
        <span class="c3-col-value">Value</span>
      </div>

      <!-- Per-set group -->
      <div
        v-for="(set, idx) in exercise.sessionSets"
        :key="idx"
        class="c3-set-group"
        :class="{ 'c3-set-done': set.done }"
      >
        <!-- Duration row -->
        <div class="c3-row">
          <span class="c3-col-set c3-set-num">{{ set.setNum }}</span>
          <span class="c3-col-info">Duration (min)</span>
          <div class="c3-col-value">
            <input
              type="number"
              :class="['set-input', prefillClass(set, 'duration')]"
              :value="set.duration"
              min="0"
              placeholder="0"
              @input="emit('update-set', exercise.id, idx, 'duration', $event.target.value)"
            />
          </div>
        </div>
        <!-- Calories row -->
        <div class="c3-row">
          <span class="c3-col-set"></span>
          <span class="c3-col-info">Calories Burned</span>
          <div class="c3-col-value">
            <input
              type="number"
              :class="['set-input', prefillClass(set, 'caloriesBurned')]"
              :value="set.caloriesBurned"
              min="0"
              placeholder="0"
              @input="emit('update-set', exercise.id, idx, 'caloriesBurned', $event.target.value)"
            />
          </div>
        </div>
        <!-- Distance row -->
        <div class="c3-row">
          <span class="c3-col-set"></span>
          <span class="c3-col-info">Distance (Miles)</span>
          <div class="c3-col-value">
            <input
              type="number"
              :class="['set-input', prefillClass(set, 'distanceMiles')]"
              :value="set.distanceMiles"
              min="0"
              step="0.01"
              placeholder="0.00"
              @input="emit('update-set', exercise.id, idx, 'distanceMiles', $event.target.value)"
            />
          </div>
        </div>
        <!-- Speed row -->
        <div class="c3-row">
          <span class="c3-col-set"></span>
          <span class="c3-col-info">Speed (Mph)</span>
          <div class="c3-col-value">
            <input
              type="number"
              :class="['set-input', prefillClass(set, 'speedMph')]"
              :value="set.speedMph"
              min="0"
              step="0.1"
              placeholder="0.0"
              @input="emit('update-set', exercise.id, idx, 'speedMph', $event.target.value)"
            />
          </div>
        </div>
        <!-- Completed row -->
        <div class="c3-row c3-row-done">
          <span class="c3-col-set"></span>
          <div class="c3-col-info c3-info-action">
            <button
              v-if="exercise.sessionSets.length > 1"
              type="button"
              class="c3-rm-btn"
              title="Remove this set"
              @click="emit('remove-set', exercise.id, idx)"
            >
              <i class="fa-solid fa-minus"></i> Remove Set
            </button>
          </div>
          <div class="c3-col-value c3-done-cell">
            <button
              type="button"
              class="c3-complete-btn"
              :class="{ 'c3-complete-btn--done': set.done }"
              @click="emit('update-set', exercise.id, idx, 'done', !set.done)"
            >
              <i v-if="set.done" class="fa-solid fa-circle-check"></i>
              <i v-else class="fa-regular fa-circle"></i>
              {{ set.done ? 'Set Done' : 'Complete Set' }}
            </button>
          </div>
        </div>
      </div>
      </div><!-- end cardio-3col-table -->
    </div><!-- end cardio-table-wrap -->

    <!-- Add Set -->
    <div class="sec-footer">
      <button type="button" class="add-set-btn" @click="emit('add-set', exercise.id)">
        <i class="fa-solid fa-plus"></i> Add Set
      </button>

      <span class="sec-summary">
        {{ exercise.sessionSets.filter((s) => s.done).length }} /
        {{ exercise.sessionSets.length }} sets completed
      </span>

      <span v-if="hasPrefilledValues" class="sec-prefill-note">
        Prefilled from last workout
      </span>

      <button
        type="button"
        class="c3-finish-btn"
        :class="{ 'c3-finish-btn--done': exercise.sessionSets.every((s) => s.done) }"
        @click="completeExercise(exercise.id)"
      >
        <i class="fa-solid fa-flag-checkered"></i> Complete Exercise
      </button>
    </div>

    </div><!-- end sec-body -->
  </article>
</template>

<style scoped>
.session-exercise-card {
  background: #fff;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  padding: 16px;
  display: grid;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
  overflow: visible;
}

.session-exercise-card--active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.session-exercise-card--done {
  border-color: #86efac;
}

.session-exercise-card:focus-within {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

/* ─── Header ──────────────────────────────── */
.sec-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
  cursor: pointer;
  user-select: none;
  border-radius: 8px;
  transition: background 0.14s ease;
  margin: -4px;
  padding: 4px;
}

.sec-header:hover {
  background: #f8faff;
}

.sec-header--active {
  background: #eff6ff;
}

.sec-header-actions {
  display: inline-grid;
  grid-template-columns: auto auto auto auto;
  align-items: start;
  gap: 6px;
  width: auto;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin-left: auto;
  flex: 0 0 auto;
}

.sec-header-actions .sec-type-chip {
  justify-self: start;
}

.sec-management-menu {
  position: relative;
  justify-self: end;
}

.sec-management-menu__trigger {
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  max-height: 30px;
  padding: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.52);
  color: #cbd5e1;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.sec-management-menu__trigger:hover {
  background: rgba(30, 64, 175, 0.26);
  border-color: rgba(96, 165, 250, 0.65);
  color: #dbeafe;
}

.sec-management-menu__trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.24);
}

.sec-management-menu__panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 176px;
  max-width: min(220px, calc(100vw - 24px));
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #0f172a;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.38);
  padding: 6px;
  z-index: 12;
  display: grid;
  gap: 4px;
}

.sec-management-menu__item {
  width: 100%;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
}

.sec-management-menu__item:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.22);
}

.sec-management-menu__item:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.sec-management-menu__item--danger {
  color: #fecaca;
}

.sec-management-menu__item--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.22);
}

.sec-header-actions .sec-sets-summary {
  justify-self: center;
}

.sec-header-actions .sec-select-btn,
.sec-header-actions .exercise-collapse-btn {
  justify-self: end;
}

.sec-sets-summary {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.sec-sets-summary--done {
  color: #16a34a;
}

.sec-select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1.5px solid #3b82f6;
  color: #2563eb;
  border-radius: 999px;
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.sec-select-btn:hover {
  background: #eff6ff;
}

.sec-select-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.sec-select-btn--active {
  background: #dbeafe;
  border-color: #2563eb;
}

.exercise-collapse-btn {
  width: 30px;
  height: 30px;
  min-width: 30px;
  padding: 0;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(96, 165, 250, 0.4);
  background: rgba(15, 23, 42, 0.55);
  color: #60a5fa;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.exercise-collapse-btn:hover {
  background: rgba(30, 64, 175, 0.26);
  border-color: rgba(96, 165, 250, 0.62);
  color: #93c5fd;
}

.exercise-collapse-btn:active {
  transform: translateY(0);
  background: rgba(37, 99, 235, 0.3);
}

.exercise-collapse-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.24);
}

.exercise-collapse-btn.sec-select-btn--active {
  border-color: rgba(96, 165, 250, 0.68);
  background: rgba(30, 64, 175, 0.36);
  color: #bfdbfe;
}

.exercise-collapse-btn i {
  transition: transform 0.22s ease;
}

.exercise-collapse-btn.is-collapsed i {
  transform: rotate(180deg);
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

.sec-body {
  display: grid;
  gap: 14px;
}

.sec-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sec-thumb {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--border-color, #e5e7eb);
  flex-shrink: 0;
}

.sec-thumb-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: #eff6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  font-size: 1.1rem;
  flex-shrink: 0;
  border: 1px solid #dbeafe;
}

.sec-meta h5 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-color, #111827);
}

.sec-meta p {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: var(--text-color-secondary, #6b7280);
}

.sec-type-chip {
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  padding: 3px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ─── Sets Table ──────────────────────────── */
.sec-sets-table {
  display: grid;
  gap: 6px;
}

.sec-sets-head,
.sec-set-row {
  display: grid;
  grid-template-columns: 36px 1fr 1fr 44px 30px;
  gap: 8px;
  align-items: center;
}

.sec-sets-head {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-color-secondary, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}

.sec-set-row {
  padding: 4px 0;
  border-radius: 8px;
  transition: background 0.14s ease;
}

.sec-set-row.set-done {
  background: #f0fdf4;
}

.set-num {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-color-secondary, #6b7280);
  text-align: center;
}

.set-input {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 0.85rem;
  background: #f9fafb;
  color: var(--text-color, #111827);
  width: 100%;
  min-width: 0;
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.set-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: #fff;
}

.set-input--prefilled {
  background: #f8fafc;
  border-color: #d9e2ec;
  color: #64748b;
}

.set-input--text {
  text-align: left;
}

.sec-prefill-note {
  color: #64748b;
  font-size: 0.73rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #dbe3ec;
  white-space: nowrap;
}

/* ─── Cardio Table Wrapper — full width, no cap */
.cardio-table-wrap {
  width: 100%;
}

.strength-table--mobile {
  display: none;
}

/* ─── Cardio 3-Column Table ───────────────── */
.cardio-3col-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  overflow: hidden;
  width: 100%;
}

/* Shared column grid: Set(20%) | Info(40%) | Value(40%) */
.c3-head,
.c3-row {
  display: grid;
  grid-template-columns: 20% 40% 40%;
  align-items: center;
  width: 100%;
}

/* Header row */
.c3-head {
  background: #f9fafb;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  padding: 7px 12px;
}

.c3-head span {
  font-size: 0.70rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Per-set group */
.c3-set-group {
  border-bottom: 2px solid var(--border-color, #e5e7eb);
  transition: background 0.14s ease;
}

.c3-set-group:last-child {
  border-bottom: none;
}

.c3-set-group.c3-set-done {
  background: #f0fdf4;
}

/* Individual field row */
.c3-row {
  padding: 4px 12px;
  border-bottom: 1px solid #f3f4f6;
  gap: 0;
}

.c3-row:last-child {
  border-bottom: none;
}

/* First row of each set gets a subtle tint to mark the group start */
.c3-row:first-child {
  background: rgba(59, 130, 246, 0.04);
}

.c3-set-group.c3-set-done .c3-row:first-child {
  background: rgba(34, 197, 94, 0.08);
}

.c3-col-set {
  font-size: 0.82rem;
  font-weight: 700;
  color: #6b7280;
  text-align: center;
}

.c3-set-num {
  font-size: 0.92rem;
  font-weight: 800;
  color: #374151;
}

.c3-col-info {
  font-size: 0.84rem;
  color: #374151;
  font-weight: 500;
  padding: 0 12px 0 0;
}

.c3-col-value {
  min-width: 0;
  padding: 3px 0;
}

.c3-col-value-inline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.c3-col-value-inline-actions .set-input {
  flex: 1;
  min-width: 0;
}

.c3-inline-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.c3-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.c3-icon-btn--remove {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}

.c3-icon-btn--remove:hover {
  background: #fee2e2;
  border-color: #ef4444;
}

.c3-icon-btn--complete {
  background: #16a34a;
  border-color: #15803d;
  color: #ffffff;
}

.c3-icon-btn--complete:hover {
  background: #15803d;
}

.c3-icon-btn--done {
  background: #166534;
  border-color: #14532d;
  opacity: 0.92;
}

/* Value inputs — constrained to their column */
.c3-col-value .set-input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* Completed row — light gray bg + top separator */
.c3-row-done {
  border-top: 1px solid var(--border-color, #e5e7eb) !important;
  background: #f9fafb !important;
}

.c3-set-group.c3-set-done .c3-row-done {
  background: #f0fdf4 !important;
}

.c3-info-action {
  display: flex;
  align-items: center;
}
.c3-done-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.c3-btn-label {
  display: inline;
}

/* ─── Remove Set Button ──────────────── */
.c3-rm-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid #fca5a5;
  color: #dc2626;
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.c3-rm-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

/* ─── Complete Set Button (per-set) ───────────── */
.c3-complete-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 4px 11px;
  font-size: 0.77rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}

.c3-complete-btn:hover {
  background: #15803d;
}

.c3-complete-btn--done {
  background: #166534;
  opacity: 0.85;
  cursor: default;
}

.c3-complete-btn--done:hover {
  background: #166534;
}

/* ─── Complete Exercise Button (entire exercise) ─── */
.c3-finish-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 9px;
  padding: 7px 16px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(22,163,74,0.18);
}

.c3-finish-btn:hover {
  background: #15803d;
}

.c3-finish-btn--done {
  background: #166534;
  opacity: 0.8;
  cursor: default;
}

.c3-finish-btn--done:hover {
  background: #166534;
}

/* ─── Remove Set ──────────────────────────── */
.remove-set-btn {
  background: none;
  border: none;
  color: #d1d5db;
  font-size: 0.75rem;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-set-btn:hover:not(:disabled) {
  color: #ef4444;
}

.remove-set-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ─── Footer ──────────────────────────────── */
.sec-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid var(--border-color, #f3f4f6);
}

.add-set-btn {
  background: none;
  border: 1px solid #3b82f6;
  color: #2563eb;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease, color 0.15s ease;
}

.add-set-btn:hover {
  background: #eff6ff;
}

.sec-summary {
  font-size: 0.78rem;
  color: var(--text-color-secondary, #6b7280);
}

/* ─── v0.81.6 Mobile 768px — Exercise Card Compression ───────── */
@media (max-width: 768px) {
  /* Card compression */
  .session-exercise-card {
    padding: 10px 12px;
    gap: 10px;
    border-radius: 12px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .sec-body,
  .cardio-table-wrap,
  .cardio-3col-table,
  .strength-table--mobile,
  .sec-footer {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .sec-header {
    margin: 0;
    padding: 2px 0;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .sec-identity {
    flex: 1 1 auto;
    min-width: 0;
  }

  .sec-meta {
    min-width: 0;
  }

  .sec-meta h5,
  .sec-meta p {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .sec-header-actions {
    flex: 0 0 auto;
    display: inline-grid;
    grid-template-columns: auto auto auto auto;
    justify-content: initial;
    min-width: 0;
  }

  .sec-management-menu__trigger {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    max-height: 36px;
  }

  .strength-table--desktop {
    display: none;
  }

  .strength-table--mobile {
    display: grid;
    gap: 8px;
  }

  .strength-mobile-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 44px 44px;
    gap: 6px;
    align-items: end;
    padding: 7px;
    border: 1px solid rgba(96, 165, 250, 0.22);
    border-radius: 10px;
    background: #1b2444;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .strength-mobile-row--done {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(22, 163, 74, 0.10);
  }

  .strength-mobile-field {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .strength-mobile-field span {
    font-size: 0.7rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .strength-mobile-field .set-input {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    min-height: 40px;
    height: 40px;
    text-align: left;
    background: #111b2e;
    border-color: rgba(96, 165, 250, 0.3);
    color: #f8fafc;
  }

  .strength-mobile-field .set-input::placeholder {
    color: #94a3b8;
  }

  .strength-mobile-row .c3-icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    border-width: 1px;
  }

  .strength-mobile-row .c3-icon-btn--remove {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(248, 113, 113, 0.35);
    color: #fca5a5;
  }

  .strength-mobile-row .c3-icon-btn--remove:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(248, 113, 113, 0.5);
    color: #fecaca;
  }

  .strength-mobile-row .c3-icon-btn--complete,
  .strength-mobile-row .c3-icon-btn--done {
    background: rgba(34, 197, 94, 0.16);
    border-color: rgba(34, 197, 94, 0.45);
    color: #86efac;
  }

  .strength-mobile-row .c3-icon-btn--complete:hover,
  .strength-mobile-row .c3-icon-btn--done:hover {
    background: rgba(34, 197, 94, 0.22);
    border-color: rgba(34, 197, 94, 0.58);
    color: #bbf7d0;
  }

  /* §4 Exercise header — 40px image, compact badge, 32px collapse button */
  .sec-thumb,
  .sec-thumb-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 8px;
  }
  .sec-meta h5   { font-size: 0.84rem; }
  .sec-meta p    { font-size: 0.7rem; }
  .sec-type-chip { font-size: 0.62rem; padding: 2px 6px; }
  .sec-sets-summary { font-size: 0.68rem; }
  .sec-select-btn,
  .exercise-collapse-btn {
    width: 30px;
    min-width: 30px;
    height: 30px;
    font-size: 12px;
    border-radius: 7px;
  }

  /* §5 Cardio set layout — 2-column grid (Duration|Calories / Distance|Speed) */
  /* Hide the Set|Info|Value table header — labels are inline per cell */
  .c3-head { display: none; }

  /* Each set group becomes a 2-col grid */
  .c3-set-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 2px solid var(--border-color, #e5e7eb);
  }
  .c3-set-group:last-child { border-bottom: none; }

  /* Each field row: stacked label + input (fills one grid cell) */
  .c3-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: none;
    background: transparent !important;
    min-width: 0;
    box-sizing: border-box;
  }

  /* Hide set number column (redundant in 2-col layout) */
  .c3-col-set { display: none; }

  /* Label above the input */
  .c3-col-info {
    font-size: 0.7rem;
    font-weight: 600;
    color: #64748b;
    padding: 0;
  }
  .c3-col-value { padding: 0; }

  .c3-col-value-inline-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
  }

  .c3-inline-actions {
    gap: 5px;
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
    justify-content: flex-end;
  }

  .c3-icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 7px;
  }

  /* §5 Field height 36px */
  .set-input {
    min-height: 36px;
    height: 36px;
    padding: 0 8px;
    font-size: 0.82rem;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    text-align: left;
  }

  /* §6 Set actions — action row spans both columns, 30px buttons */
  .c3-row-done {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
    gap: 6px;
    padding: 7px 8px;
    border-top: 0 !important;
    background: transparent !important;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex-wrap: wrap;
  }

  .c3-info-action,
  .c3-done-cell {
    display: flex;
    width: 100%;
    min-width: 0;
    justify-content: stretch;
  }

  .c3-rm-btn {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 34px;
    padding: 0 10px;
    white-space: nowrap;
    border-radius: 9px;
    border: 1px solid #fca5a5;
    background: #fff5f5;
    color: #dc2626;
    justify-content: center;
  }
  .c3-complete-btn {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 34px;
    padding: 0 10px;
    white-space: normal;
    text-align: center;
    line-height: 1.2;
    overflow-wrap: anywhere;
    border-radius: 9px;
    justify-content: center;
  }

  .c3-btn-label {
    display: inline;
  }

  /* Footer: compress */
  .sec-footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    justify-content: stretch;
    gap: 6px;
    flex-wrap: nowrap;
  }

  .sec-footer > * {
    min-width: 0;
  }

  .add-set-btn,
  .c3-finish-btn {
    width: fit-content;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    justify-content: center;
    margin: 0 auto;
  }

  .add-set-btn { font-size: 0.72rem; padding: 5px 10px; min-height: 44px; }
  .c3-finish-btn { font-size: 0.76rem; padding: 6px 12px; }

  .sec-summary   { font-size: 0.7rem; }

  .sec-summary,
  .sec-prefill-note {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

/* ─── v0.81.6 Mobile 480px — further compression ──────────────── */
@media (max-width: 480px) {
  .session-exercise-card { padding: 8px 10px; gap: 8px; }
  .sec-thumb, .sec-thumb-placeholder { width: 36px; height: 36px; }
  .sec-meta h5 { font-size: 0.8rem; }
  .sec-select-btn,
  .exercise-collapse-btn { width: 30px; min-width: 30px; height: 30px; }
  .set-input { min-height: 34px; height: 34px; font-size: 0.78rem; }
  .c3-icon-btn { width: 28px; height: 28px; border-radius: 6px; }
  .strength-mobile-row .c3-icon-btn {
    width: 38px;
    height: 38px;
  }

  /* Cardio table info labels smaller */
  .c3-col-info { font-size: 0.65rem; }
}

@media (max-width: 390px) {
  .strength-mobile-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 36px 36px;
    gap: 4px;
  }

  .sec-select-btn,
  .exercise-collapse-btn {
    width: 30px;
    min-width: 30px;
    height: 30px;
  }

  .strength-mobile-row .c3-icon-btn,
  .c3-rm-btn,
  .c3-complete-btn {
    width: 36px;
    height: 36px;
  }

  .c3-rm-btn,
  .c3-complete-btn {
    width: 100%;
    min-height: 34px;
    height: auto;
  }

  .strength-mobile-field .set-input {
    min-height: 38px;
    height: 38px;
    font-size: 0.78rem;
  }
}
</style>
