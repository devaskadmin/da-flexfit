<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DateRangePicker from '@/components/template/DateRangePicker.vue';
import WorkoutCard from '@/components/workout-log/WorkoutCard.vue';
import { API_BASE } from '@/config/env';

const router = useRouter();

const loading = ref(false);
const error = ref('');
const workoutLists = ref([]);
const hasActiveWorkout  = ref(false);
const activeSessionData = ref(null);

const formatUpdatedAt = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
};

const summaryStats = computed(() => {
  if (workoutLists.value.length === 0) {
    return {
      totalPlans: 0,
      totalExercises: 0,
      averageDuration: 0,
    };
  }

  const totalDuration = workoutLists.value.reduce((acc, plan) => acc + Number(plan.estimatedDuration || 0), 0);
  const totalExercises = workoutLists.value.reduce((acc, plan) => acc + Number(plan.exerciseCount || 0), 0);

  return {
    totalPlans: workoutLists.value.length,
    totalExercises,
    averageDuration: Math.round(totalDuration / workoutLists.value.length),
  };
});

const loadWorkoutLists = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch(`${API_BASE}/api/workout-planner`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load workout log.');
    }

    const data = await response.json();
    const incomingLists = Array.isArray(data?.workoutLists) ? data.workoutLists : [];

    workoutLists.value = incomingLists.map((plan) => ({
      ...plan,
      updatedAtLabel: formatUpdatedAt(plan.updatedAt),
    }));
  } catch (err) {
    error.value = err?.message || 'Failed to load workout log.';
    workoutLists.value = [];
  } finally {
    loading.value = false;
  }
};

const openInBuilder = (plan) => {
  const planId = String(plan?.planId || '').trim();
  if (!planId) {
    router.push({ name: 'workout_builder' });
    return;
  }

  router.push({
    name: 'workout_builder',
    query: { planId },
  });
};

const openSession = (plan) => {
  const planId = String(plan?.planId || '').trim();
  if (!planId) return;
  router.push({ name: 'workout_detail', params: { planId } });
};

const startBuilder = () => {
  router.push({ name: 'workout_builder' });
};

const goToInProgress = async () => {
  // If we already have the session data cached, navigate immediately
  if (activeSessionData.value?.workoutPlanId) {
    router.push({
      name:   'workout_detail',
      params: { planId: String(activeSessionData.value.workoutPlanId) },
    });
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/workout-sessions/active`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.session?.workoutPlanId) {
      router.push({
        name:   'workout_detail',
        params: { planId: String(data.session.workoutPlanId) },
      });
    }
  } catch (_) {
    // silently ignore
  }
};

const checkActiveSession = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/workout-sessions/active`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.session) {
      activeSessionData.value = data.session;
      hasActiveWorkout.value  = true;
    } else {
      activeSessionData.value = null;
      hasActiveWorkout.value  = false;
    }
  } catch (_) {
    // silently ignore
  }
};

onMounted(() => {
  loadWorkoutLists();
  checkActiveSession();
});
</script>

<template>
  <div class="app-page-shell">
    <div class="app-page-canvas app-inner-shell">
      <section class="builder-hero ff-page-header app-header-gradient">
        <div class="builder-hero__content">
          <div class="builder-hero__text">
            <h2>Workout Log</h2>
            <p class="builder-hero__subtitle">View workout plans saved from Workout Builder and reopen any plan in edit mode.</p>
          </div>
          <div class="builder-hero__actions">
            <DateRangePicker />
          </div>
        </div>
      </section>

      <div class="workout-log-toolbar">
        <button
          type="button"
          :class="['btn-builder', hasActiveWorkout ? 'btn-builder--active' : 'btn-builder--secondary']"
          @click="goToInProgress"
        >
          <i class="fa-solid fa-clock-rotate-left me-2"></i>Workouts In Progress
        </button>
        <button type="button" class="btn-builder" @click="startBuilder">
          <i class="fa-solid fa-dumbbell me-2"></i>Open Workout Builder
        </button>
      </div>

      <section class="workout-stats row g-3 mt-0" v-if="workoutLists.length > 0">
        <div class="col-md-4">
          <article class="workout-stat-card panel-bg app-section-card">
            <span>Saved Plans</span>
            <strong>{{ summaryStats.totalPlans }}</strong>
          </article>
        </div>
        <div class="col-md-4">
          <article class="workout-stat-card panel-bg app-section-card">
            <span>Average Duration</span>
            <strong>{{ summaryStats.averageDuration }} min</strong>
          </article>
        </div>
        <div class="col-md-4">
          <article class="workout-stat-card panel-bg app-section-card">
            <span>Total Exercises</span>
            <strong>{{ summaryStats.totalExercises }}</strong>
          </article>
        </div>
      </section>

      <section class="panel panel-bg workout-section app-section-card">
        <header class="panel-header">
          <h5>Saved Workout Plans</h5>
        </header>

        <div v-if="loading" class="panel-body workout-empty-state">
          <p>Loading workout plans...</p>
        </div>

        <div v-else-if="error" class="panel-body workout-empty-state">
          <p>{{ error }}</p>
          <button type="button" class="btn-builder" @click="loadWorkoutLists">Retry</button>
        </div>

        <div v-else-if="workoutLists.length === 0" class="panel-body workout-empty-state">
          <h6>No workouts yet</h6>
          <p>Create your first workout in Workout Builder.</p>
          <button type="button" class="btn-builder" @click="startBuilder">Create Workout</button>
        </div>

        <div v-else class="panel-body workout-log-grid">
          <WorkoutCard
            v-for="plan in workoutLists"
            :key="plan.planId"
            :plan="plan"
            @open-session="openSession"
            @open-builder="openInBuilder"
          />
        </div>
      </section>
    </div>
  </div>
</template>

            <style scoped>
            .builder-hero__content {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 16px;
              flex-wrap: wrap;
            }

            .builder-hero__text h2 {
              margin: 0 0 4px;
            }

            .builder-hero__subtitle {
              margin: 0;
              opacity: 0.85;
              font-size: 0.92rem;
            }

            .workout-log-toolbar {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
            }

            .btn-builder--secondary {
              background: #f1f5f9;
              color: #1e40af;
              border: 1px solid #bfdbfe;
            }

            .btn-builder--secondary:hover {
              background: #dbeafe;
            }

            .btn-builder--active {
              background: #22c55e;
              color: #fff;
              border: none;
            }

            .btn-builder--active:hover {
              background: #16a34a;
            }

            .btn-builder {
              border: none;
              border-radius: 10px;
              background: #2563eb;
              color: #fff;
              padding: 10px 14px;
              font-weight: 700;
            }

            .workout-stat-card {
              border: 1px solid var(--border-color);
              border-radius: 12px;
              padding: 14px;
              display: grid;
              gap: 6px;
              box-shadow: none;
            }

            .workout-stat-card span { color: var(--text-color-secondary); font-size: 0.82rem; }
            .workout-stat-card strong { color: var(--text-color); font-size: 1.25rem; }

            .workout-section {
              border: 1px solid var(--border-color);
              border-radius: 12px;
              box-shadow: none;
            }

            .workout-empty-state {
              display: grid;
              gap: 10px;
              justify-items: start;
            }

            .workout-empty-state h6 {
              margin: 0;
              font-size: 1rem;
              color: var(--text-color);
            }

            .workout-empty-state p {
              margin: 0;
              color: var(--text-color-secondary);
            }

            .workout-log-grid {
              display: grid;
              gap: 12px;
            }
            </style>
