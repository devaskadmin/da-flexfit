<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { API_BASE } from '@/config/env'
import DateRangePicker from '@/components/template/DateRangePicker.vue';
import FitnessMetricCard from '@/components/fitness/FitnessMetricCard.vue';
import ProgressChart from '@/components/Widgets/ProgressChart.vue';
import NutritionLogChart from '@/components/Widgets/NutritionLogChart.vue';

const firstName = ref('')

onMounted(async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/user-profile-settings`, { withCredentials: true })
    const profile = res.data?.profile || {}
    firstName.value = profile.firstName || ''
  } catch {
    // silently fail — greeting just shows without a name
  }
})

const metrics = [
  {
    title: 'Workouts This Week',
    value: 5,
    subtitle: 'Target: 6 sessions',
    trend: '+1 vs last week',
    icon: 'fa-solid fa-dumbbell',
  },
  {
    title: 'Current Streak',
    value: '12 days',
    subtitle: 'Consistency is improving',
    trend: '+3 days',
    icon: 'fa-solid fa-fire',
  },
  {
    title: 'Calories Burned',
    value: '2,430',
    subtitle: 'This week total',
    trend: '+8%',
    icon: 'fa-solid fa-bolt',
  },
  {
    title: 'Protein Today',
    value: '148g',
    subtitle: 'Goal: 170g',
    trend: '87% of goal',
    icon: 'fa-solid fa-drumstick-bite',
  },
];

const recentActivity = [
  { time: '07:10 AM', action: 'Logged breakfast', detail: 'Greek yogurt + berries' },
  { time: '11:30 AM', action: 'Completed workout', detail: 'Upper Body Strength (55 min)' },
  { time: '02:15 PM', action: 'Hydration update', detail: '2.1L total water intake' },
  { time: '06:40 PM', action: 'Added dinner', detail: 'Salmon bowl with rice' },
];
</script>

<template>
  <div class="app-page-shell dashboard-container">
    <div class="app-page-canvas app-inner-shell dashboard-canvas">
      <!-- Welcome Header Card -->
      <section class="dashboard-header ff-page-header app-header-gradient">
        <div class="header-content">
          <div>
            <h2>Welcome back<template v-if="firstName">, {{ firstName }}</template>!</h2>
          </div>
          <div class="header-picker">
            <DateRangePicker />
          </div>
        </div>
      </section>

      <!-- Focus Card -->
      <section class="dashboard-focus-card">
        <h3>Today's focus: progressive overload + nutrition consistency</h3>
        <p>Prioritize one quality strength session and hit your protein target.</p>
      </section>

      <!-- Stats Cards Section -->
      <section class="dashboard-stats">
        <div v-for="metric in metrics" :key="metric.title" class="stat-card">
          <FitnessMetricCard
            :title="metric.title"
            :value="metric.value"
            :subtitle="metric.subtitle"
            :trend="metric.trend"
            :icon="metric.icon"
          />
        </div>
      </section>

      <!-- Training Progress + Activity Feed -->
      <section class="dashboard-main-row">
        <div class="training-progress-section">
          <div class="panel panel-bg dashboard-panel">
            <div class="panel-header"><h5>Training Progress</h5></div>
            <div class="panel-body"><ProgressChart /></div>
          </div>
        </div>
        <div class="activity-feed-section">
          <div class="panel panel-bg dashboard-panel">
            <div class="panel-header"><h5>Activity Feed</h5></div>
            <div class="panel-body activity-feed">
              <article v-for="item in recentActivity" :key="item.time + item.action" class="activity-row">
                <span class="time">{{ item.time }}</span>
                <div>
                  <strong>{{ item.action }}</strong>
                  <p>{{ item.detail }}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <!-- Nutrition Trend -->
      <section class="dashboard-nutrition">
        <div class="panel panel-bg dashboard-panel">
          <div class="panel-header"><h5>Nutrition Trend</h5></div>
          <div class="panel-body"><NutritionLogChart /></div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ─────────────────────────────────────────────────────────────────── */
/* MOBILE-FIRST CONSTRAINED DASHBOARD LAYOUT                          */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-container {
  display: block;
}

.dashboard-canvas {
  display: grid;
  gap: 16px;
}

/* ─────────────────────────────────────────────────────────────────── */
/* HEADER WELCOME CARD                                                 */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-header {
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.015em;
}

.header-picker {
  margin-top: 2px;
}

/* ─────────────────────────────────────────────────────────────────── */
/* FOCUS GUIDANCE CARD                                                 */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-focus-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px 20px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.dashboard-focus-card h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.012em;
}

.dashboard-focus-card p {
  margin: 8px 0 0;
  color: var(--text-color-secondary);
  font-size: 0.93rem;
}

/* ─────────────────────────────────────────────────────────────────── */
/* STATS CARDS: MOBILE-FIRST STACKING                                  */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.stat-card {
  width: 100%;
  display: flex;
}

.stat-card :deep(.metric-card) {
  width: 100%;
  height: 100%;
}

/* ─────────────────────────────────────────────────────────────────── */
/* MAIN ROW: TRAINING + ACTIVITY (stacked mobile, side-by-side desktop) */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-main-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.training-progress-section,
.activity-feed-section {
  width: 100%;
}

/* ─────────────────────────────────────────────────────────────────── */
/* NUTRITION SECTION                                                   */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-nutrition {
  width: 100%;
}

/* ─────────────────────────────────────────────────────────────────── */
/* CARD STYLES                                                         */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-panel {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.panel-header {
  padding: 16px 18px;
  border-bottom: 1px solid #f1f5f9;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.03);
}

.panel-header h5 {
  margin: 0;
  color: var(--text-color);
  font-size: 1rem;
  font-weight: 800;
}

.panel-body {
  padding: 16px 18px;
}

/* ─────────────────────────────────────────────────────────────────── */
/* ACTIVITY FEED                                                       */
/* ─────────────────────────────────────────────────────────────────── */

.activity-feed {
  display: grid;
  gap: 12px;
}

.activity-row {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  gap: 12px;
  background: #ffffff;
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.03);
}

.activity-row .time {
  color: #a5b4fc;
  min-width: 70px;
  font-size: 0.78rem;
  font-weight: 700;
}

.activity-row strong {
  color: var(--text-color);
  font-size: 0.88rem;
}

.activity-row p {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
}

/* ─────────────────────────────────────────────────────────────────── */
/* TABLET BREAKPOINT (768px+)                                          */
/* ─────────────────────────────────────────────────────────────────── */

@media (min-width: 768px) {
  .dashboard-canvas {
    gap: 16px;
    padding: 0;
  }

  .dashboard-header {
    padding: 20px;
  }

  .dashboard-focus-card,
  .panel-body {
    padding: 20px;
  }

  .panel-header {
    padding: 16px 20px;
  }

  .dashboard-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }

  .dashboard-main-row {
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* DESKTOP BREAKPOINT (1024px+)                                        */
/* ─────────────────────────────────────────────────────────────────── */

@media (min-width: 1024px) {
  .dashboard-canvas {
    gap: 16px;
    padding: 0;
  }

  .dashboard-header {
    padding: 22px;
  }

  .dashboard-focus-card {
    padding: 22px;
  }

  .dashboard-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }

  .dashboard-main-row {
    grid-template-columns: 1.5fr 1fr;
    gap: 28px;
  }

  .panel-body {
    padding: 24px;
  }

  .panel-header {
    padding: 18px 24px;
  }

  .activity-feed {
    gap: 14px;
  }

  .activity-row {
    padding: 14px 16px;
  }
}
</style>
