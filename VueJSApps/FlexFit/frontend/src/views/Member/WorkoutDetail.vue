<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { API_BASE } from '@/config/env';
import ExerciseSessionCard from '@/components/workout-session/ExerciseSessionCard.vue';

const route  = useRoute();
const router = useRouter();

const planId = computed(() => String(route.params?.planId || '').trim());

const loading     = ref(false);
const saving      = ref(false);
const saveMessage = ref('');
const saveError   = ref('');
const plan        = ref(null);
const sessionStarted = ref(false);

// Array of exercises enriched with live `sessionSets`
const sessionExercises = ref([]);

/* ─── Derived ────────────────────────────────────────────────────────────── */

const scheduleMode = computed(() => plan.value?.scheduleMode || 'day');

const groups = computed(() => {
  if (scheduleMode.value === 'week') {
    return Array.isArray(plan.value?.weekGroups) && plan.value.weekGroups.length
      ? plan.value.weekGroups
      : ['Week 1'];
  }
  return Array.isArray(plan.value?.dayGroups) && plan.value.dayGroups.length
    ? plan.value.dayGroups
    : ['Any Day'];
});

const exercisesByGroup = computed(() =>
  groups.value
    .map((group) => ({
      name: group,
      exercises: sessionExercises.value.filter(
        (ex) => (ex.scheduleGroup || groups.value[0]) === group,
      ),
    }))
    .filter((g) => g.exercises.length > 0),
);

const totalCompleted = computed(() =>
  sessionExercises.value.reduce(
    (acc, ex) => acc + ex.sessionSets.filter((s) => s.done).length,
    0,
  ),
);

const totalSets = computed(() =>
  sessionExercises.value.reduce((acc, ex) => acc + ex.sessionSets.length, 0),
);

const progressPct = computed(() =>
  totalSets.value === 0 ? 0 : Math.round((totalCompleted.value / totalSets.value) * 100),
);

const isCardio = (exercise) =>
  String(exercise.workoutType || '').toLowerCase() === 'cardio' ||
  (Number(exercise.duration || 0) > 0 && Number(exercise.reps || 0) === 0);

/* ─── Set helpers ────────────────────────────────────────────────────────── */

const buildInitialSets = (exercise) => {
  const count = Math.max(Number(exercise.sets || 1), 1);
  return Array.from({ length: count }, (_, i) => ({
    setNum: i + 1,
    weight:   Number(exercise.weight   || 0),
    reps:     Number(exercise.reps     || 0),
    duration: Number(exercise.duration || 0),
    done:     false,
  }));
};

const addSet = (exerciseId) => {
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex) return;
  const last = ex.sessionSets[ex.sessionSets.length - 1] || { weight: 0, reps: 0, duration: 0 };
  ex.sessionSets.push({
    setNum:   ex.sessionSets.length + 1,
    weight:   last.weight,
    reps:     last.reps,
    duration: last.duration,
    done:     false,
  });
};

const removeSet = (exerciseId, setIndex) => {
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex || ex.sessionSets.length <= 1) return;
  ex.sessionSets.splice(setIndex, 1);
  ex.sessionSets.forEach((s, i) => { s.setNum = i + 1; });
};

const updateSet = (exerciseId, setIndex, field, value) => {
  const ex = sessionExercises.value.find((e) => e.id === exerciseId);
  if (!ex) return;
  ex.sessionSets[setIndex][field] =
    field === 'done' ? Boolean(value) : (Number(value) || 0);
};

/* ─── Load ───────────────────────────────────────────────────────────────── */

const loadPlan = async () => {
  loading.value   = true;
  saveError.value = '';

  try {
    const query = planId.value ? `?planId=${encodeURIComponent(planId.value)}` : '';
    const res   = await fetch(`${API_BASE}/api/workout-planner${query}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load workout plan.');

    const data = await res.json();
    plan.value  = data?.planner || null;

    sessionExercises.value = (plan.value?.exercises || []).map((ex) => ({
      ...ex,
      sessionSets: buildInitialSets(ex),
    }));
  } catch (err) {
    saveError.value = err?.message || 'Failed to load workout.';
  } finally {
    loading.value = false;
  }
};

/* ─── Save ───────────────────────────────────────────────────────────────── */

const today = () => new Date().toISOString().split('T')[0];

const saveProgress = async () => {
  saving.value      = true;
  saveMessage.value = '';
  saveError.value   = '';

  try {
    // 1 ── Log completed sets to workout_log
    const sessionPayload = {
      planId:      planId.value,
      planName:    plan.value?.metadata?.name || '',
      workoutDate: today(),
      exercises:   sessionExercises.value.map((ex) => ({
        exerciseId:  ex.exerciseId,
        name:        ex.name,
        workoutType: ex.workoutType || 'Strength',
        sets:        ex.sessionSets,
      })),
    };

    const logRes = await fetch(`${API_BASE}/api/workout-log/session`, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(sessionPayload),
      credentials: 'include',
    });

    if (!logRes.ok) {
      const errBody = await logRes.json().catch(() => ({}));
      throw new Error(errBody?.error || 'Failed to save session log.');
    }

    // 2 ── Update plan defaults with average of completed sets
    const updatedExercises = sessionExercises.value.map((ex) => {
      const done = ex.sessionSets.filter((s) => s.done);
      if (done.length === 0) return ex;
      const avg = (arr, key) => Math.round(arr.reduce((a, s) => a + Number(s[key] || 0), 0) / arr.length);
      return {
        ...ex,
        sets:     done.length,
        weight:   avg(done, 'weight'),
        reps:     avg(done, 'reps'),
        duration: avg(done, 'duration'),
      };
    });

    await fetch(`${API_BASE}/api/workout-planner`, {
      method:      'PUT',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ planner: { ...plan.value, exercises: updatedExercises } }),
      credentials: 'include',
    });

    saveMessage.value = '✓ Progress saved!';
  } catch (err) {
    saveError.value = err?.message || 'Failed to save progress.';
  } finally {
    saving.value = false;
  }
};

/* ─── Navigation ─────────────────────────────────────────────────────────── */

const goBack        = () => router.push({ name: 'workouts' });
const openInBuilder = () =>
  router.push({ name: 'workout_builder', query: { planId: planId.value } });

/* ─── Lifecycle ──────────────────────────────────────────────────────────── */
onMounted(loadPlan);
</script>

<template>
  <div class="app-page-shell workout-detail-page">
    <div class="app-page-canvas app-inner-shell">

      <!-- ══ Loading ═══════════════════════════════════════════════════════ -->
      <div v-if="loading" class="wd-loading">
        <p>Loading workout…</p>
      </div>

      <!-- ══ Error ══════════════════════════════════════════════════════════ -->
      <div v-else-if="saveError && !plan" class="wd-error">
        <p>{{ saveError }}</p>
        <button type="button" class="wd-btn-primary" @click="loadPlan">Retry</button>
      </div>

      <!-- ══ Main ═══════════════════════════════════════════════════════════ -->
      <template v-else-if="plan">

        <!-- ── Hero header ────────────────────────────────────────────────── -->
        <section class="wd-hero ff-page-header app-header-gradient">
          <div class="wd-hero__back">
            <button type="button" class="wd-back-btn" @click="goBack">
              <i class="fa-solid fa-arrow-left"></i> Workouts
            </button>
          </div>

          <div class="wd-hero__body">
            <div class="wd-hero__text">
              <h2>{{ plan.metadata?.name || 'Workout Session' }}</h2>
              <p v-if="plan.metadata?.description">{{ plan.metadata.description }}</p>
            </div>

            <div class="wd-hero__stats">
              <div class="wd-stat">
                <strong>{{ sessionExercises.length }}</strong>
                <span>Exercises</span>
              </div>
              <div class="wd-stat">
                <strong>{{ plan.metadata?.estimatedDuration || 0 }}</strong>
                <span>Min</span>
              </div>
              <div class="wd-stat">
                <strong>{{ plan.metadata?.type || 'Strength' }}</strong>
                <span>Type</span>
              </div>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="wd-hero__progress">
            <div class="wd-progress-bar">
              <div class="wd-progress-fill" :style="{ width: progressPct + '%' }"></div>
            </div>
            <span class="wd-progress-label">
              {{ totalCompleted }} / {{ totalSets }} sets completed ({{ progressPct }}%)
            </span>
          </div>

          <div class="wd-hero__actions">
            <button
              v-if="!sessionStarted"
              type="button"
              class="wd-btn-start"
              @click="sessionStarted = true"
            >
              <i class="fa-solid fa-play"></i> Start Workout
            </button>
            <button
              v-else
              type="button"
              class="wd-btn-save"
              :disabled="saving"
              @click="saveProgress"
            >
              <i class="fa-solid fa-floppy-disk"></i>
              {{ saving ? 'Saving…' : 'Save Progress' }}
            </button>
            <button type="button" class="wd-btn-edit" @click="openInBuilder">
              <i class="fa-solid fa-pencil"></i> Edit Plan
            </button>
          </div>

          <!-- Save feedback -->
          <p v-if="saveMessage" class="wd-save-ok">{{ saveMessage }}</p>
          <p v-if="saveError && plan"  class="wd-save-err">{{ saveError }}</p>
        </section>

        <!-- ── Empty plan ─────────────────────────────────────────────────── -->
        <section
          v-if="sessionExercises.length === 0"
          class="wd-empty app-section-card"
        >
          <p>No exercises in this plan yet.</p>
          <button type="button" class="wd-btn-primary" @click="openInBuilder">
            Add Exercises in Builder
          </button>
        </section>

        <!-- ── Exercise groups ────────────────────────────────────────────── -->
        <template v-else>
          <section
            v-for="group in exercisesByGroup"
            :key="group.name"
            class="wd-group app-section-card"
          >
            <!-- Only show group header if there are multiple groups -->
            <header
              v-if="exercisesByGroup.length > 1"
              class="wd-group-header"
            >
              <i
                :class="scheduleMode === 'week' ? 'fa-solid fa-calendar-week' : 'fa-solid fa-calendar-day'"
              ></i>
              <h4>{{ group.name }}</h4>
              <span class="wd-group-count">{{ group.exercises.length }} exercise{{ group.exercises.length !== 1 ? 's' : '' }}</span>
            </header>

            <div class="wd-exercise-list">
              <ExerciseSessionCard
                v-for="exercise in group.exercises"
                :key="exercise.id"
                :exercise="exercise"
                :is-cardio="isCardio(exercise)"
                @add-set="addSet"
                @remove-set="removeSet"
                @update-set="updateSet"
              />
            </div>
          </section>
        </template>

        <!-- ── Bottom save bar ────────────────────────────────────────────── -->
        <div v-if="sessionStarted && sessionExercises.length > 0" class="wd-bottom-bar">
          <div class="wd-bottom-bar__inner">
            <span class="wd-bottom-bar__label">
              {{ totalCompleted }} / {{ totalSets }} sets done
            </span>
            <button
              type="button"
              class="wd-btn-save"
              :disabled="saving"
              @click="saveProgress"
            >
              <i class="fa-solid fa-floppy-disk"></i>
              {{ saving ? 'Saving…' : 'Save Progress' }}
            </button>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<style scoped>
/* ─── Page shell ──────────────────────────────────────────────────────────── */
.workout-detail-page {
  padding-bottom: 100px; /* space for sticky bottom bar */
}

/* ─── Loading / Error ─────────────────────────────────────────────────────── */
.wd-loading,
.wd-error {
  padding: 48px 24px;
  text-align: center;
  color: var(--text-color-secondary, #6b7280);
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */
.wd-hero {
  border-radius: 16px;
  padding: 20px;
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

.wd-hero__back {
  display: flex;
}

.wd-back-btn {
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease;
}

.wd-back-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.wd-hero__body {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
}

.wd-hero__text h2 {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
}

.wd-hero__text p {
  margin: 4px 0 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.88rem;
}

.wd-hero__stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.wd-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 56px;
}

.wd-stat strong {
  color: #fff;
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1;
}

.wd-stat span {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  margin-top: 3px;
}

/* ─── Progress bar ────────────────────────────────────────────────────────── */
.wd-hero__progress {
  display: grid;
  gap: 6px;
}

.wd-progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  overflow: hidden;
}

.wd-progress-fill {
  height: 100%;
  background: #86efac;
  border-radius: 999px;
  transition: width 0.35s ease;
}

.wd-progress-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.78rem;
}

/* ─── Hero actions ────────────────────────────────────────────────────────── */
.wd-hero__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.wd-btn-start {
  background: #fff;
  border: none;
  color: #1d4ed8;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  transition: background 0.15s ease;
}

.wd-btn-start:hover {
  background: #eff6ff;
}

.wd-btn-save {
  background: #22c55e;
  border: none;
  color: #fff;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  transition: background 0.15s ease;
}

.wd-btn-save:hover:not(:disabled) {
  background: #16a34a;
}

.wd-btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wd-btn-edit {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  transition: background 0.15s ease;
}

.wd-btn-edit:hover {
  background: rgba(255, 255, 255, 0.25);
}

.wd-btn-primary {
  background: #2563eb;
  border: none;
  color: #fff;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.wd-save-ok {
  color: #86efac;
  font-size: 0.85rem;
  font-weight: 700;
  margin: 0;
}

.wd-save-err {
  color: #fca5a5;
  font-size: 0.85rem;
  margin: 0;
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */
.wd-empty {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  padding: 32px 20px;
  text-align: center;
  display: grid;
  gap: 14px;
  justify-items: center;
  color: var(--text-color-secondary, #6b7280);
}

/* ─── Groups ──────────────────────────────────────────────────────────────── */
.wd-group {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
  display: grid;
  gap: 14px;
}

.wd-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}

.wd-group-header i {
  color: #3b82f6;
  font-size: 1rem;
}

.wd-group-header h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-color, #111827);
  flex: 1;
}

.wd-group-count {
  font-size: 0.75rem;
  color: var(--text-color-secondary, #9ca3af);
  background: #f3f4f6;
  border-radius: 999px;
  padding: 2px 10px;
}

/* ─── Exercise list ───────────────────────────────────────────────────────── */
.wd-exercise-list {
  display: grid;
  gap: 12px;
}

/* ─── Sticky bottom save bar ──────────────────────────────────────────────── */
.wd-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--border-color, #e5e7eb);
  backdrop-filter: blur(8px);
  padding: 12px 16px;
}

.wd-bottom-bar__inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wd-bottom-bar__label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-color, #111827);
}

/* ─── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .wd-hero__body {
    flex-direction: column;
  }

  .wd-hero__stats {
    justify-content: space-around;
    width: 100%;
  }

  .wd-hero__actions {
    flex-direction: column;
  }

  .wd-btn-start,
  .wd-btn-save,
  .wd-btn-edit {
    width: 100%;
    justify-content: center;
  }
}
</style>
