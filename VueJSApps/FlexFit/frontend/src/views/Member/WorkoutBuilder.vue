<script setup>
import { computed, onMounted, ref } from 'vue';
import WorkoutMetadataForm from '@/components/workout-builder/WorkoutMetadataForm.vue';
import ExercisePickerModal from '@/components/workout-builder/ExercisePickerModal.vue';
import WorkoutExerciseBlock from '@/components/workout-builder/WorkoutExerciseBlock.vue';

const metadata = ref({
  name: '',
  description: '',
  type: 'Strength',
  estimatedDuration: 45,
});

const allExercises = ref([]);
const workoutExercises = ref([]);
const pickerOpen = ref(false);
const loadingExercises = ref(false);
const saving = ref(false);
const saveMessage = ref('');
const userId = ref(null);

const totalDuration = computed(() => {
  const fromBlocks = workoutExercises.value.reduce((total, exercise) => total + Number(exercise.duration || 0), 0);
  if (fromBlocks > 0) {
    return fromBlocks;
  }
  return Number(metadata.value.estimatedDuration || 0);
});

const completedVolume = computed(() => {
  return workoutExercises.value.reduce((total, exercise) => {
    return total + Number(exercise.sets || 0) * Number(exercise.reps || 0) * Number(exercise.weight || 0);
  }, 0);
});

const openPicker = () => {
  pickerOpen.value = true;
};

const closePicker = () => {
  pickerOpen.value = false;
};

const createBlock = (exercise) => ({
  id: `${exercise.ExerciseID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  exerciseId: exercise.ExerciseID,
  name: exercise.ExerciseTitle,
  image: exercise.image || '',
  workoutType: exercise.WorkoutType || metadata.value.type,
  muscleGroup: exercise.MuscleGroup || '',
  equipment: exercise.Equipment || '',
  sets: metadata.value.type === 'Cardio' ? 0 : 3,
  reps: metadata.value.type === 'Cardio' ? 0 : 10,
  weight: 0,
  duration: metadata.value.type === 'Cardio' ? 10 : 0,
  restTime: 60,
  notes: '',
});

const addExerciseToWorkout = (exercise) => {
  workoutExercises.value.push(createBlock(exercise));
  saveMessage.value = '';
};

const updateExerciseField = ({ id, field, value }) => {
  const target = workoutExercises.value.find((exercise) => exercise.id === id);
  if (!target) {
    return;
  }

  target[field] = value;
};

const removeExercise = (id) => {
  workoutExercises.value = workoutExercises.value.filter((exercise) => exercise.id !== id);
};

const moveExerciseUp = (id) => {
  const index = workoutExercises.value.findIndex((exercise) => exercise.id === id);
  if (index <= 0) {
    return;
  }

  const next = [...workoutExercises.value];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  workoutExercises.value = next;
};

const moveExerciseDown = (id) => {
  const index = workoutExercises.value.findIndex((exercise) => exercise.id === id);
  if (index < 0 || index >= workoutExercises.value.length - 1) {
    return;
  }

  const next = [...workoutExercises.value];
  [next[index + 1], next[index]] = [next[index], next[index + 1]];
  workoutExercises.value = next;
};

const toMySQLDate = (date) => {
  const d = new Date(date);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const saveWorkout = async () => {
  saveMessage.value = '';

  if (!metadata.value.name.trim()) {
    saveMessage.value = 'Please enter a workout name.';
    return;
  }

  if (workoutExercises.value.length === 0) {
    saveMessage.value = 'Please add at least one exercise.';
    return;
  }

  if (!userId.value) {
    saveMessage.value = 'Unable to resolve user session. Please login again.';
    return;
  }

  saving.value = true;
  const workoutDate = toMySQLDate(new Date());

  try {
    for (const exercise of workoutExercises.value) {
      const payload = {
        UserID: userId.value,
        ExerciseID: exercise.exerciseId,
        WorkoutDate: workoutDate,
        WorkoutType: metadata.value.type,
        Duration: Number(exercise.duration || 0),
        Reps: Number(exercise.reps || 0),
        Sets: Number(exercise.sets || 0),
        Weight: Number(exercise.weight || 0),
        Calories: 0,
        Distance: 0,
        Speed: 0,
        'Laps-Rep': 0,
      };

      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/workout-log/add-workout-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to save workout blocks.');
      }
    }

    saveMessage.value = 'Workout saved successfully.';
  } catch (error) {
    saveMessage.value = error.message || 'Failed to save workout.';
  } finally {
    saving.value = false;
  }
};

const loadExercises = async () => {
  loadingExercises.value = true;
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/get-exercises`, {
      credentials: 'include',
    });
    const data = await response.json();
    allExercises.value = Array.isArray(data) ? data : [];
  } finally {
    loadingExercises.value = false;
  }
};

const loadUserId = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/user-id`, {
      credentials: 'include',
    });
    const data = await response.json();
    userId.value = data?.userId || null;
  } catch {
    userId.value = null;
  }
};

onMounted(async () => {
  await Promise.all([loadExercises(), loadUserId()]);
});
</script>

<template>
  <div class="workout-builder-page">
    <section class="builder-hero">
      <div>
        <h2>Workout Builder</h2>
        <p>Build sessions quickly with an athlete-first workflow.</p>
      </div>
      <div class="builder-hero__stats">
        <div>
          <strong>{{ workoutExercises.length }}</strong>
          <span>Exercises</span>
        </div>
        <div>
          <strong>{{ totalDuration }}</strong>
          <span>Min</span>
        </div>
        <div>
          <strong>{{ completedVolume.toLocaleString() }}</strong>
          <span>Volume</span>
        </div>
      </div>
    </section>

    <WorkoutMetadataForm
      :metadata="metadata"
      @update:metadata="metadata = $event"
    />

    <section class="builder-section">
      <div class="builder-section__head builder-section__head--inline">
        <div>
          <h3>Workout Blocks</h3>
          <p>Add exercises and tweak each block inline.</p>
        </div>

        <button type="button" class="btn-add-exercise" @click="openPicker">
          + Add Exercise
        </button>
      </div>

      <div v-if="loadingExercises" class="builder-empty">Loading exercise library...</div>

      <div v-else-if="workoutExercises.length === 0" class="builder-empty">
        Start by adding your first exercise block.
      </div>

      <div v-else>
        <WorkoutExerciseBlock
          v-for="(exercise, index) in workoutExercises"
          :key="exercise.id"
          :exercise="exercise"
          :index="index"
          :total="workoutExercises.length"
          @update-field="updateExerciseField"
          @remove="removeExercise"
          @move-up="moveExerciseUp"
          @move-down="moveExerciseDown"
        />
      </div>
    </section>

    <footer class="builder-footer">
      <p v-if="saveMessage" :class="['save-message', saveMessage.includes('success') ? 'ok' : 'err']">
        {{ saveMessage }}
      </p>
      <button type="button" class="btn-save" :disabled="saving" @click="saveWorkout">
        {{ saving ? 'Saving...' : 'Save Workout' }}
      </button>
    </footer>

    <ExercisePickerModal
      :is-open="pickerOpen"
      :exercises="allExercises"
      @close="closePicker"
      @add="addExerciseToWorkout"
    />
  </div>
</template>

<style scoped>
.workout-builder-page {
  display: grid;
  gap: 14px;
}

.builder-hero {
  border-radius: 18px;
  padding: 20px;
  background: linear-gradient(120deg, #020617 0%, #081a3a 56%, #0a1f4a 100%);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.builder-hero h2 {
  margin: 0;
  font-size: 1.5rem;
}

.builder-hero p {
  margin: 6px 0 0;
  color: #cbd5e1;
}

.builder-hero__stats {
  display: flex;
  gap: 12px;
}

.builder-hero__stats div {
  min-width: 92px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 9px 10px;
  display: grid;
  gap: 3px;
  background: rgba(255, 255, 255, 0.08);
}

.builder-hero__stats strong {
  font-size: 1.1rem;
  line-height: 1;
}

.builder-hero__stats span {
  font-size: 0.76rem;
  color: #cbd5e1;
}

.builder-section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
}

.builder-section__head h3 {
  margin: 0;
  color: #0f172a;
}

.builder-section__head p {
  margin: 4px 0 0;
  color: #64748b;
}

.builder-section__head--inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.btn-add-exercise {
  border: none;
  border-radius: 10px;
  background: #059669;
  color: #fff;
  font-weight: 700;
  padding: 10px 14px;
}

.builder-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  color: #64748b;
}

.builder-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.save-message {
  margin: 0;
  font-weight: 600;
}

.save-message.ok {
  color: #166534;
}

.save-message.err {
  color: #b91c1c;
}

.btn-save {
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
  padding: 10px 16px;
}

.btn-save:disabled {
  opacity: 0.55;
}

@media (max-width: 768px) {
  .builder-hero__stats {
    width: 100%;
  }

  .builder-hero__stats div {
    flex: 1;
  }
}
</style>
