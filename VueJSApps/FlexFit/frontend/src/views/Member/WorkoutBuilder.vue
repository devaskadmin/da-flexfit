<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import WorkoutMetadataForm from '@/components/workout-builder/WorkoutMetadataForm.vue';
import ExercisePickerModal from '@/components/workout-builder/ExercisePickerModal.vue';
import WorkoutExerciseBlock from '@/components/workout-builder/WorkoutExerciseBlock.vue';
import { API_BASE } from '@/config/env';
import { refreshWorkoutStatus, setUserWorkoutStatus } from '@/composable/workoutStatusManager';

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
const loadingPlanner = ref(false);
const saving = ref(false);
const saveMessage = ref('');
const plannerMessage = ref('');
const userId = ref(null);
const currentPlanId = ref('');
const hasSavedWorkoutExerciseList = ref(false);
const isWorkoutDetailsOpen = ref(true);
const isSchedulePlannerOpen = ref(true);
const route = useRoute();

const scheduleMode = ref('day'); // day | week
const dayGroups = ref(['Any Day']);
const weekGroups = ref(['Week 1']);
const newScheduleGroupName = ref('');

const activeGroups = computed(() => (scheduleMode.value === 'week' ? weekGroups.value : dayGroups.value));

const plannerGroupsWithExercises = computed(() => {
  const groups = activeGroups.value.length > 0
    ? activeGroups.value
    : [scheduleMode.value === 'week' ? 'Week 1' : 'Any Day'];

  return groups.map((group) => ({
    name: group,
    exercises: workoutExercises.value
      .map((exercise, index) => ({ exercise, index }))
      .filter((entry) => (entry.exercise.scheduleGroup || groups[0]) === group),
  }));
});

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

const ensureActiveGroups = () => {
  if (scheduleMode.value === 'week' && weekGroups.value.length === 0) {
    weekGroups.value = ['Week 1'];
  }
  if (scheduleMode.value === 'day' && dayGroups.value.length === 0) {
    dayGroups.value = ['Any Day'];
  }
};

const buildDefaultGroupName = () => {
  const isWeek = scheduleMode.value === 'week';
  const current = isWeek ? weekGroups.value : dayGroups.value;
  const prefix = isWeek ? 'Week' : 'Day';
  let index = 1;
  while (current.includes(`${prefix} ${index}`)) {
    index += 1;
  }
  return `${prefix} ${index}`;
};

const addScheduleGroup = () => {
  const name = (newScheduleGroupName.value || '').trim() || buildDefaultGroupName();
  const target = scheduleMode.value === 'week' ? weekGroups : dayGroups;
  const normalizedName = name.toLowerCase();

  if (target.value.some((group) => String(group).toLowerCase() === normalizedName)) {
    plannerMessage.value = `${name} already exists.`;
    return;
  }

  target.value = [...target.value, name];
  newScheduleGroupName.value = '';
  plannerMessage.value = '';
};

const removeScheduleGroup = (groupName) => {
  const isWeek = scheduleMode.value === 'week';
  const target = isWeek ? weekGroups : dayGroups;
  const fallback = isWeek ? 'Week 1' : 'Any Day';

  if (groupName === fallback) {
    return;
  }

  const nextGroups = target.value.filter((group) => group !== groupName);
  target.value = nextGroups.length > 0 ? nextGroups : [fallback];

  const nextFallback = target.value[0] || fallback;
  workoutExercises.value = workoutExercises.value.map((exercise) => {
    if (exercise.scheduleGroup === groupName) {
      return { ...exercise, scheduleGroup: nextFallback };
    }
    return exercise;
  });
};

const changeScheduleMode = (mode) => {
  scheduleMode.value = mode === 'week' ? 'week' : 'day';
  ensureActiveGroups();
  plannerMessage.value = '';
  const fallback = activeGroups.value[0];

  workoutExercises.value = workoutExercises.value.map((exercise) => ({
    ...exercise,
    scheduleGroup: activeGroups.value.includes(exercise.scheduleGroup)
      ? exercise.scheduleGroup
      : fallback,
  }));
};

const toggleWorkoutDetails = () => {
  isWorkoutDetailsOpen.value = !isWorkoutDetailsOpen.value;
};

const toggleSchedulePlanner = () => {
  isSchedulePlannerOpen.value = !isSchedulePlannerOpen.value;
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
  scheduleGroup: activeGroups.value[0],
});

const addExerciseToWorkout = (exercise) => {
  ensureActiveGroups();
  workoutExercises.value.push(createBlock(exercise));
  saveMessage.value = '';
  plannerMessage.value = '';
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

const plannerPayload = computed(() => ({
  planId: currentPlanId.value || undefined,
  metadata: {
    ...metadata.value,
  },
  scheduleMode: scheduleMode.value,
  dayGroups: dayGroups.value,
  weekGroups: weekGroups.value,
  exercises: workoutExercises.value,
}));

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

  try {
    const response = await fetch(`${API_BASE}/api/workout-planner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planner: plannerPayload.value }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to save workout planner.');
    }

    const data = await response.json();
    currentPlanId.value = String(data?.planner?.planId || currentPlanId.value || '').trim();
    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);
    await refreshWorkoutStatus();
    saveMessage.value = 'Workout schedule saved successfully.';
  } catch (error) {
    saveMessage.value = error.message || 'Failed to save workout planner.';
  } finally {
    saving.value = false;
  }
};

const loadExercises = async () => {
  loadingExercises.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/get-exercises`, {
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
    const response = await fetch(`${API_BASE}/api/user-id`, {
      credentials: 'include',
    });
    const data = await response.json();
    userId.value = data?.userId || null;
  } catch {
    userId.value = null;
  }
};

const loadWorkoutPlanner = async (requestedPlanId = '') => {
  loadingPlanner.value = true;
  try {
    const query = requestedPlanId
      ? `?planId=${encodeURIComponent(String(requestedPlanId).trim())}`
      : '';

    const response = await fetch(`${API_BASE}/api/workout-planner${query}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const planner = data?.planner || {};
    currentPlanId.value = String(planner?.planId || '').trim();

    metadata.value = {
      name: planner?.metadata?.name || '',
      description: planner?.metadata?.description || '',
      type: planner?.metadata?.type || 'Strength',
      estimatedDuration: Number(planner?.metadata?.estimatedDuration || 45),
    };

    scheduleMode.value = planner?.scheduleMode === 'week' ? 'week' : 'day';
    dayGroups.value = Array.isArray(planner?.dayGroups) && planner.dayGroups.length > 0
      ? planner.dayGroups
      : ['Any Day'];
    weekGroups.value = Array.isArray(planner?.weekGroups) && planner.weekGroups.length > 0
      ? planner.weekGroups
      : ['Week 1'];

    workoutExercises.value = Array.isArray(planner?.exercises)
      ? planner.exercises.map((exercise) => ({
          ...exercise,
          scheduleGroup: exercise?.scheduleGroup || (scheduleMode.value === 'week' ? weekGroups.value[0] : dayGroups.value[0]),
        }))
      : [];

    const assignedGroups = Array.from(
      new Set(workoutExercises.value.map((exercise) => String(exercise.scheduleGroup || '').trim()).filter(Boolean))
    );

    if (scheduleMode.value === 'week') {
      weekGroups.value = Array.from(new Set([...weekGroups.value, ...assignedGroups]));
    } else {
      dayGroups.value = Array.from(new Set([...dayGroups.value, ...assignedGroups]));
    }

    hasSavedWorkoutExerciseList.value = Boolean(data?.hasSavedWorkoutExerciseList);
    setUserWorkoutStatus(hasSavedWorkoutExerciseList.value);
  } catch (err) {
    console.error('Failed to load workout planner:', err);
  } finally {
    loadingPlanner.value = false;
  }
};

onMounted(async () => {
  const requestedPlanId = String(route.query?.planId || '').trim();
  await Promise.all([loadExercises(), loadUserId(), loadWorkoutPlanner(requestedPlanId)]);
});

watch(
  () => route.query?.planId,
  async (nextPlanId, prevPlanId) => {
    if (String(nextPlanId || '').trim() === String(prevPlanId || '').trim()) {
      return;
    }
    await loadWorkoutPlanner(String(nextPlanId || '').trim());
  }
);
</script>

<template>
  <div class="app-page-shell workout-builder-page">
    <div class="app-page-canvas app-inner-shell workout-builder-canvas">
      <section class="builder-hero ff-page-header app-header-gradient">
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

      <section class="builder-section collapsible-panel">
        <button
          type="button"
          class="collapsible-header"
          :aria-expanded="isWorkoutDetailsOpen"
          @click="toggleWorkoutDetails"
        >
          <span class="collapsible-header__text">
            <strong>Workout Details</strong>
            <small>Set the workout context before adding exercises.</small>
          </span>
          <span class="collapsible-header__icon" :class="{ open: isWorkoutDetailsOpen }" aria-hidden="true">
            <i class="fa-solid fa-chevron-down"></i>
          </span>
        </button>

        <transition name="panel-collapse">
          <div v-show="isWorkoutDetailsOpen" class="collapsible-panel__body">
            <WorkoutMetadataForm
              :metadata="metadata"
              @update:metadata="metadata = $event"
            />
          </div>
        </transition>
      </section>

      <section class="builder-section planner-section">
        <div
          class="builder-section__head builder-section__head--inline planner-panel-head"
          role="button"
          tabindex="0"
          :aria-expanded="isSchedulePlannerOpen"
          @click="toggleSchedulePlanner"
          @keydown.enter.prevent="toggleSchedulePlanner"
          @keydown.space.prevent="toggleSchedulePlanner"
        >
          <div class="planner-heading-group">
            <h3>Workout Schedule Planner</h3>
            <p>Plan your workout flow, add exercises, and organize each session clearly.</p>
          </div>

          <div class="planner-head-actions">
            <span class="collapsible-header__icon" :class="{ open: isSchedulePlannerOpen }" aria-hidden="true">
              <i class="fa-solid fa-chevron-down"></i>
            </span>
          </div>
        </div>

        <transition name="panel-collapse">
          <div v-show="isSchedulePlannerOpen" class="collapsible-panel__body">
            <div v-if="!hasSavedWorkoutExerciseList" class="planner-unlock-hint" role="status" aria-live="polite">
              <strong>Create and save a workout plan to unlock your exercise list.</strong>
              <span>Assign exercises by day or week to build your workout schedule.</span>
            </div>

            <div class="planner-tools">
              <div class="planner-mode-toggle" role="tablist" aria-label="Schedule grouping mode">
                <button
                  type="button"
                  class="planner-mode-btn"
                  :class="{ active: scheduleMode === 'day' }"
                  @click="changeScheduleMode('day')"
                >
                  By Day
                </button>
                <button
                  type="button"
                  class="planner-mode-btn"
                  :class="{ active: scheduleMode === 'week' }"
                  @click="changeScheduleMode('week')"
                >
                  By Week
                </button>
              </div>

              <div class="planner-group-editor">
                <input
                  v-model="newScheduleGroupName"
                  type="text"
                  :placeholder="scheduleMode === 'week' ? 'Add Week (e.g. Week 2)' : 'Add Day (e.g. Day 1)'"
                />
                <button type="button" class="planner-group-add" @click="addScheduleGroup">Add {{ scheduleMode === 'week' ? 'Week' : 'Day' }}</button>
              </div>

              <p v-if="plannerMessage" class="planner-feedback planner-feedback--error">
                {{ plannerMessage }}
              </p>

              <div class="planner-primary-actions">
                <button type="button" class="btn-add-exercise" @click="openPicker">
                  <span class="btn-add-exercise__icon">＋</span>
                  <span>Add Exercise</span>
                </button>
              </div>
            </div>

            <div v-if="loadingExercises" class="builder-empty planner-empty planner-empty--loading" aria-live="polite">
              <div class="planner-empty__icon">⏳</div>
              <h4>Loading exercise library</h4>
              <p>Pulling your exercise catalog now. This will only take a moment.</p>
            </div>

            <div v-else-if="loadingPlanner" class="builder-empty planner-empty planner-empty--loading" aria-live="polite">
              <div class="planner-empty__icon">📦</div>
              <h4>Loading saved planner</h4>
              <p>Fetching your saved workout schedule from your profile settings.</p>
            </div>

            <div v-else-if="workoutExercises.length === 0" class="builder-empty planner-empty" aria-live="polite">
              <div class="planner-empty__icon">🗓️</div>
              <h4>No exercises added yet</h4>
              <p>Start building your workout schedule by adding your first exercise.</p>
              <button type="button" class="btn-add-exercise btn-add-exercise--empty" @click="openPicker">
                <span class="btn-add-exercise__icon">＋</span>
                <span>Add Exercise</span>
              </button>
            </div>

            <div v-else class="planner-content">
              <section
                v-for="group in plannerGroupsWithExercises"
                :key="group.name"
                class="planner-group-card"
              >
                <header class="planner-group-card__head">
                  <div>
                    <h4>{{ group.name }}</h4>
                    <p>{{ group.exercises.length }} exercise{{ group.exercises.length === 1 ? '' : 's' }}</p>
                  </div>
                  <button
                    v-if="group.name !== (scheduleMode === 'week' ? 'Week 1' : 'Any Day')"
                    type="button"
                    class="planner-remove-group"
                    @click="removeScheduleGroup(group.name)"
                  >
                    Remove {{ scheduleMode === 'week' ? 'Week' : 'Day' }}
                  </button>
                </header>

                <div v-if="group.exercises.length === 0" class="planner-group-empty">
                  No exercises assigned yet. Use Add Exercise or move an exercise into {{ group.name }}.
                </div>

                <WorkoutExerciseBlock
                  v-for="entry in group.exercises"
                  :key="entry.exercise.id"
                  :exercise="entry.exercise"
                  :index="entry.index"
                  :total="workoutExercises.length"
                  :schedule-groups="activeGroups"
                  :schedule-mode="scheduleMode"
                  @update-field="updateExerciseField"
                  @remove="removeExercise"
                  @move-up="moveExerciseUp"
                  @move-down="moveExerciseDown"
                />
              </section>
            </div>
          </div>
        </transition>
      </section>

      <footer class="builder-footer">
        <p v-if="saveMessage" :class="['save-message', saveMessage.includes('success') ? 'ok' : 'err']">
          {{ saveMessage }}
        </p>
        <button type="button" class="btn-save" :disabled="saving" @click="saveWorkout">
          {{ saving ? 'Saving...' : 'Save Workout' }}
        </button>
      </footer>
    </div>

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
  display: block;
}

.workout-builder-canvas {
  display: grid;
  gap: 16px;
}

.builder-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.builder-hero h2 {
  margin: 0;
  font-size: 1.28rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.builder-hero p {
  margin: 8px 0 0;
  color: #cbd5e1;
  font-size: 0.92rem;
}

.builder-hero__stats {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.builder-hero__stats div {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 10px 10px;
  display: grid;
  gap: 4px;
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
  background: #ffffff;
  border: 1px solid #e5ecf5;
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
}

.collapsible-panel {
  padding: 16px;
}

.collapsible-header {
  width: 100%;
  border: 1px solid #e6ebf3;
  background: #f8fafc;
  border-radius: 14px;
  padding: 14px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.collapsible-header:hover {
  background: #f1f5f9;
  border-color: #dbe4ef;
}

.collapsible-header__text {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.collapsible-header__text strong {
  color: #0f172a;
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: -0.012em;
}

.collapsible-header__text small {
  color: #64748b;
  font-size: 0.84rem;
}

.collapsible-header__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #e2e8f0;
  color: #1e293b;
  flex: 0 0 auto;
  transition: transform 0.2s ease;
}

.collapsible-header__icon.open {
  transform: rotate(180deg);
}

.collapsible-panel__body {
  margin-top: 20px;
}

.panel-collapse-enter-active,
.panel-collapse-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.panel-collapse-enter-from,
.panel-collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.planner-section {
  border: 1px solid #dfe7f2;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
  padding: 16px;
}

.planner-panel-head {
  cursor: pointer;
  margin-bottom: 0;
  border: 1px solid #e5ebf4;
  border-radius: 14px;
  padding: 14px;
  background: #f8fafc;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.planner-panel-head:hover {
  background: #f1f5f9;
  border-color: #dbe4ef;
}

.planner-head-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.planner-heading-group {
  min-width: 0;
}

.planner-heading-group h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.planner-heading-group p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.85rem;
}

.planner-unlock-hint {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #fde68a;
  background: #fffbe6;
  color: #854d0e;
  display: grid;
  gap: 4px;
}

.planner-unlock-hint strong {
  font-size: 0.88rem;
}

.planner-unlock-hint span {
  font-size: 0.8rem;
}

.planner-tools {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.planner-mode-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid #dbe4ef;
  border-radius: 12px;
  background: #f8fafc;
  padding: 4px;
  gap: 6px;
}

.planner-mode-btn {
  border: none;
  background: transparent;
  color: #334155;
  border-radius: 9px;
  min-height: 40px;
  padding: 8px 10px;
  font-weight: 700;
  font-size: 0.88rem;
}

.planner-mode-btn.active {
  background: #dbeafe;
  color: #1d4ed8;
}

.planner-group-editor {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.planner-feedback {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
}

.planner-feedback--error {
  color: #b91c1c;
}

.planner-group-editor input {
  border: 1px solid #d6dee9;
  border-radius: 12px;
  min-height: 46px;
  padding: 11px 12px;
  background: #f8fafc;
}

.planner-group-add {
  border: 1px solid #1d4ed8;
  border-radius: 12px;
  min-height: 46px;
  padding: 0 14px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
}

.planner-primary-actions {
  display: grid;
  margin-top: 2px;
}

.builder-section__head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1.02rem;
}

.builder-section__head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.86rem;
}

.builder-section__head--inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.btn-add-exercise {
  width: 100%;
  border: 1px solid #10b981;
  border-radius: 12px;
  background: #059669;
  color: #fff;
  font-weight: 700;
  padding: 12px 16px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 8px 18px rgba(5, 150, 105, 0.2);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.btn-add-exercise:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(5, 150, 105, 0.28);
}

.btn-add-exercise__icon {
  font-size: 1rem;
  line-height: 1;
}

.builder-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  color: #64748b;
}

.planner-empty {
  border: 1px solid #dce5f3;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fbff 0%, #f7fafc 100%);
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 18px;
  min-height: 180px;
}

.planner-empty--loading {
  border-color: #cbd5e1;
}

.planner-empty__icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #e2e8f0;
  font-size: 1.35rem;
}

.planner-empty h4 {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 1.02rem;
}

.planner-empty p {
  margin: 0;
  max-width: 420px;
  color: #64748b;
  font-size: 0.92rem;
}

.btn-add-exercise--empty {
  margin-top: 8px;
  width: 100%;
  max-width: 260px;
}

.planner-content {
  display: grid;
  gap: 12px;
}

.planner-group-card {
  border: 1px solid #d6e0ee;
  border-radius: 14px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
}

.planner-group-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.planner-group-card__head h4 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
}

.planner-group-card__head p {
  margin: 2px 0 0;
  color: #64748b;
  font-size: 0.84rem;
}

.planner-remove-group {
  border: 1px solid #fecaca;
  border-radius: 10px;
  min-height: 36px;
  padding: 0 10px;
  background: #fff1f2;
  color: #b91c1c;
  font-weight: 600;
}

.planner-group-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  color: #64748b;
  font-size: 0.88rem;
  background: #f8fafc;
}

.builder-footer {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e8edf4;
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
}

.save-message {
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
}

.save-message.ok {
  color: #166534;
}

.save-message.err {
  color: #b91c1c;
}

.btn-save {
  width: 100%;
  border: none;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
  padding: 12px 18px;
  min-height: 48px;
}

.btn-save:disabled {
  opacity: 0.55;
}

@media (min-width: 640px) {
  .workout-builder-canvas { gap: 16px; }

  .builder-hero {
    padding: 20px;
  }

  .builder-section,
  .planner-section,
  .collapsible-panel {
    padding: 20px;
  }

  .planner-group-editor {
    grid-template-columns: 1fr auto;
  }

  .planner-group-add {
    min-width: 132px;
  }

  .planner-primary-actions {
    justify-content: flex-end;
  }

  .btn-add-exercise {
    width: auto;
    min-width: 180px;
  }

  .builder-footer {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .btn-save {
    width: auto;
    min-width: 180px;
  }
}

@media (min-width: 992px) {
  .workout-builder-canvas { gap: 16px; }

  .builder-hero {
    padding: 22px;
  }

  .builder-section,
  .planner-section,
  .collapsible-panel,
  .builder-footer {
    padding: 24px;
  }

  .planner-content {
    gap: 16px;
  }
}
</style>
