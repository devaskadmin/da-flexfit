<script setup>
import { computed, ref } from 'vue';
import { DEFAULT_EXERCISE_IMAGE, getExerciseImage } from '@/utils/exerciseImage';
import { getRecordingFieldGroups, normalizeRecordingType, getRecordingFieldLabels, normalizeWorkoutTypeBadge } from '@/utils/exerciseRecordingFields';

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
  String(
    props.exercise.workoutType ||
    props.exercise.WorkoutType ||
    props.exercise.workout_type ||
    props.exercise.type ||
    ''
  ).trim().toLowerCase()
);

const workoutTypeBadgeLabel = computed(() => normalizeWorkoutTypeBadge(props.exercise));

const normalizedRecordingType = computed(() => normalizeRecordingType(props.exercise));
const recordingFieldGroups = computed(() => getRecordingFieldGroups(props.exercise));
const fieldLabels = getRecordingFieldLabels();
const showAdditionalFields = ref(false);

const fieldDefinitions = {
  weight: { key: 'weight', type: 'number', placeholder: '0', shortLabel: 'LBS' },
  reps: { key: 'reps', type: 'number', placeholder: '0', shortLabel: 'Reps' },
  sets: { key: 'sets', type: 'number', placeholder: '0', shortLabel: 'Sets' },
  duration: { key: 'duration', type: 'number', placeholder: '0', shortLabel: 'Time' },
  calories: { key: 'calories', type: 'number', placeholder: '0', shortLabel: 'Cal' },
  distance: { key: 'distance', type: 'number', placeholder: '0', shortLabel: 'Dist' },
};

const primaryFields = computed(() => recordingFieldGroups.value.primary.map((key) => ({
  ...fieldDefinitions[key],
  label: fieldLabels[key],
})));
const secondaryFields = computed(() => recordingFieldGroups.value.secondary.map((key) => ({
  ...fieldDefinitions[key],
  label: fieldLabels[key],
})));

const workoutTypeBadgeClass = computed(() => {
  if (normalizedWorkoutType.value === 'cardio') return 'type-badge--cardio';
  if (normalizedWorkoutType.value === 'other')  return 'type-badge--other';
  return 'type-badge--strength';
});

const activeFieldGroup = ref('primary');
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
            <span v-if="workoutTypeBadgeLabel" :class="['type-badge', workoutTypeBadgeClass]">{{ workoutTypeBadgeLabel }}</span>
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

    <div class="exercise-block__fields">
      <!-- Schedule group (always visible) -->
      <label class="field-full exercise-config-field">
        <span>{{ scheduleMode === 'week' ? 'Week Group' : 'Day Group' }}</span>
        <select
          :value="exercise.scheduleGroup"
          @change="updateField('scheduleGroup', $event.target.value)"
        >
          <option v-for="group in scheduleGroups" :key="group" :value="group">{{ group }}</option>
        </select>
      </label>

      <div class="recording-primary-row" aria-label="Primary exercise fields">
        <label v-for="field in primaryFields" :key="field.key" class="recording-field">
          <span class="recording-field-label-full">{{ field.label }}</span>
          <span class="recording-field-label-short" aria-hidden="true">{{ field.shortLabel }}</span>
          <input
            :value="exercise[field.key]"
            :type="field.type"
            :min="field.type === 'number' ? 0 : undefined"
            :placeholder="field.placeholder"
            @input="updateField(field.key, $event.target.value, field.type === 'number')"
          />
        </label>

        <button
          type="button"
          class="recording-fields-toggle"
          :aria-label="showAdditionalFields ? 'Hide Additional Fields' : 'Show Additional Fields'"
          :title="showAdditionalFields ? 'Hide Additional Fields' : 'Show Additional Fields'"
          :aria-expanded="showAdditionalFields ? 'true' : 'false'"
          aria-controls="exercise-additional-fields"
          @click="showAdditionalFields = !showAdditionalFields"
        >
          <i :class="showAdditionalFields ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i>
          <span class="recording-fields-toggle-label">{{ showAdditionalFields ? 'Less' : 'More' }}</span>
        </button>
      </div>

      <div
        v-if="showAdditionalFields"
        id="exercise-additional-fields"
        class="recording-additional-row"
        aria-label="Additional exercise fields"
      >
        <label v-for="field in secondaryFields" :key="field.key" class="recording-field">
          <span class="recording-field-label-full">{{ field.label }}</span>
          <span class="recording-field-label-short" aria-hidden="true">{{ field.shortLabel }}</span>
          <input
            :value="exercise[field.key]"
            :type="field.type"
            :min="field.type === 'number' ? 0 : undefined"
            :placeholder="field.placeholder"
            @input="updateField(field.key, $event.target.value, field.type === 'number')"
          />
        </label>
      </div>

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

.toggle-field-group-btn {
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 0.82rem;
  line-height: 1;
  width: 100%;
  text-align: center;
}

.toggle-field-group-btn:hover {
  background: #1d4ed8;
}

.recording-primary-row,
.recording-additional-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
  width: 100%;
  grid-column: 1 / -1;
}

.recording-primary-row {
  grid-template-columns: repeat(3, minmax(0, 1fr)) 44px;
  align-items: end;
}

.recording-additional-row {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  margin-top: 12px;
}

.recording-field {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-width: 0;
  gap: 4px;
}

.recording-field input {
  flex: 1 1 0;
  width: 100%;
  min-width: 0;
}

.recording-field-label-short,
.recording-fields-toggle-label-short {
  display: none;
}

.recording-fields-toggle {
  display: inline-flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  width: 44px;
  min-width: 44px;
  height: 44px;
  min-height: 44px;
  gap: 1px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  padding: 0;
  margin: 0;
  white-space: nowrap;
}

.recording-fields-toggle i {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  background: #2563EB;
  color: #FFFFFF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.recording-fields-toggle-label {
  display: block;
  width: 44px;
  text-align: center;
  font-size: 0.62rem;
  line-height: 1;
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

  .recording-primary-row,
  .session-recording-primary-row {
    grid-template-columns: repeat(3, minmax(0, 1fr)) 44px;
    gap: 6px;
    align-items: center;
  }

  .recording-additional-row,
  .session-recording-additional-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin-top: 10px;
  }

  .recording-field {
    display: flex;
    flex-direction: row;
    align-items: center;
    min-width: 0;
    gap: 3px;
  }

  .recording-field-label-full,
  .recording-fields-toggle-label-full {
    display: none;
  }

  .recording-field-label-short,
  .recording-fields-toggle-label-short {
    display: inline;
  }

  .recording-fields-toggle {
    width: 44px;
    min-width: 44px;
    height: 44px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
  }

  .recording-fields-toggle i {
    width: 30px;
    height: 30px;
    min-width: 30px;
  }

  .recording-fields-toggle-label {
    font-size: 0.62rem;
    line-height: 1;
  }

  .exercise-block__fields .recording-field,
  .exercise-block__fields label.recording-field,
  .recording-field {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
  }

  .exercise-block__fields .recording-fields-toggle,
  .recording-fields-toggle {
    display: inline-flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
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
