<script setup>
import { computed } from 'vue';
import { DEFAULT_EXERCISE_IMAGE, getExerciseImage } from '@/utils/exerciseImage';

const props = defineProps({
  exercise: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  scheduleGroups: {
    type: Array,
    default: () => [],
  },
  scheduleMode: {
    type: String,
    default: 'day',
  },
});

const emit = defineEmits(['update-field', 'remove', 'move-up', 'move-down']);

const getExerciseImageSrc = (exercise) => {
  return getExerciseImage(exercise);
};

const handleImageError = (event) => {
  if (!event?.target) return;
  console.error('[EXERCISE IMAGE ERROR] Failed to load image:', event.target.src);
  event.target.src = DEFAULT_EXERCISE_IMAGE;
};

const normalizedWorkoutType = computed(() =>
  String(props.exercise.workoutType || props.exercise.WorkoutType || '').trim().toLowerCase()
);
const normalizedRecordingType = computed(() =>
  String(props.exercise.recordingType || props.exercise.RecordingType || '').trim().toLowerCase()
);
const isCardio   = computed(() => normalizedWorkoutType.value === 'cardio');
const isStrength = computed(() => normalizedWorkoutType.value === 'strength' || normalizedWorkoutType.value === '');
const isOther    = computed(() => !isCardio.value && !isStrength.value);

const usesSetsAndReps = computed(() => {
  if (isStrength.value) return true;
  if (normalizedRecordingType.value === 'sets & reps') return true;
  return isOther.value && !normalizedRecordingType.value;
});

const usesTimeAndDistance = computed(() => {
  if (isCardio.value) return true;
  return isOther.value && (normalizedRecordingType.value === 'time & distance' || normalizedRecordingType.value === 'custom');
});

const supportsTargetedCalories = computed(() => {
  if (!usesTimeAndDistance.value) return false;
  return normalizedRecordingType.value !== 'sets & reps';
});

const showStrengthFields = computed(() => usesSetsAndReps.value && !isCardio.value);
const showCardioFields = computed(() => usesTimeAndDistance.value);

const workoutTypeBadgeLabel = computed(() => {
  if (isCardio.value)   return 'Cardio';
  if (isOther.value)    return 'Other';
  return 'Strength';
});
const workoutTypeBadgeClass = computed(() => {
  if (isCardio.value) return 'type-badge--cardio';
  if (isOther.value)  return 'type-badge--other';
  return 'type-badge--strength';
});

const updateField = (field, value, isNumeric = false) => {
  emit('update-field', {
    id: props.exercise.id,
    field,
    value: isNumeric ? Number(value || 0) : value,
  });
};
</script>

<template>
  <article class="exercise-block planner-card">
    <header class="exercise-block__head">
      <div class="exercise-block__identity">
        <img
          :src="getExerciseImageSrc(exercise)"
          :alt="exercise.name || exercise.ExerciseTitle || 'Exercise image'"
          width="72"
          height="72"
          loading="lazy"
          decoding="async"
          @error="handleImageError"
        />
        <div>
          <div class="exercise-block__badges">
            <span class="exercise-block__badge">Block {{ index + 1 }}</span>
            <span :class="['type-badge', workoutTypeBadgeClass]">{{ workoutTypeBadgeLabel }}</span>
          </div>
          <h4>{{ exercise.name }}</h4>
          <p>{{ exercise.muscleGroup || 'N/A' }} • {{ exercise.equipment || 'Bodyweight' }}</p>
        </div>
      </div>

      <div class="exercise-block__actions">
        <button
          type="button"
          class="exercise-action-btn exercise-action-btn--move exercise-action-btn--move-up"
          :disabled="index === 0"
          title="Move Exercise Up"
          aria-label="Move Exercise Up"
          @click="emit('move-up', exercise.id)"
        >
          <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="exercise-action-btn exercise-action-btn--move exercise-action-btn--move-down"
          :disabled="index === total - 1"
          title="Move Exercise Down"
          aria-label="Move Exercise Down"
          @click="emit('move-down', exercise.id)"
        >
          <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="exercise-action-btn exercise-action-btn--remove"
          title="Remove Exercise"
          aria-label="Remove Exercise"
          @click="emit('remove', exercise.id)"
        >
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <div
      :class="[
        'exercise-block__fields',
        {
          'exercise-block__fields--strength-desktop': showStrengthFields,
          'exercise-block__fields--cardio-desktop': isCardio,
        }
      ]"
    >
      <!-- Schedule group (always visible) -->
      <label class="field-full exercise-config-field">
        <span>{{ scheduleMode === 'week' ? 'Week Group' : 'Day Group' }}</span>
        <select
          :value="exercise.scheduleGroup"
          @change="updateField('scheduleGroup', $event.target.value)"
        >
          <option
            v-for="group in scheduleGroups"
            :key="group"
            :value="group"
          >
            {{ group }}
          </option>
        </select>
      </label>

      <!-- Strength fields -->
      <template v-if="showStrengthFields">
        <label class="field-full exercise-config-field strength-field-group strength-field--weight">
          <span>Weight (lbs)</span>
          <input
            :value="exercise.weight"
            type="number"
            min="0"
            placeholder="0"
            @input="updateField('weight', $event.target.value, true)"
          />
        </label>

        <label class="field-half exercise-config-field strength-field-group strength-field--reps">
          <span>Reps</span>
          <input
            :value="exercise.reps"
            type="number"
            min="0"
            placeholder="0"
            @input="updateField('reps', $event.target.value, true)"
          />
        </label>

        <label class="field-half exercise-config-field strength-field-group strength-field--sets">
          <span>Sets</span>
          <input
            :value="exercise.sets"
            type="number"
            min="0"
            placeholder="0"
            @input="updateField('sets', $event.target.value, true)"
          />
        </label>
      </template>

      <!-- Cardio fields -->
      <template v-if="showCardioFields">
        <label class="field-full exercise-config-field cardio-field-group cardio-field--duration">
          <span>Target Time (min)</span>
          <input
            :value="exercise.duration"
            type="number"
            min="0"
            placeholder="0"
            @input="updateField('duration', $event.target.value, true)"
          />
        </label>

        <label v-if="supportsTargetedCalories" class="field-full exercise-config-field cardio-field-group cardio-field--calories">
          <span>Target Calories</span>
          <input
            :value="exercise.calories"
            type="number"
            min="0"
            placeholder="0"
            @input="updateField('calories', $event.target.value, true)"
          />
        </label>

        <label class="field-full exercise-config-field cardio-field-group cardio-field--distance">
          <span>Distance (mi)</span>
          <input
            :value="exercise.distance"
            type="number"
            min="0"
            placeholder="0"
            @input="updateField('distance', $event.target.value, true)"
          />
        </label>
      </template>

      <!-- Notes (always full width) -->
      <label class="field-notes field-full exercise-config-field">
        <span>Notes</span>
        <input
          :value="exercise.notes"
          type="text"
          placeholder="Tempo, cues, target effort"
          @input="updateField('notes', $event.target.value)"
        />
      </label>
    </div>
  </article>
</template>

<style scoped>
.exercise-block {
  border: 1px solid #dbe4ef;
  border-radius: 12px;
  background: #fff;
  padding: 12px 12px 10px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.exercise-block + .exercise-block {
  margin-top: 10px;
}

.planner-card {
  border-radius: 12px;
  border: 1px solid #d6e0ee;
  background: linear-gradient(180deg, #1f2b47 0%, #1a2440 100%) !important;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.exercise-block__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  min-width: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
}

.exercise-block__identity {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1 1 auto;
  min-width: 0;
}

.exercise-block__identity > div {
  min-width: 0;
}

.exercise-block__identity img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.exercise-block__badges {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
  max-width: 100%;
}

.exercise-block__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #c97716 !important;
  color: #ffffff !important;
  font-weight: 600;
  font-size: 0.72rem;
  line-height: 1;
  white-space: nowrap;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.72rem;
  border: 1px solid transparent;
  line-height: 1;
  white-space: nowrap;
}
.type-badge--strength {
  background: #2563eb !important;
  color: #ffffff !important;
}
.type-badge--cardio {
  background: #14532D;
  border-color: #22C55E;
  color: #FFFFFF;
}
.type-badge--other {
  background: #1e3a8a;
  border-color: #3b82f6;
  color: #ffffff;
}

.exercise-block__identity h4 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
  overflow-wrap: break-word;
  word-break: normal;
}

.exercise-block__identity p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: #64748b;
  overflow-wrap: break-word;
  word-break: normal;
}

.exercise-block__actions {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  min-width: max-content;
}

.exercise-action-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 5px;
  padding: 0;
  color: #1f2937;
  cursor: pointer;
  font-size: 0.82rem;
  line-height: 1;
}

.exercise-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.exercise-action-btn--move {
  border-color: #2563eb !important;
  color: #ffffff !important;
  background: #2563eb !important;
}

.exercise-action-btn--move:hover:not(:disabled) {
  background: #1d4ed8 !important;
  border-color: #1d4ed8 !important;
}

.exercise-action-btn--move-down {
  border-color: #0f766e !important;
  background: #0f766e !important;
}

.exercise-action-btn--move-down:hover:not(:disabled) {
  background: #115e59 !important;
  border-color: #115e59 !important;
}

.exercise-action-btn--remove {
  border-color: #b91c1c !important;
  color: #ffffff !important;
  background: #b91c1c !important;
}

.exercise-action-btn--remove:hover:not(:disabled) {
  background: #991b1b !important;
  border-color: #991b1b !important;
}

.exercise-block__fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  min-width: 0;
}

.exercise-block__fields label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.exercise-block__fields .exercise-config-field {
  grid-template-columns: minmax(85px, 110px) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.exercise-block__fields .exercise-config-field > span {
  margin: 0;
  line-height: 1.2;
}

.exercise-block__fields span {
  font-size: 0.76rem;
  font-weight: 700;
  color: #475569;
}

.exercise-block__fields input,
.exercise-block__fields select {
  border: 1px solid #d6dee9;
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
  min-height: 36px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  color: #0f172a;
}

.field-notes,
.field-full {
  grid-column: span 1;
}

@media (min-width: 700px) {
  .exercise-block__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-half {
    min-width: 0;
  }

  .field-notes,
  .field-full {
    grid-column: span 2;
  }
}

@media (min-width: 1024px) {
  .exercise-block__fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .field-notes,
  .field-full {
    grid-column: span 3;
  }
}

@media (min-width: 801px) {
  .exercise-block__fields.exercise-block__fields--strength-desktop {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .exercise-block__fields.exercise-block__fields--strength-desktop .field-full {
    grid-column: 1 / -1;
  }

  .exercise-block__fields.exercise-block__fields--strength-desktop > .field-full:not(.field-notes):not(.strength-field-group) {
    order: 0;
  }

  .exercise-block__fields.exercise-block__fields--strength-desktop .strength-field-group {
    grid-column: span 1;
    min-width: 0;
  }

  .exercise-block__fields.exercise-block__fields--strength-desktop .strength-field--weight {
    order: 1;
  }

  .exercise-block__fields.exercise-block__fields--strength-desktop .strength-field--reps {
    order: 2;
  }

  .exercise-block__fields.exercise-block__fields--strength-desktop .strength-field--sets {
    order: 3;
  }

  .exercise-block__fields.exercise-block__fields--strength-desktop .field-notes {
    order: 4;
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop .field-full {
    grid-column: 1 / -1;
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop > .field-full:not(.field-notes):not(.cardio-field-group) {
    order: 0;
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop .cardio-field-group {
    grid-column: span 1;
    min-width: 0;
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop .cardio-field--duration {
    order: 1;
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop .cardio-field--calories {
    order: 2;
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop .cardio-field--distance {
    order: 3;
  }

  .exercise-block__fields.exercise-block__fields--cardio-desktop .field-notes {
    order: 4;
  }
}

@media (max-width: 768px) {
  /* Compact card */
  .exercise-block {
    padding: 10px 12px;
    border-radius: 10px;
    margin-bottom: 0;
  }

  /* Keep identity first and actions on a separate right-aligned row */
  .exercise-block__head {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 8px;
    margin-bottom: 8px;
  }

  /* Identity: image left (56px), text right */
  .exercise-block__identity {
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .exercise-block__identity img {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 8px;
  }

  .exercise-block__identity h4 { font-size: 0.85rem; margin: 1px 0 2px; }
  .exercise-block__identity p { font-size: 0.72rem; margin-top: 0; line-height: 1.3; }
  .exercise-block__badges { gap: 6px; margin-bottom: 2px; }
  .exercise-block__badge, .type-badge { font-size: 0.62rem; min-height: 18px; padding: 1px 5px; }

  .exercise-block__actions {
    width: 100%;
    flex-wrap: nowrap;
    justify-content: flex-end;
    align-self: start;
    gap: 5px;
  }

  .exercise-action-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    border-radius: 5px;
    font-size: 0.78rem;
  }

  /* Field grid: stack on mobile to avoid clipping */
  .exercise-block__fields {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .field-half { grid-column: 1 / -1; }
  .field-full, .field-notes { grid-column: 1 / -1; }

  .exercise-block__fields label { gap: 3px; }
  .exercise-block__fields span { font-size: 0.7rem; font-weight: 600; color: #64748b; }

  .exercise-block__fields input,
  .exercise-block__fields select {
    min-height: 36px;
    height: 36px;
    padding: 0 10px;
    font-size: 0.82rem;
    border-radius: 8px;
    box-sizing: border-box;
  }
}

@media (max-width: 480px) {
  .exercise-block { padding: 8px 10px; }
  .exercise-block__identity img { width: 48px; height: 48px; }
  .exercise-block__identity h4 { font-size: 0.8rem; }
  .exercise-action-btn { width: 30px; height: 30px; min-width: 30px; min-height: 30px; font-size: 0.72rem; }
  .exercise-block__fields input, .exercise-block__fields select { min-height: 34px; height: 34px; font-size: 0.78rem; }
  .exercise-block__fields span { font-size: 0.66rem; }
}
</style>
