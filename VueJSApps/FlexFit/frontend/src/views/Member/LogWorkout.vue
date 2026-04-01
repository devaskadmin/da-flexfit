<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import DateRangePicker from '@/components/template/DateRangePicker.vue';

const router = useRouter();

const workoutTemplates = ref([
  {
    id: 1,
    title: 'Upper Body Strength',
    focus: 'Chest • Shoulders • Triceps',
    duration: 55,
    intensity: 'High',
  },
  {
    id: 2,
    title: 'Lower Body Power',
    focus: 'Quads • Glutes • Hamstrings',
    duration: 60,
    intensity: 'High',
  },
  {
    id: 3,
    title: 'Conditioning Circuit',
    focus: 'Full Body • Cardio',
    duration: 35,
    intensity: 'Moderate',
  },
]);

const recentSessions = ref([
  { id: 11, name: 'Pull Day Volume', date: 'Today', exercises: 7, calories: 420 },
  { id: 12, name: 'Leg Strength Session', date: 'Yesterday', exercises: 8, calories: 510 },
  { id: 13, name: 'Sprint Intervals', date: '2 days ago', exercises: 5, calories: 360 },
]);

const thisWeekStats = computed(() => {
  return {
    sessions: recentSessions.value.length + 1,
    avgDuration: 48,
    calories: recentSessions.value.reduce((sum, item) => sum + item.calories, 0),
  };
});

const startBuilder = () => {
  router.push({ name: 'workout_builder' });
};
</script>

<template>
  <div class="dashboard-breadcrumb ff-page-header mb-25">
    <h2>Workouts</h2>
    <DateRangePicker />
  </div>

  <section class="workout-hero panel-bg">
    <div>
      <h3>Build and run focused sessions</h3>
      <p>Use templates for speed, or open builder for complete control.</p>
    </div>
    <button type="button" class="btn-builder" @click="startBuilder">Open Workout Builder</button>
  </section>

  <section class="workout-stats row g-3 mt-1">
    <div class="col-md-4">
      <article class="workout-stat-card panel-bg">
        <span>Sessions This Week</span>
        <strong>{{ thisWeekStats.sessions }}</strong>
      </article>
    </div>
    <div class="col-md-4">
      <article class="workout-stat-card panel-bg">
        <span>Avg Duration</span>
        <strong>{{ thisWeekStats.avgDuration }} min</strong>
      </article>
    </div>
    <div class="col-md-4">
      <article class="workout-stat-card panel-bg">
        <span>Calories Burned</span>
        <strong>{{ thisWeekStats.calories }}</strong>
      </article>
    </div>
  </section>

  <div class="row g-3 mt-1">
    <div class="col-lg-7">
      <section class="panel panel-bg workout-section">
        <header class="panel-header">
          <h5>Suggested Templates</h5>
        </header>
        <div class="panel-body template-grid">
          <article v-for="template in workoutTemplates" :key="template.id" class="template-card">
            <h6>{{ template.title }}</h6>
            <p>{{ template.focus }}</p>
            <div class="template-meta">
              <span>{{ template.duration }} min</span>
              <span>{{ template.intensity }}</span>
            </div>
            <button type="button" @click="startBuilder">Use Template</button>
          </article>
        </div>
      </section>
    </div>

    <div class="col-lg-5">
      <section class="panel panel-bg workout-section">
        <header class="panel-header">
          <h5>Recent Sessions</h5>
        </header>
        <div class="panel-body recent-list">
          <article v-for="session in recentSessions" :key="session.id" class="recent-item">
            <div>
              <strong>{{ session.name }}</strong>
              <p>{{ session.date }}</p>
            </div>
            <div class="recent-badges">
              <span>{{ session.exercises }} ex</span>
              <span>{{ session.calories }} kcal</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
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
}

.workout-stat-card span { color: var(--text-color-secondary); font-size: 0.82rem; }
.workout-stat-card strong { color: var(--text-color); font-size: 1.25rem; }

.workout-section {
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.template-grid {
  display: grid;
  gap: 10px;
}

.template-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  display: grid;
  gap: 8px;
}

.template-card h6 { margin: 0; color: var(--text-color); }
.template-card p { margin: 0; color: var(--text-color-secondary); font-size: 0.85rem; }

.template-meta { display: flex; gap: 8px; }
.template-meta span {
  font-size: 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  color: var(--text-color-secondary);
  padding: 3px 8px;
}

.template-card button {
  justify-self: start;
  border: 1px solid #3b82f6;
  color: #93c5fd;
  background: transparent;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.78rem;
  font-weight: 700;
}

.recent-list { display: grid; gap: 10px; }

.recent-item {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.recent-item strong { color: var(--text-color); font-size: 0.9rem; }
.recent-item p { margin: 4px 0 0; color: var(--text-color-secondary); font-size: 0.8rem; }

.recent-badges { display: grid; gap: 6px; align-content: center; }
.recent-badges span {
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(79, 70, 229, 0.2);
  color: #a5b4fc;
  font-size: 0.72rem;
}
</style>
