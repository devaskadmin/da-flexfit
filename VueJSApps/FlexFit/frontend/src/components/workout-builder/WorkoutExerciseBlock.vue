<script setup>
import { API_BASE } from '@/config/env';

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

const FALLBACK_EXERCISE_IMAGE = '/assets/Excerises/default/default.jpg';

const resolveImageSrc = (value) => {
  const raw = String(value || '').trim();
  const source = raw || FALLBACK_EXERCISE_IMAGE;

  if (/^https?:\/\//i.test(source) || source.startsWith('data:')) {
    return source;
  }

  if (source.startsWith('/')) {
    return `${API_BASE}${source}`;
  }

  return source;
};

const handleImageError = (event) => {
  if (!event?.target) return;
  event.target.src = resolveImageSrc(FALLBACK_EXERCISE_IMAGE);
};

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
          :src="resolveImageSrc(exercise.image)"
          :alt="exercise.name"
          width="72"
          height="72"
          loading="lazy"
          decoding="async"
          @error="handleImageError"
        />
        <div>
          <span class="exercise-block__badge">Block {{ index + 1 }}</span>
          <h4>{{ exercise.name }}</h4>
          <p>{{ exercise.muscleGroup || 'N/A' }} • {{ exercise.equipment || 'Bodyweight' }}</p>
        </div>
      </div>

      <div class="exercise-block__actions">
        <button type="button" :disabled="index === 0" @click="emit('move-up', exercise.id)">Move Up</button>
        <button type="button" :disabled="index === total - 1" @click="emit('move-down', exercise.id)">Move Down</button>
        <button type="button" class="btn-remove" @click="emit('remove', exercise.id)">Remove</button>
      </div>
    </header>

    <div class="exercise-block__fields">
      <label>
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

      <label>
        <span>Sets</span>
        <input
          :value="exercise.sets"
          type="number"
          min="0"
          @input="updateField('sets', $event.target.value, true)"
        />
      </label>

      <label>
        <span>Reps</span>
        <input
          :value="exercise.reps"
          type="number"
          min="0"
          @input="updateField('reps', $event.target.value, true)"
        />
      </label>

      <label>
        <span>Weight</span>
        <input
          :value="exercise.weight"
          type="number"
          min="0"
          @input="updateField('weight', $event.target.value, true)"
        />
      </label>

      <label>
        <span>Duration (min)</span>
        <input
          :value="exercise.duration"
          type="number"
          min="0"
          @input="updateField('duration', $event.target.value, true)"
        />
      </label>

      <label>
        <span>Rest (sec)</span>
        <input
          :value="exercise.restTime"
          type="number"
          min="0"
          @input="updateField('restTime', $event.target.value, true)"
        />
      </label>

      <label class="field-notes">
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
  border-radius: 16px;
  background: #fff;
  padding: 14px;
}

.exercise-block + .exercise-block {
  margin-top: 12px;
}

.planner-card {
  border-radius: 16px;
  border: 1px solid #d6e0ee;
  background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}

.exercise-block__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.exercise-block__identity {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.exercise-block__identity img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.exercise-block__badge {
  display: inline-flex;
  margin-bottom: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #1e3a8a;
  font-weight: 700;
  font-size: 0.72rem;
}

.exercise-block__identity h4 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
}

.exercise-block__identity p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: #64748b;
}

.exercise-block__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.exercise-block__actions button {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 10px;
  min-height: 40px;
  padding: 0 12px;
  color: #1f2937;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.84rem;
}

.exercise-block__actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.exercise-block__actions .btn-remove {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fff5f5;
}

.exercise-block__fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.exercise-block__fields label {
  display: grid;
  gap: 5px;
}

.exercise-block__fields span {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}

.exercise-block__fields input {
  border: 1px solid #d6dee9;
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 11px;
  min-height: 42px;
}

.exercise-block__fields select {
  border: 1px solid #d6dee9;
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 11px;
  min-height: 42px;
}

.field-notes {
  grid-column: span 1;
}

@media (min-width: 700px) {
  .exercise-block__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-notes {
    grid-column: span 2;
  }
}

@media (min-width: 1024px) {
  .exercise-block__fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .field-notes {
    grid-column: span 3;
  }
}

@media (max-width: 768px) {
  .exercise-block__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .exercise-block__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .exercise-block__actions button {
    flex: 1 1 30%;
  }
}
</style>
