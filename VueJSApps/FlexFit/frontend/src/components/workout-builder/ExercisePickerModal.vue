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
});

const emit = defineEmits(['close', 'add']);

const search = ref('');
const muscle = ref('All');
const equipment = ref('All');
const viewFilter = ref('all'); // 'all' | 'mine' | 'favorites'
const PAGE_SIZE = 5;
const visibleCount = ref(PAGE_SIZE);

watch(
  () => props.isOpen,
  (open) => {
    if (!open) {
      search.value = '';
      muscle.value = 'All';
      equipment.value = 'All';
      viewFilter.value = 'all';
      visibleCount.value = PAGE_SIZE;
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

const visibleExercises = computed(() => filteredExercises.value.slice(0, visibleCount.value));

const loadMore = () => {
  visibleCount.value += PAGE_SIZE;
};

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

      <!-- View segmented control -->
      <div class="picker-view-tabs">
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

      <div class="picker-count" v-if="filteredExercises.length > 0">
        Showing {{ Math.min(visibleCount, filteredExercises.length) }} of {{ filteredExercises.length }} exercises
      </div>

      <div class="picker-results">
        <article
          v-for="exercise in visibleExercises"
          :key="exercise.ExerciseID"
          class="picker-card"
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
          <button type="button" class="btn-add" @click="quickAdd(exercise)">Add</button>
        </article>

        <div v-if="filteredExercises.length === 0" class="picker-empty">
          {{ emptyMessage }}
        </div>

        <div v-if="visibleCount < filteredExercises.length" class="picker-load-more">
          <button type="button" class="btn-load-more" @click="loadMore">Load More</button>
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
  width: min(720px, 100%);
  max-height: 80vh;
  overflow: hidden;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #dbe4ef;
  display: grid;
  grid-template-rows: auto auto auto auto 1fr;
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

.picker-view-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.view-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 9px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.view-tab:hover {
  color: #0f172a;
}

.view-tab--active {
  color: #059669;
  border-bottom-color: #059669;
  background: #fff;
}

.picker-count {
  padding: 6px 18px;
  font-size: 0.8rem;
  color: #64748b;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.picker-results {
  overflow: auto;
  padding: 14px 18px;
  display: grid;
  gap: 10px;
}

.picker-load-more {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.btn-load-more {
  border: 1px solid #059669;
  background: #fff;
  color: #059669;
  font-weight: 700;
  border-radius: 10px;
  padding: 8px 24px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}

.btn-load-more:hover {
  background: #059669;
  color: #fff;
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
