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
});

const emit = defineEmits(['close', 'add']);

const search = ref('');
const muscle = ref('All');
const equipment = ref('All');

watch(
  () => props.isOpen,
  (open) => {
    if (!open) {
      search.value = '';
      muscle.value = 'All';
      equipment.value = 'All';
    }
  }
);

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

  return props.exercises.filter((exercise) => {
    const title = (exercise.ExerciseTitle || '').toLowerCase();
    const exerciseMuscle = exercise.MuscleGroup || '';
    const exerciseEquipment = exercise.Equipment || '';

    const matchesSearch = !searchValue || title.includes(searchValue);
    const matchesMuscle = muscle.value === 'All' || exerciseMuscle === muscle.value;
    const matchesEquipment = equipment.value === 'All' || exerciseEquipment === equipment.value;

    return matchesSearch && matchesMuscle && matchesEquipment;
  });
});

const getPrimaryImage = (exercise) => getExerciseImage(exercise);

const onImageError = (event) => {
  if (event?.target && event.target.src !== DEFAULT_EXERCISE_IMAGE) {
    event.target.src = DEFAULT_EXERCISE_IMAGE;
  }
};

const quickAdd = (exercise) => {
  emit('add', {
    ExerciseID: exercise.ExerciseID,
    ExerciseTitle: exercise.ExerciseTitle,
    WorkoutType: exercise.WorkoutType,
    MuscleGroup: exercise.MuscleGroup,
    Equipment: exercise.Equipment,
    image: getPrimaryImage(exercise),
  });
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

      <div class="picker-filters">
        <input
          v-model="search"
          type="text"
          placeholder="Search by exercise name"
        />

        <select v-model="muscle">
          <option v-for="option in muscleOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>

        <select v-model="equipment">
          <option v-for="option in equipmentOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </div>

      <div class="picker-results">
        <article
          v-for="exercise in filteredExercises"
          :key="exercise.ExerciseID"
          class="picker-card"
        >
          <img
            :src="getPrimaryImage(exercise)"
            :alt="exercise.ExerciseTitle"
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
          <button type="button" class="btn-add" @click="quickAdd(exercise)">Add</button>
        </article>

        <div v-if="filteredExercises.length === 0" class="picker-empty">
          No exercises match your filters.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  display: grid;
  place-items: center;
  z-index: 1050;
  padding: 16px;
}

.picker-modal {
  width: min(1000px, 100%);
  max-height: 90vh;
  overflow: hidden;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #dbe4ef;
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.picker-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.picker-head h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #0f172a;
}

.picker-head p {
  margin: 4px 0 0;
  color: #64748b;
}

.btn-close {
  border: none;
  background: transparent;
  color: #475569;
  cursor: pointer;
  font-size: 1rem;
}

.picker-filters {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.picker-filters input,
.picker-filters select {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px 12px;
}

.picker-results {
  overflow: auto;
  padding: 14px 18px;
  display: grid;
  gap: 10px;
}

.picker-card {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  align-items: center;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px;
}

.picker-card img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 10px;
  background: #f1f5f9;
}

.picker-card__meta h4 {
  margin: 0;
  color: #0f172a;
  font-size: 0.98rem;
}

.picker-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.picker-chip {
  background: #eef2ff;
  color: #4338ca;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-add {
  border: none;
  background: #059669;
  color: #fff;
  font-weight: 600;
  border-radius: 9px;
  padding: 8px 12px;
  cursor: pointer;
}

.picker-empty {
  text-align: center;
  color: #64748b;
  padding: 20px;
}

@media (max-width: 768px) {
  .picker-filters {
    grid-template-columns: 1fr;
  }

  .picker-card {
    grid-template-columns: 1fr;
    text-align: left;
  }

  .picker-card img {
    width: 100%;
    height: 170px;
  }
}
</style>
