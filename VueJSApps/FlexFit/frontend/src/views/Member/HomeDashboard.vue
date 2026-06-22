<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE } from '@/config/env'
import DateRangePicker from '@/components/template/DateRangePicker.vue'
import ProgressChart from '@/components/Widgets/ProgressChart.vue'
import NutritionLogChart from '@/components/Widgets/NutritionLogChart.vue'

const router = useRouter()
const firstName = ref('')
const loadingMetrics = ref(true)
const loadingActivity = ref(true)
const loadingNutritionActivity = ref(true)
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

const recentActivity = ref([])
const nutritionHistory = ref([])

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
    // Greeting still works without first name.
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
      helper: 'This week',
      icon: 'fa-solid fa-dumbbell',
    },
    {
      key: 'streak',
      title: 'Streak',
      value: loadingMetrics.value ? '—' : `${summary.streak}d`,
      helper: 'Current',
      icon: 'fa-solid fa-fire',
    },
    {
      key: 'calories',
      title: 'Calories',
      value: loadingMetrics.value ? '—' : summary.calories.toLocaleString(),
      helper: 'Burned',
      icon: 'fa-solid fa-bolt',
    },
    {
      key: 'protein',
      title: 'Protein',
      value: loadingMetrics.value ? '—' : `${summary.protein}g`,
      helper: 'Today',
      icon: 'fa-solid fa-drumstick-bite',
    },
  ]
})

const workoutsWeekCard = computed(() => {
  const summary = statsSummary.value
  return {
    heading: 'Workouts This Week',
    primary: loadingMetrics.value ? '—' : `${summary.workouts} completed`,
    body: summary.weeklyTarget > 0
      ? `Completed sessions this week · Target: ${summary.weeklyTarget}`
      : 'Completed sessions this week',
    meta: loadingMetrics.value ? '' : `${formatTrend(summary.weekDiff, '', 'No change')} vs last week`,
  }
})

const quickActions = [
  {
    title: 'Start Workout',
    subtitle: 'Open Workout Log',
    route: '/workout-log',
    icon: 'fa-solid fa-dumbbell',
    tint: 'rgba(59, 130, 246, 0.06)',
    ctaColor: '#3b82f6',
  },
  {
    title: 'Workout Builder',
    subtitle: 'Build your next session',
    route: '/workout-builder',
    icon: 'fa-solid fa-clipboard-list',
    tint: 'rgba(139, 92, 246, 0.06)',
    ctaColor: '#8b5cf6',
  },
  {
    title: 'Exercise Database',
    subtitle: 'Browse exercise library',
    route: '/exercises',
    icon: 'fa-solid fa-book-open',
    tint: 'rgba(20, 184, 166, 0.06)',
    ctaColor: '#14b8a6',
  },
]

const dashboardMenuLinks = [
  { label: 'Dashboard', shortLabel: 'Home', route: '/dashboard', icon: 'fa-solid fa-house' },
  { label: 'Workout Log', shortLabel: 'Log', route: '/workout-log', icon: 'fa-solid fa-dumbbell' },
  { label: 'Workout Builder', shortLabel: 'Build', route: '/workout-builder', icon: 'fa-solid fa-clipboard-list' },
  { label: 'Exercise Database', shortLabel: 'Moves', route: '/exercises', icon: 'fa-solid fa-book-open' },
  { label: 'Nutrition', shortLabel: 'Fuel', route: '/Nutrition', icon: 'fa-solid fa-apple-whole' },
  { label: 'Progress', shortLabel: 'Track', route: '/progress', icon: 'fa-solid fa-chart-line' },
  { label: 'Scheduling', shortLabel: 'Plan', route: '/calendar', icon: 'fa-solid fa-calendar-days' },
  { label: 'Users', shortLabel: 'Users', route: '/admin/users', icon: 'fa-solid fa-users' },
  { label: 'Chat', shortLabel: 'Chat', route: '/chat', icon: 'fa-solid fa-comments' },
]

const goToQuickAction = (route) => {
  router.push(route)
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
</script>

<template>
  <div class="app-page-shell dashboard-shell">
    <div class="dashboard-bg-glow" aria-hidden="true"></div>
    <div class="app-page-canvas app-inner-shell dashboard-root">
      <aside class="dashboard-sidebar glass-card">
        <router-link to="/dashboard" class="brand-block">
          <span class="brand-mark"><i class="fa-solid fa-bolt"></i></span>
          <span class="brand-text">WorkoutAtlas</span>
        </router-link>
        <nav class="desktop-nav" aria-label="Dashboard navigation">
          <router-link
            v-for="item in dashboardMenuLinks"
            :key="item.route"
            :to="item.route"
            class="desktop-nav-item"
          >
            <i :class="item.icon"></i>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>
      </aside>

      <main class="dashboard-main">
        <section class="welcome-card glass-card">
          <div class="welcome-title-wrap">
            <p class="eyebrow">Training Dashboard</p>
            <h1>Welcome back<template v-if="firstName">, {{ firstName }}</template></h1>
          </div>
          <div class="header-picker">
            <DateRangePicker @change="onDateChange" />
          </div>
        </section>

        <section class="metric-grid">
          <article v-for="tab in statTabs" :key="tab.key" class="metric-card glass-card">
            <div class="metric-icon"><i :class="tab.icon"></i></div>
            <div class="metric-body">
              <p class="metric-label">{{ tab.title }}</p>
              <p class="metric-value">{{ tab.value }}</p>
              <p class="metric-helper">{{ tab.helper }}</p>
            </div>
          </article>
        </section>

        <section class="dashboard-feature-row">
          <article class="focus-card glass-card">
            <p class="section-kicker">Today's Focus</p>
            <h2>Progressive overload + nutrition consistency</h2>
            <p>Prioritize one quality strength session and hit your protein target.</p>
            <button type="button" class="start-workout-btn" @click="goToQuickAction('/workout-log')">
              Start Today's Workout
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </article>

          <article class="week-card glass-card">
            <div class="week-card-header">
              <h3>{{ workoutsWeekCard.heading }}</h3>
            </div>
            <p class="week-card-primary">{{ workoutsWeekCard.primary }}</p>
            <p class="week-card-body">{{ workoutsWeekCard.body }}</p>
            <p v-if="workoutsWeekCard.meta" class="week-card-meta">{{ workoutsWeekCard.meta }}</p>
          </article>
        </section>

        <section class="dashboard-quick-actions">
          <router-link
            v-for="action in quickActions"
            :key="action.route"
            :to="action.route"
            class="quick-action-card glass-card"
            :style="{ '--action-tint': action.tint, '--action-cta': action.ctaColor }"
          >
            <div class="quick-action-content">
              <div class="quick-action-left">
                <span class="quick-action-title">{{ action.title }}</span>
                <span class="quick-action-subtitle">{{ action.subtitle }}</span>
              </div>
              <div class="quick-action-right">
                <span class="quick-action-icon"><i :class="action.icon"></i></span>
                <span class="quick-action-arrow" aria-hidden="true">&#8250;</span>
              </div>
            </div>
          </router-link>
        </section>

        <section class="dashboard-main-row">
          <article class="dashboard-panel glass-card">
            <div class="panel-header"><h5>Training Progress</h5></div>
            <div class="panel-body">
              <ProgressChart :start-date="dashboardStartDate" :end-date="dashboardEndDate" />
            </div>
          </article>

          <article class="dashboard-panel glass-card">
            <div class="panel-header"><h5>Activity Feed</h5></div>
            <div class="panel-body activity-feed">
              <article v-for="item in activityItems" :key="item.key" class="activity-row">
                <span class="time">{{ item.dateLabel }}</span>
                <div>
                  <strong>{{ item.action }}</strong>
                  <p>{{ item.detail }}</p>
                </div>
              </article>
              <p v-if="loadingActivity" class="activity-empty">Loading workout activity...</p>
              <p v-else-if="!activityItems.length" class="activity-empty">
                No workout activity recorded yet.<br>
                Start a workout to populate your activity feed.
              </p>
            </div>
          </article>
        </section>

        <section class="dashboard-nutrition-activity">
          <article class="dashboard-panel glass-card">
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
              <p v-if="loadingNutritionActivity" class="activity-empty">Loading nutrition activity...</p>
              <p v-else-if="!nutritionActivityItems.length" class="activity-empty">
                No nutrition history recorded.<br>
                Start logging meals to populate this section.
              </p>
            </div>
          </article>
        </section>

        <section class="dashboard-nutrition">
          <article class="dashboard-panel glass-card">
            <div class="panel-header"><h5>Nutrition Trend</h5></div>
            <div class="panel-body"><NutritionLogChart /></div>
          </article>
        </section>
      </main>
    </div>

    <nav class="mobile-bottom-nav glass-card" aria-label="Quick menu">
      <router-link
        v-for="item in dashboardMenuLinks.slice(0, 5)"
        :key="item.route"
        :to="item.route"
        class="mobile-nav-item"
      >
        <i :class="item.icon"></i>
        <span>{{ item.shortLabel }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.dashboard-shell {
  --glass-bg: rgba(16, 24, 31, 0.7);
  --glass-border: rgba(171, 255, 77, 0.2);
  --text-main: #f7fafc;
  --text-soft: #9ca9b5;
  --accent: #a8ff3e;
  --row-bg: rgba(9, 17, 24, 0.86);
  min-height: 100%;
  padding: 10px 10px 96px;
  background:
    radial-gradient(circle at 14% -10%, rgba(168, 255, 62, 0.28), transparent 32%),
    radial-gradient(circle at 92% 2%, rgba(85, 222, 255, 0.17), transparent 34%),
    linear-gradient(160deg, #070b10, #09121a 45%, #0a141d);
  position: relative;
  overflow: hidden;
}

.dashboard-bg-glow {
  position: absolute;
  width: 360px;
  height: 360px;
  right: -110px;
  bottom: 22%;
  background: radial-gradient(circle, rgba(168, 255, 62, 0.22) 0%, rgba(168, 255, 62, 0) 70%);
  pointer-events: none;
}

.dashboard-root {
  position: relative;
  z-index: 2;
  display: block;
  max-width: 1320px;
  margin: 0 auto;
}

.glass-card {
  border: 1px solid var(--glass-border);
  background: linear-gradient(170deg, rgba(19, 30, 38, 0.82), var(--glass-bg));
  border-radius: 22px;
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.38);
}

.dashboard-main {
  display: grid;
  gap: 14px;
}

.dashboard-sidebar {
  display: none;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text-main);
  font-weight: 700;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 30%, #d4ff93, #a8ff3e);
  color: #122200;
}

.desktop-nav {
  margin-top: 18px;
  display: grid;
  gap: 6px;
}

.desktop-nav-item {
  min-height: 48px;
  border-radius: 14px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: var(--text-soft);
  text-decoration: none;
  font-weight: 600;
  transition: all 0.18s ease;
}

.desktop-nav-item:hover,
.desktop-nav-item.router-link-active {
  color: var(--text-main);
  background: rgba(168, 255, 62, 0.12);
}

.welcome-card {
  padding: 18px;
  display: grid;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-weight: 700;
}

.welcome-title-wrap h1 {
  margin: 5px 0 0;
  color: var(--text-main);
  font-size: 1.45rem;
  letter-spacing: -0.02em;
}

.header-picker {
  max-width: 100%;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  min-height: 102px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.metric-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #122000;
  background: linear-gradient(150deg, #ccff84, #8eea22);
}

.metric-label {
  margin: 0;
  font-size: 0.73rem;
  text-transform: uppercase;
  color: var(--text-soft);
  letter-spacing: 0.08em;
}

.metric-value {
  margin: 2px 0;
  color: var(--text-main);
  font-size: 1.08rem;
  font-weight: 800;
}

.metric-helper {
  margin: 0;
  color: color-mix(in srgb, var(--text-soft) 78%, #d8dee6 22%);
  font-size: 0.78rem;
}

.dashboard-feature-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.focus-card,
.week-card {
  padding: 18px;
}

.section-kicker {
  margin: 0;
  color: var(--accent);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.focus-card h2 {
  margin: 8px 0;
  color: var(--text-main);
  font-size: 1.25rem;
  line-height: 1.18;
}

.focus-card p,
.week-card-body,
.week-card-meta {
  margin: 0;
  color: var(--text-soft);
}

.start-workout-btn {
  margin-top: 16px;
  min-height: 56px;
  width: 100%;
  border: 0;
  border-radius: 15px;
  font-size: 1.02rem;
  font-weight: 800;
  color: #122000;
  background: linear-gradient(145deg, #d8ff9b, #9df73a);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.week-card-header h3 {
  margin: 0;
  color: var(--text-main);
  font-size: 1rem;
}

.week-card-primary {
  margin: 12px 0 4px;
  color: var(--text-main);
  font-size: 1.25rem;
  font-weight: 800;
}

.week-card-meta {
  margin-top: 8px;
}

.dashboard-quick-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.quick-action-card {
  padding: 16px;
  text-decoration: none;
  color: var(--text-main);
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
  gap: 4px;
}

.quick-action-title {
  font-size: 1rem;
  font-weight: 800;
}

.quick-action-subtitle {
  color: var(--text-soft);
  font-size: 0.81rem;
}

.quick-action-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.quick-action-icon {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #112100;
  background: linear-gradient(145deg, #d4ff94, #95ee2f);
}

.quick-action-arrow {
  font-size: 1.2rem;
  color: var(--accent);
}

.dashboard-main-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.dashboard-panel {
  overflow: hidden;
}

.panel-header {
  padding: 13px 16px;
  border-bottom: 1px solid rgba(168, 255, 62, 0.16);
}

.panel-header h5 {
  margin: 0;
  color: var(--text-main);
  font-size: 1rem;
}

.panel-body {
  padding: 16px;
}

.activity-feed,
.nutrition-activity-feed {
  display: grid;
  gap: 9px;
}

.activity-row,
.nutrition-activity-row {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(168, 255, 62, 0.12);
  background: var(--row-bg);
}

.activity-row .time {
  min-width: 78px;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
}

.activity-row strong,
.nutrition-activity-main strong {
  color: var(--text-main);
  font-size: 0.92rem;
}

.activity-row p,
.nutrition-activity-main p {
  margin: 3px 0 0;
  color: var(--text-soft);
  font-size: 0.83rem;
}

.nutrition-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: color-mix(in srgb, var(--text-soft) 85%, #e3ebf3 15%);
  font-size: 0.74rem;
}

.activity-empty {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.88rem;
}

.mobile-bottom-nav {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 8px;
}

.mobile-nav-item {
  min-height: 52px;
  border-radius: 12px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-decoration: none;
  color: var(--text-soft);
  font-size: 0.66rem;
  font-weight: 700;
}

.mobile-nav-item i {
  font-size: 0.95rem;
}

.mobile-nav-item.router-link-active {
  color: var(--accent);
  background: rgba(168, 255, 62, 0.12);
}

.panel-body :deep(.btn-box .btn) {
  min-height: 36px;
}

@media (min-width: 640px) {
  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .dashboard-quick-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dashboard-main-row {
    grid-template-columns: 1.3fr 1fr;
  }

  .dashboard-feature-row {
    grid-template-columns: 1.45fr 1fr;
  }
}

@media (min-width: 1024px) {
  .dashboard-shell {
    padding: 14px;
  }

  .dashboard-root {
    display: grid;
    grid-template-columns: 248px 1fr;
    gap: 14px;
    align-items: start;
  }

  .dashboard-sidebar {
    display: block;
    padding: 16px;
    position: sticky;
    top: 14px;
  }

  .mobile-bottom-nav {
    display: none;
  }

  .welcome-card {
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 14px;
  }

  .welcome-title-wrap h1 {
    font-size: 2rem;
  }

  .start-workout-btn {
    width: auto;
    min-width: 280px;
    justify-content: center;
  }
}
</style>
