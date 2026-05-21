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
  padding-top: 0 !important;
  margin-top: 5px;
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}

/* Global compact mode helper */
.dashboard-mobile-compact {
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

/* Ultra-compact mode for densest mobile layouts */
.dashboard-mobile-ultra-compact {
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  gap: 8px;
  padding: 8px;
  margin-bottom: 8px;
}

/* Dense mode — removes leftover whitespace */
.dashboard-mobile-dense {
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  gap: 6px;
  padding: 6px;
  margin-bottom: 6px;
}

.dashboard-canvas {
  display: grid;
  gap: 16px;
  padding-block: 4px !important;
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
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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

/* ─────────────────────────────────────────────────────────────────── */
/* MOBILE (≤ 768px) — stack header, tighten gaps, compact cards        */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 768px) {
  .dashboard-canvas {
    gap: 5px;
  }

  /* Hero: 2-column grid — title left, date picker right */
  .header-content {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    flex-wrap: unset;
    flex-direction: unset;
  }

  .dashboard-header h2 {
    margin: 0;
    font-size: 0.95rem;
    white-space: normal;
    line-height: 1.25;
  }

  .header-picker {
    width: auto;
    min-width: 150px;
    max-width: 185px;
    overflow: hidden;
    box-sizing: border-box;
    margin-top: 0;
    flex-shrink: 0;
  }

  /* date picker compact */
  .header-picker :deep(.full-datepicker) {
    font-size: 0.73rem;
    min-width: 0 !important;
    width: 100% !important;
    max-width: 185px !important;
  }

  .dashboard-focus-card {
    padding: 5px 8px;
    margin-bottom: 0;
    border-radius: 10px;
  }

  .dashboard-focus-card h3 {
    font-size: 0.88rem;
    margin-bottom: 1px;
  }

  .dashboard-focus-card p {
    font-size: 0.77rem;
    margin-top: 0;
  }

  .dashboard-stats {
    gap: 5px;
  }

  .panel-header {
    padding: 6px 8px;
  }

  .panel-header h5 {
    font-size: 0.86rem;
  }

  .panel-body {
    padding: 6px 8px;
  }

  .dashboard-main-row {
    gap: 5px;
    margin-top: 0;
  }

  .stat-card :deep(.metric-card) {
    min-height: unset;
    padding: 5px 6px;
  }

  .stat-card :deep(.metric-card__right i) {
    width: 19px;
    height: 19px;
    border-radius: 4px;
    font-size: 0.62rem;
    margin-right: 1px;
  }

  .activity-row {
    flex-wrap: wrap;
    padding: 6px 8px;
    gap: 6px;
  }

  .activity-row .time {
    min-width: 46px;
    font-size: 0.67rem;
  }

  /* Training progress: compact week/month/year buttons */
  .panel-body :deep(.btn-box) {
    display: flex;
    gap: 4px;
  }

  .panel-body :deep(.btn-box .btn) {
    height: 26px;
    padding: 1px 7px;
    font-size: 0.7rem;
    line-height: 1.2;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* SMALL MOBILE (≤ 640px) — compact cards, 2-col stats, full picker   */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 640px) {
  .dashboard-header h2 {
    font-size: 0.95rem;
  }

  .header-picker {
    width: 100%;
  }

  .dashboard-focus-card {
    padding: 5px 7px;
  }

  .panel-header {
    padding: 5px 7px;
  }

  .panel-body {
    padding: 5px 7px;
  }

  .activity-row {
    padding: 5px 7px;
    gap: 6px;
  }

  .activity-row .time {
    min-width: 46px;
    font-size: 0.66rem;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* TINY MOBILE (≤ 480px) — single column stats, minimal padding        */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 480px) {
  .dashboard-canvas {
    gap: 3px;
  }

  .dashboard-header h2 {
    font-size: 0.88rem;
  }

  .dashboard-focus-card {
    padding: 5px 7px;
    border-radius: 8px;
  }

  .panel-body,
  .panel-header {
    padding: 5px 7px;
  }

  .dashboard-panel {
    border-radius: 8px;
  }

  .stat-card :deep(.metric-card) {
    padding: 5px 6px;
  }

  .stat-card :deep(.metric-card__right i) {
    width: 17px;
    height: 17px;
    font-size: 0.58rem;
  }

  .panel-body :deep(.btn-box .btn) {
    height: 24px;
    padding: 1px 5px;
    font-size: 0.66rem;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* 430px — iPhone Pro Max natural width                                */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 430px) {
  .dashboard-canvas {
    gap: 3px;
  }

  .header-content {
    padding: 6px 8px;
    gap: 8px;
  }

  .header-picker {
    min-width: 140px;
    max-width: 165px;
  }

  .dashboard-header h2 {
    font-size: 0.83rem;
    margin-bottom: 0;
  }

  .dashboard-focus-card {
    padding: 4px 6px;
  }

  .dashboard-focus-card h3 {
    font-size: 0.8rem;
    margin-bottom: 0;
  }

  .dashboard-focus-card p {
    font-size: 0.7rem;
    margin-top: 0;
  }

  .panel-header {
    padding: 4px 6px;
  }

  .panel-body {
    padding: 4px 6px;
  }

  .dashboard-stats {
    gap: 3px;
  }

  .stat-card :deep(.metric-card) {
    padding: 4px 5px;
  }

  .stat-card :deep(.metric-card__right i) {
    width: 16px;
    height: 16px;
    font-size: 0.55rem;
  }

  .panel-body :deep(.btn-box .btn) {
    height: 23px;
    padding: 1px 4px;
    font-size: 0.63rem;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* 390px — iPhone 14/15 natural width                                  */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 390px) {
  .dashboard-canvas {
    gap: 2px;
  }

  .header-content {
    padding: 5px 7px;
    gap: 7px;
  }

  .header-picker {
    min-width: 130px;
    max-width: 155px;
  }

  .dashboard-header h2 {
    font-size: 0.79rem;
    margin-bottom: 0;
  }

  .dashboard-focus-card {
    padding: 3px 5px;
  }

  .dashboard-focus-card h3 {
    font-size: 0.77rem;
    margin-bottom: 0;
  }

  .dashboard-focus-card p {
    font-size: 0.66rem;
    margin-top: 0;
  }

  .panel-header,
  .panel-body {
    padding: 3px 5px;
  }

  .dashboard-stats {
    gap: 2px;
  }

  .stat-card :deep(.metric-card) {
    padding: 3px 4px;
  }

  .stat-card :deep(.metric-card__right i) {
    width: 15px;
    height: 15px;
    font-size: 0.52rem;
  }

  .panel-body :deep(.btn-box .btn) {
    height: 21px;
    padding: 0px 4px;
    font-size: 0.6rem;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* <360px — very narrow: stack hero vertically                         */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 360px) {
  .header-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 5px 7px;
  }

  .header-picker {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .header-picker :deep(.full-datepicker) {
    max-width: 100% !important;
    width: 100% !important;
  }
}
</style>
