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

onMounted(loadWorkoutLists);
</script>

<template>
  <div class="app-page-shell">
    <div class="app-page-canvas app-inner-shell">
      <div class="dashboard-breadcrumb ff-page-header app-header-gradient mb-0">
        <h2>Workout Log</h2>
        <DateRangePicker />
      </div>

      <section class="workout-hero panel-bg app-section-card">
        <div>
          <h3>Modern Workout Log</h3>
          <p>View workout plans saved from Workout Builder and reopen any plan in edit mode.</p>
        </div>
        <button type="button" class="btn-builder" @click="startBuilder">Open Workout Builder</button>
      </section>

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
            .dashboard-breadcrumb.ff-page-header {
              border: 1px solid var(--border-color);
            }

            .workout-hero {
              border: 1px solid var(--border-color);
              border-radius: 14px;
              padding: 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 14px;
              flex-wrap: wrap;
            }

            .workout-hero h3 {
              margin: 0;
              color: var(--text-color);
            }

            .workout-hero p {
              margin: 4px 0 0;
              color: var(--text-color-secondary);
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
