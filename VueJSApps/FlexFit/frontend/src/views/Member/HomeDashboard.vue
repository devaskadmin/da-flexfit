<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE } from '@/config/env'
import DateRangePicker from '@/components/template/DateRangePicker.vue';
import FitnessMetricCard from '@/components/fitness/FitnessMetricCard.vue';
import ProgressChart from '@/components/Widgets/ProgressChart.vue';
import NutritionLogChart from '@/components/Widgets/NutritionLogChart.vue';

const router = useRouter()
const firstName = ref('')
const loadingMetrics = ref(true)
const loadingActivity = ref(true)
const loadingNutritionActivity = ref(true)
const loadingRecentWorkout = ref(true)
const dashboardStartDate = ref(null)
const dashboardEndDate = ref(null)
const dashboardStats = ref({
  userId: null,
  workoutsThisWeek: 0,
  currentStreak: 0,
  caloriesBurned: 0,
  proteinToday: 0,
  weeklyTarget: 0,
  workoutsLastWeek: 0,
  weekDiff: 0,
  weekStart: null,
  weekEnd: null,
  workoutsLoggedChart: [],
  activityFeed: [],
})

const formatActivityDate = (isoDate) => {
  if (!isoDate) return '—'
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatTrend = (value, suffix = '', zeroText = 'No change') => {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}${suffix}`
  if (numeric < 0) return `${numeric}${suffix}`
  return zeroText
}

const fetchDashboardStats = async () => {
  loadingMetrics.value = true
  try {
    const { data } = await axios.get(`${API_BASE}/api/dashboard/metrics`, {
      withCredentials: true,
    })
    dashboardStats.value = {
      userId: data?.userId ?? null,
      workoutsThisWeek: Number(data?.workoutsThisWeek ?? 0),
      currentStreak: Number(data?.currentStreak ?? data?.streak ?? 0),
      caloriesBurned: Number(data?.caloriesBurned ?? 0),
      proteinToday: Number(data?.proteinToday ?? 0),
      weeklyTarget: Number(data?.weeklyTarget ?? 0),
      workoutsLastWeek: Number(data?.workoutsLastWeek ?? 0),
      weekDiff: Number(data?.weekDiff ?? 0),
      weekStart: data?.weekStart || data?.startDate || null,
      weekEnd: data?.weekEnd || data?.endDate || null,
      workoutsLoggedChart: Array.isArray(data?.workoutsLoggedChart) ? data.workoutsLoggedChart : [],
      activityFeed: Array.isArray(data?.activityFeed) ? data.activityFeed : [],
    }
  } catch (err) {
    console.error('Failed to load dashboard stats:', err)
  } finally {
    loadingMetrics.value = false
  }
}

const fetchActivityFeed = async () => {
  loadingActivity.value = true
  try {
    const params = {}
    if (dashboardStartDate.value) params.startDate = dashboardStartDate.value
    if (dashboardEndDate.value) params.endDate = dashboardEndDate.value

    const { data } = await axios.get(`${API_BASE}/api/dashboard/activity`, {
      params,
      withCredentials: true,
    })
    recentActivity.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to load dashboard activity:', err)
    recentActivity.value = []
  } finally {
    loadingActivity.value = false
  }
}

const nutritionHistory = ref([])
const recentWorkout = ref(null)

const fetchNutritionActivity = async () => {
  loadingNutritionActivity.value = true
  try {
    const { data } = await axios.get(`${API_BASE}/api/dashboard/nutrition-activity`, {
      withCredentials: true,
    })
    nutritionHistory.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to load nutrition activity:', err)
    nutritionHistory.value = []
  } finally {
    loadingNutritionActivity.value = false
  }
}

const fetchRecentWorkout = async () => {
  loadingRecentWorkout.value = true
  try {
    const { data } = await axios.get(`${API_BASE}/api/dashboard/recent-workout`, {
      withCredentials: true,
    })
    recentWorkout.value = data && typeof data === 'object' ? data : null
  } catch (err) {
    console.error('Failed to load recent workout:', err)
    recentWorkout.value = null
  } finally {
    loadingRecentWorkout.value = false
  }
}

const onDateChange = async ([startDate, endDate]) => {
  dashboardStartDate.value = startDate
  dashboardEndDate.value = endDate
  await fetchActivityFeed()
}

onMounted(async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/user-profile-settings`, { withCredentials: true })
    const profile = res.data?.profile || {}
    firstName.value = profile.firstName || ''
  } catch {
    // silently fail — greeting just shows without a name
  }

  await Promise.all([
    fetchDashboardStats(),
    fetchActivityFeed(),
    fetchNutritionActivity(),
    fetchRecentWorkout(),
  ])
})

const metrics = computed(() => {
  const stats = dashboardStats.value
  return [
    {
      title: 'Workouts This Week',
      value: loadingMetrics.value ? '—' : stats.workoutsThisWeek,
      subtitle: stats.weeklyTarget > 0
        ? `Target: ${stats.weeklyTarget} sessions`
        : 'Completed sessions this week',
      trend: loadingMetrics.value ? '' : `${formatTrend(stats.weekDiff, '', 'No change')} vs last week`,
      icon: 'fa-solid fa-dumbbell',
      route: '/workout-log',
    },
    {
      title: 'Current Streak',
      value: loadingMetrics.value ? '—' : `${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`,
      subtitle: stats.currentStreak > 0 ? 'Consecutive workout days' : 'No active streak',
      trend: loadingMetrics.value ? '' : (stats.currentStreak > 0 ? 'Active today' : 'Log a workout today'),
      icon: 'fa-solid fa-fire',
      route: '/progress',
    },
    {
      title: 'Calories Burned',
      value: loadingMetrics.value ? '—' : stats.caloriesBurned.toLocaleString(),
      subtitle: 'This week total',
      trend: loadingMetrics.value ? '' : `${stats.weekStart || '—'} to ${stats.weekEnd || '—'}`,
      icon: 'fa-solid fa-bolt',
      route: '/nutrition',
    },
    {
      title: 'Protein Today',
      value: loadingMetrics.value ? '—' : `${stats.proteinToday.toLocaleString()}g`,
      subtitle: 'Today from nutrition logs',
      trend: loadingMetrics.value ? '' : (stats.proteinToday > 0 ? 'Logged today' : 'No protein logged today'),
      icon: 'fa-solid fa-drumstick-bite',
      route: '/nutrition',
    },
  ]
})
const recentActivity = ref([])

const quickActions = [
  {
    title: 'Start Workout',
    subtitle: 'Go to Workout Log',
    route: '/workout-log',
    icon: 'fa-solid fa-dumbbell',
  },
  {
    title: 'Workout Builder',
    subtitle: 'Create plans',
    route: '/workout-builder',
    icon: 'fa-solid fa-clipboard-list',
  },
  {
    title: 'Exercise Database',
    subtitle: 'Browse exercises',
    route: '/exercises',
    icon: 'fa-solid fa-book-open',
  },
]

const goToQuickAction = (route) => {
  router.push(route)
}

const goToRoute = (route) => {
  router.push(route)
}

const openMetricRoute = (metric) => {
  if (metric?.route) {
    router.push(metric.route)
  }
}

const activityItems = computed(() => recentActivity.value.map((item) => ({
  key: `${item.date}-${item.activityType}-${item.exerciseCount}`,
  dateLabel: formatActivityDate(item.date),
  action: item.summary || 'Recorded workout activity',
  detail: item.exerciseNames
    ? item.exerciseNames
    : `${item.exerciseCount || 0} exercise${Number(item.exerciseCount || 0) === 1 ? '' : 's'}`,
})))

const nutritionActivityItems = computed(() => nutritionHistory.value.map((item, index) => ({
  key: `${item.date || 'unknown'}-${item.mealType || 'meal'}-${index}`,
  mealType: String(item.mealType || 'Meal').trim() || 'Meal',
  summary: String(item.summary || 'Meal entry').trim() || 'Meal entry',
  dateLabel: formatActivityDate(item.date),
  calories: Number.isFinite(Number(item.calories)) ? Number(item.calories) : null,
})))

const recentWorkoutDisplay = computed(() => {
  const item = recentWorkout.value
  if (!item || !item.workoutDate) {
    return null
  }

  return {
    title: String(item.workoutName || 'Workout Session').trim() || 'Workout Session',
    durationMinutes: Math.max(0, Number(item.durationMinutes || 0)),
    exerciseCount: Math.max(0, Number(item.exerciseCount || 0)),
    dateLabel: formatActivityDate(item.workoutDate),
  }
})

const todaySummaryItems = computed(() => {
  const stats = dashboardStats.value
  return [
    {
      label: 'Workout completed',
      complete: Boolean(recentWorkoutDisplay.value),
    },
    {
      label: 'Protein goal met',
      complete: Number(stats.proteinToday || 0) >= 120,
    },
    {
      label: 'Calories tracked',
      complete: Number(stats.caloriesBurned || 0) > 0 || nutritionActivityItems.value.length > 0,
    },
    {
      label: 'Water goal logged',
      complete: false,
    },
  ]
})

// FUTURE:
// AI Coach Widget
// Recovery Score
// Smart Workout Suggestions
// FlexFit AI Insights
// Daily Recovery Tracking
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
            <DateRangePicker @change="onDateChange" />
          </div>
        </div>
      </section>

      <section class="dashboard-priority-row">
        <article class="dashboard-recent-workout dashboard-panel panel panel-bg">
          <div class="panel-header"><h5>Recent Workout</h5></div>
          <div class="panel-body recent-workout-body">
            <template v-if="loadingRecentWorkout">
              <p class="activity-empty">Loading recent workout...</p>
            </template>
            <template v-else-if="recentWorkoutDisplay">
              <strong class="recent-workout-title">{{ recentWorkoutDisplay.title }}</strong>
              <div class="recent-workout-meta">
                <span>{{ recentWorkoutDisplay.durationMinutes }} mins</span>
                <span>{{ recentWorkoutDisplay.exerciseCount }} exercises</span>
                <span>{{ recentWorkoutDisplay.dateLabel }}</span>
              </div>
            </template>
            <template v-else>
              <p class="activity-empty">
                No workouts logged yet<br>
                Start your first workout to begin tracking progress.
              </p>
              <button type="button" class="dashboard-empty-btn" @click="goToRoute('/workout-log')">
                Start Workout
              </button>
            </template>
          </div>
        </article>

        <section class="dashboard-focus-card dashboard-focus-card--high">
          <h3>Today's focus: progressive overload + nutrition consistency</h3>
          <p>Prioritize one quality strength session and hit your protein target.</p>

          <div class="today-summary-widget">
            <h6>TODAY</h6>
            <div class="today-summary-list">
              <div v-for="item in todaySummaryItems" :key="item.label" class="today-summary-item">
                <span :class="item.complete ? 'today-check today-check--ok' : 'today-check today-check--warn'">
                  {{ item.complete ? '✔' : '✖' }}
                </span>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </section>
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
            :clickable="true"
            @click="openMetricRoute(metric)"
          />
        </div>
      </section>

      <section class="dashboard-quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.route"
          type="button"
          class="quick-action-card"
          @click="goToQuickAction(action.route)"
        >
          <div class="quick-action-content">
            <div class="quick-action-left">
              <span class="quick-action-title">{{ action.title }}</span>
              <span class="quick-action-subtitle">{{ action.subtitle }}</span>
            </div>
            <span class="quick-action-icon">
              <i :class="action.icon"></i>
            </span>
          </div>
        </button>
      </section>

      <!-- Training Progress + Activity Feed -->
      <section class="dashboard-main-row">
        <div class="training-progress-section">
          <ProgressChart :start-date="dashboardStartDate" :end-date="dashboardEndDate" />
        </div>
        <div class="activity-feed-section">
          <div class="panel panel-bg dashboard-panel">
            <div class="panel-header"><h5>Activity Feed</h5></div>
            <div class="panel-body activity-feed">
              <article v-for="item in activityItems" :key="item.key" class="activity-row">
                <span class="time">{{ item.dateLabel }}</span>
                <div>
                  <strong>{{ item.action }}</strong>
                  <p>{{ item.detail }}</p>
                </div>
              </article>
              <p v-if="loadingActivity" class="activity-empty">
                Loading workout activity...
              </p>
              <p v-else-if="!activityItems.length" class="activity-empty">
                No recent workout activity.<br>
                Complete a workout to populate your activity feed.
              </p>
              <button v-if="!loadingActivity && !activityItems.length" type="button" class="dashboard-empty-btn" @click="goToRoute('/workout-log')">
                Start Workout
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="dashboard-nutrition-activity">
        <div class="panel panel-bg dashboard-panel">
          <div class="panel-header"><h5>Nutrition Activity</h5></div>
          <div class="panel-body nutrition-activity-feed">
            <article v-for="item in nutritionActivityItems" :key="item.key" class="nutrition-activity-row">
              <div class="nutrition-activity-main">
                <strong>{{ item.mealType }} Logged</strong>
                <p>{{ item.summary }}</p>
                <div class="nutrition-meta">
                  <span>{{ item.dateLabel }}</span>
                  <span v-if="item.calories !== null">{{ item.calories }} cal</span>
                </div>
              </div>
            </article>
            <p v-if="loadingNutritionActivity" class="activity-empty">
              Loading nutrition activity...
            </p>
            <p v-else-if="!nutritionActivityItems.length" class="activity-empty">
              No nutrition entries logged.<br>
              Track meals to build nutrition history.
            </p>
            <button v-if="!loadingNutritionActivity && !nutritionActivityItems.length" type="button" class="dashboard-empty-btn" @click="goToRoute('/nutrition')">
              Log Nutrition
            </button>
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
  --dashboard-section-gap: 14px;
  --dashboard-card-padding: 18px;
  --dashboard-grid-gap: 14px;
  --dashboard-header-spacing: 12px;
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
  gap: var(--dashboard-section-gap);
  padding-block: 4px !important;
}

.activity-empty {
  margin: 0;
  color: color-mix(in srgb, var(--text-color-secondary) 92%, #64748b 8%);
  font-size: 0.92rem;
  line-height: 1.45;
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
  gap: var(--dashboard-header-spacing);
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
  border: 1px solid rgba(120, 130, 150, 0.32);
  border-radius: 16px;
  padding: var(--dashboard-card-padding);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
}

.dashboard-focus-card--high {
  border-color: rgba(59, 130, 246, 0.35);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.8), rgba(255, 255, 255, 0.9));
}

.dashboard-priority-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--dashboard-grid-gap);
}

.dashboard-recent-workout {
  border-color: rgba(59, 130, 246, 0.38);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}

.recent-workout-body {
  display: grid;
  gap: 8px;
}

.recent-workout-title {
  font-size: 1.1rem;
  color: #1e293b;
  letter-spacing: -0.01em;
}

.recent-workout-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #64748b;
  font-weight: 700;
  font-size: 0.83rem;
}

.today-summary-widget {
  margin-top: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(248, 250, 252, 0.9);
}

.today-summary-widget h6 {
  margin: 0 0 8px;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  color: #475569;
  font-weight: 900;
}

.today-summary-list {
  display: grid;
  gap: 6px;
}

.today-summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: #334155;
}

.today-check {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 900;
}

.today-check--ok {
  color: #15803d;
  background: rgba(187, 247, 208, 0.7);
}

.today-check--warn {
  color: #c2410c;
  background: rgba(254, 215, 170, 0.65);
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
  gap: var(--dashboard-grid-gap);
}

.dashboard-quick-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--dashboard-grid-gap);
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
  gap: var(--dashboard-grid-gap);
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

.dashboard-nutrition-activity {
  width: 100%;
}

/* ─────────────────────────────────────────────────────────────────── */
/* CARD STYLES                                                         */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-panel {
  border: 1px solid rgba(120, 130, 150, 0.32);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
  overflow: hidden;
}

.panel-header {
  padding: 14px 18px;
  background: rgba(219, 234, 254, 0.95);
  border-bottom: 1px solid rgba(120, 130, 150, 0.25);
}

.panel-header h5 {
  margin: 0;
  color: var(--text-color);
  font-size: 1rem;
  font-weight: 800;
}

.panel-body {
  padding: var(--dashboard-card-padding);
}

.dashboard-main-row .dashboard-panel,
.dashboard-nutrition-activity .dashboard-panel,
.dashboard-nutrition .dashboard-panel {
  border-color: rgba(120, 130, 150, 0.24);
  box-shadow: 0 1px 4px rgba(20, 30, 50, 0.045);
}

/* ─────────────────────────────────────────────────────────────────── */
/* ACTIVITY FEED                                                       */
/* ─────────────────────────────────────────────────────────────────── */

.activity-feed {
  display: grid;
  gap: 12px;
}

.activity-row {
  border: 1px solid rgba(120, 130, 150, 0.28);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  gap: 12px;
  background: #f8fafc;
  box-shadow: 0 1px 3px rgba(20, 30, 50, 0.04);
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

.quick-action-card {
  border: 1px solid rgba(120, 130, 150, 0.32);
  border-radius: 12px;
  padding: 14px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.dashboard-empty-btn {
  justify-self: start;
  margin-top: 4px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 8px;
  font-size: 0.79rem;
  font-weight: 800;
  padding: 7px 10px;
  transition: all 0.2s ease;
}

.dashboard-empty-btn:hover {
  background: #dbeafe;
  border-color: rgba(59, 130, 246, 0.72);
}

.training-progress-section :deep(.apexcharts-canvas),
.training-progress-section :deep(svg),
.dashboard-nutrition :deep(.apexcharts-canvas),
.dashboard-nutrition :deep(svg) {
  max-width: 100% !important;
}

.quick-action-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(20, 30, 50, 0.09);
}

.quick-action-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.quick-action-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-action-title {
  color: #1e293b;
  font-size: 0.98rem;
  font-weight: 900;
}

.quick-action-subtitle {
  color: var(--text-color-secondary);
  font-size: 0.78rem;
}

.quick-action-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #3b82f6;
}

.nutrition-activity-feed {
  display: grid;
  gap: 12px;
}

.nutrition-activity-row {
  border: 1px solid rgba(120, 130, 150, 0.28);
  border-radius: 8px;
  padding: 12px 14px;
  background: #f8fafc;
  box-shadow: 0 1px 3px rgba(20, 30, 50, 0.04);
}

.nutrition-activity-main strong {
  color: var(--text-color);
  font-size: 0.88rem;
}

.nutrition-activity-main p {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
}

.nutrition-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 700;
}

/* ─────────────────────────────────────────────────────────────────── */
/* TABLET BREAKPOINT (768px+)                                          */
/* ─────────────────────────────────────────────────────────────────── */

@media (min-width: 768px) {
  .dashboard-canvas {
    gap: 14px;
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
    padding: 14px 20px;
  }

  .dashboard-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .dashboard-main-row {
    grid-template-columns: 1fr 1fr;
    gap: var(--dashboard-grid-gap);
  }

  .dashboard-quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--dashboard-grid-gap);
  }

  .dashboard-priority-row {
    grid-template-columns: 1.1fr 1fr;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* DESKTOP BREAKPOINT (1024px+)                                        */
/* ─────────────────────────────────────────────────────────────────── */

@media (min-width: 1024px) {
  .dashboard-canvas {
    gap: 14px;
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
    gap: 14px;
  }

  .dashboard-main-row {
    grid-template-columns: 1.5fr 1fr;
    gap: var(--dashboard-grid-gap);
  }

  .dashboard-quick-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .panel-body {
    padding: 20px;
  }

  .panel-header {
    padding: 14px 20px;
  }

  .activity-feed {
    gap: 12px;
  }

  .activity-row {
    padding: 12px 14px;
  }
}

/* ─────────────────────────────────────────────────────────────────── */
/* MOBILE (≤ 768px) — stack header, tighten gaps, compact cards        */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 768px) {
  .dashboard-canvas {
    --dashboard-section-gap: 6px;
    --dashboard-card-padding: 8px;
    --dashboard-grid-gap: 6px;
    --dashboard-header-spacing: 8px;
    gap: var(--dashboard-section-gap);
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
    gap: var(--dashboard-grid-gap);
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
    gap: var(--dashboard-grid-gap);
    margin-top: 0;
  }

  .dashboard-quick-actions {
    gap: var(--dashboard-grid-gap);
  }

  .quick-action-card {
    padding: 8px;
  }

  .quick-action-title {
    font-size: 0.84rem;
  }

  .quick-action-subtitle {
    font-size: 0.68rem;
  }

  .quick-action-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    font-size: 0.72rem;
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

  .nutrition-activity-row {
    padding: 6px 8px;
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

  .dashboard-empty-btn {
    width: 100%;
    justify-self: stretch;
    text-align: center;
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
