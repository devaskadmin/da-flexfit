<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE } from '@/config/env'
import DateRangePicker from '@/components/template/DateRangePicker.vue';
import ProgressChart from '@/components/Widgets/ProgressChart.vue';
import NutritionLogChart from '@/components/Widgets/NutritionLogChart.vue';

const router = useRouter()
const firstName = ref('')
const loadingMetrics = ref(true)
const loadingActivity = ref(true)
const loadingNutritionActivity = ref(true)
const activeStatTab = ref('workouts')
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

  await Promise.all([fetchDashboardStats(), fetchActivityFeed(), fetchNutritionActivity()])
})

const statsSummary = computed(() => {
  const stats = dashboardStats.value
  return {
    workouts: Number(stats.workoutsThisWeek || 0),
    streak: Number(stats.currentStreak || 0),
    calories: Number(stats.caloriesBurned || 0),
    protein: Number(stats.proteinToday || 0),
    weekStart: stats.weekStart || '—',
    weekEnd: stats.weekEnd || '—',
    weekDiff: Number(stats.weekDiff || 0),
    weeklyTarget: Number(stats.weeklyTarget || 0),
  }
})

const statTabs = computed(() => {
  const summary = statsSummary.value
  return [
    {
      key: 'workouts',
      title: 'Workouts',
      value: loadingMetrics.value ? '—' : String(summary.workouts),
      icon: 'fa-solid fa-dumbbell',
    },
    {
      key: 'streak',
      title: 'Streak',
      value: loadingMetrics.value ? '—' : `${summary.streak}d`,
      icon: 'fa-solid fa-fire',
    },
    {
      key: 'calories',
      title: 'Calories',
      value: loadingMetrics.value ? '—' : summary.calories.toLocaleString(),
      icon: 'fa-solid fa-bolt',
    },
    {
      key: 'protein',
      title: 'Protein',
      value: loadingMetrics.value ? '—' : `${summary.protein}g`,
      icon: 'fa-solid fa-drumstick-bite',
    },
  ]
})

const activeStatPanel = computed(() => {
  const summary = statsSummary.value
  const proteinGoal = 120
  const proteinPct = proteinGoal > 0 ? Math.min(100, Math.round((summary.protein / proteinGoal) * 100)) : 0

  if (activeStatTab.value === 'streak') {
    return {
      heading: 'Current streak',
      primary: loadingMetrics.value ? '—' : `${summary.streak} day streak`,
      body: summary.streak > 0 ? 'Consistency is building. Keep your momentum going.' : 'Start a workout today',
      meta: summary.streak > 0 ? 'Progress message: Active streak detected' : 'Progress message: No active streak yet',
      ctaText: '',
      ctaRoute: '',
    }
  }

  if (activeStatTab.value === 'calories') {
    return {
      heading: 'Calories burned',
      primary: loadingMetrics.value ? '—' : `${summary.calories.toLocaleString()} calories`,
      body: 'Weekly summary',
      meta: `${summary.weekStart} to ${summary.weekEnd}`,
      ctaText: '',
      ctaRoute: '',
    }
  }

  if (activeStatTab.value === 'protein') {
    return {
      heading: 'Protein today',
      primary: loadingMetrics.value ? '—' : `${summary.protein.toLocaleString()}g`,
      body: loadingMetrics.value ? 'Goal progress' : `${proteinPct}% of ${proteinGoal}g goal`,
      meta: summary.protein > 0 ? 'Nutrition summary: Logged today' : 'Nutrition summary: No protein logged today',
      ctaText: '',
      ctaRoute: '',
    }
  }

  return {
    heading: 'Workouts This Week',
    primary: loadingMetrics.value ? '—' : `${summary.workouts} completed`,
    body: summary.weeklyTarget > 0
      ? `Completed sessions this week · Target: ${summary.weeklyTarget}`
      : 'Completed sessions this week',
    meta: loadingMetrics.value ? '' : `${formatTrend(summary.weekDiff, '', 'No change')} vs last week`,
    ctaText: 'Quick start workout',
    ctaRoute: '/workout-log',
  }
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

const selectStatTab = (tabKey) => {
  activeStatTab.value = tabKey
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

// FUTURE:
// AI coach summary
// Recommended workout
// Recovery score
// Smart nutrition alerts
// FlexFit AI block
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

      <!-- Focus Card -->
      <section class="dashboard-focus-card">
        <h3>Today's focus: progressive overload + nutrition consistency</h3>
        <p>Prioritize one quality strength session and hit your protein target.</p>
      </section>

      <!-- Compact Vertical Stats Navigation -->
      <section class="dashboard-stats-nav">
        <div class="dashboard-stats-nav__tabs">
          <button
            v-for="tab in statTabs"
            :key="tab.key"
            type="button"
            class="stats-nav-tab"
            :class="{ 'stats-nav-tab--active': activeStatTab === tab.key }"
            @click="selectStatTab(tab.key)"
          >
            <span class="stats-nav-tab__icon"><i :class="tab.icon"></i></span>
            <span class="stats-nav-tab__text">
              <span class="stats-nav-tab__title">{{ tab.title }}</span>
              <span class="stats-nav-tab__value">{{ tab.value }}</span>
            </span>
          </button>
        </div>

        <article class="dashboard-panel panel panel-bg stats-nav-panel">
          <div class="panel-header"><h5>{{ activeStatPanel.heading }}</h5></div>
          <div class="panel-body stats-nav-panel__body">
            <strong class="stats-nav-panel__primary">{{ activeStatPanel.primary }}</strong>
            <p class="stats-nav-panel__body-text">{{ activeStatPanel.body }}</p>
            <p v-if="activeStatPanel.meta" class="stats-nav-panel__meta">{{ activeStatPanel.meta }}</p>
            <button
              v-if="activeStatPanel.ctaText"
              type="button"
              class="stats-nav-panel__cta"
              @click="goToQuickAction(activeStatPanel.ctaRoute)"
            >
              {{ activeStatPanel.ctaText }}
            </button>
          </div>
        </article>
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
                No workout activity recorded yet.<br>
                Start a workout to populate your activity feed.
              </p>
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
              No nutrition history recorded.<br>
              Start logging meals to populate this section.
            </p>
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
  gap: 14px;
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
  border: 1px solid rgba(120, 130, 150, 0.32);
  border-radius: 16px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
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

.dashboard-stats-nav {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 14px;
  align-items: stretch;
}

.dashboard-stats-nav__tabs {
  display: grid;
  gap: 8px;
}

.stats-nav-tab {
  border: 1px solid rgba(120, 130, 150, 0.28);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(20, 30, 50, 0.04);
  min-height: 52px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  transition: all 0.2s ease;
}

.stats-nav-tab:hover {
  border-color: rgba(59, 130, 246, 0.35);
}

.stats-nav-tab--active {
  border-color: rgba(59, 130, 246, 0.6);
  background: #eff6ff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.14);
}

.stats-nav-tab__icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #dbeafe;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  flex-shrink: 0;
}

.stats-nav-tab--active .stats-nav-tab__icon {
  background: #bfdbfe;
  color: #1d4ed8;
}

.stats-nav-tab__text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  gap: 3px;
}

.stats-nav-tab__title {
  color: #334155;
  font-size: 0.74rem;
  font-weight: 800;
}

.stats-nav-tab__value {
  color: #0f172a;
  font-size: 0.86rem;
  font-weight: 900;
}

.stats-nav-panel__body {
  display: grid;
  gap: 6px;
  align-content: center;
  min-height: 132px;
}

.stats-nav-panel__primary {
  color: #0f172a;
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.stats-nav-panel__body-text {
  margin: 0;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 600;
}

.stats-nav-panel__meta {
  margin: 0;
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 700;
}

.stats-nav-panel__cta {
  justify-self: start;
  margin-top: 2px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 6px 10px;
}

.dashboard-quick-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

/* ─────────────────────────────────────────────────────────────────── */
/* MAIN ROW: TRAINING + ACTIVITY (stacked mobile, side-by-side desktop) */
/* ─────────────────────────────────────────────────────────────────── */

.dashboard-main-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
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

  .dashboard-stats-nav {
    grid-template-columns: 170px 1fr;
    gap: 14px;
  }

  .dashboard-main-row {
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .dashboard-quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
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

  .dashboard-stats-nav {
    grid-template-columns: 180px 1fr;
    gap: 14px;
  }

  .dashboard-main-row {
    grid-template-columns: 1.5fr 1fr;
    gap: 14px;
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

  .dashboard-stats-nav {
    grid-template-columns: 1fr;
    gap: 5px;
  }

  .dashboard-stats-nav__tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }

  .stats-nav-tab {
    min-height: 44px;
    padding: 6px 8px;
  }

  .stats-nav-tab__title {
    font-size: 0.68rem;
  }

  .stats-nav-tab__value {
    font-size: 0.8rem;
  }

  .stats-nav-panel__body {
    min-height: unset;
  }

  .stats-nav-panel__primary {
    font-size: 0.9rem;
  }

  .stats-nav-panel__body-text {
    font-size: 0.74rem;
  }

  .stats-nav-panel__meta {
    font-size: 0.7rem;
  }

  .stats-nav-panel__cta {
    font-size: 0.7rem;
    padding: 5px 8px;
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

  .dashboard-quick-actions {
    gap: 5px;
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

  .dashboard-stats-nav__tabs {
    gap: 3px;
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

  .dashboard-stats-nav__tabs {
    grid-template-columns: 1fr;
    gap: 2px;
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
