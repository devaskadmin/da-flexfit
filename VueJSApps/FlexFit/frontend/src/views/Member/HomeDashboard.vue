<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE } from '@/config/env'
import { useAuth } from '@/composable/useAuth'
import DateRangePicker from '@/components/template/DateRangePicker.vue'
import ProgressChart from '@/components/Widgets/ProgressChart.vue'
import NutritionLogChart from '@/components/Widgets/NutritionLogChart.vue'

const router = useRouter()
const authStore = useAuth()
const firstName = ref('')
const loadingMetrics = ref(true)
const loadingActivity = ref(true)
const loadingNutritionActivity = ref(true)
  const userRole = ref('member')
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

const formatTrend = (value, suffix = '', zeroText = 'No change') => {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}${suffix}`
  if (numeric < 0) return `${numeric}${suffix}`
  return zeroText
}

const formatActivityDate = (isoDate) => {
  if (!isoDate) return '—'
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const inferUserRole = (profile = {}) => {
  const raw = String(
    profile.role || profile.userRole || profile.accountType || profile.userType || profile.type || 'member',
  )
    .trim()
    .toLowerCase()

  if (raw.includes('admin')) return 'admin'
  if (raw.includes('trainer') || raw.includes('coach')) return 'trainer'
  return 'member'
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

const statsSummary = computed(() => {
  const stats = dashboardStats.value
  return {
    workouts: Number(stats.workoutsThisWeek || 0),
    streak: Number(stats.currentStreak || 0),
    calories: Number(stats.caloriesBurned || 0),
    protein: Number(stats.proteinToday || 0),
    weekDiff: Number(stats.weekDiff || 0),
    weeklyTarget: Number(stats.weeklyTarget || 0),
  }
})

const currentPeriod = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
})

const greetingName = computed(() => firstName.value || 'Athlete')

const heroFocus = computed(() => ({
  label: "Today's Focus",
  title: 'Progressive overload + nutrition consistency',
  description: 'Prioritize one quality strength session and hit your protein target.',
}))

const summaryCards = computed(() => {
  const summary = statsSummary.value
  return [
    {
      key: 'workouts',
      label: 'Workouts',
      value: loadingMetrics.value ? '—' : String(summary.workouts),
      helper: 'This week',
      icon: 'fa-solid fa-dumbbell',
    },
    {
      key: 'streak',
      label: 'Streak',
      value: loadingMetrics.value ? '—' : `${summary.streak}`,
      helper: 'Days',
      icon: 'fa-solid fa-fire',
    },
    {
      key: 'calories',
      label: 'Calories',
      value: loadingMetrics.value ? '—' : summary.calories.toLocaleString(),
      helper: 'Burned',
      icon: 'fa-solid fa-bolt',
    },
    {
      key: 'protein',
      label: 'Protein',
      value: loadingMetrics.value ? '—' : `${summary.protein}g`,
      helper: 'Today',
      icon: 'fa-solid fa-drumstick-bite',
    },
  ]
})

const weeklyProgress = computed(() => {
  const summary = statsSummary.value
  const target = summary.weeklyTarget > 0 ? summary.weeklyTarget : 1
  const completed = summary.workouts
  const percent = Math.max(0, Math.min(100, Math.round((completed / target) * 100)))

  return {
    completed,
    target: summary.weeklyTarget,
    percent,
    trend: loadingMetrics.value ? '' : `${formatTrend(summary.weekDiff, '', 'No change')} vs last week`,
  }
})

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

const navLinks = [
  { label: 'Home', route: '/dashboard', icon: 'fa-solid fa-house' },
  { label: 'Log', route: '/workout-log', icon: 'fa-solid fa-dumbbell' },
  { label: 'Build', route: '/workout-builder', icon: 'fa-solid fa-clipboard-list' },
  { label: 'Progress', route: '/progress', icon: 'fa-solid fa-chart-line' },
  { label: 'Nutrition', route: '/Nutrition', icon: 'fa-solid fa-apple-whole' },
]

const allMenuLinks = [
  { label: 'Dashboard', shortLabel: 'Home', route: '/dashboard', icon: 'fa-solid fa-house', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Workout Log', shortLabel: 'Log', route: '/workout-log', icon: 'fa-solid fa-dumbbell', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Workout Builder', shortLabel: 'Build', route: '/workout-builder', icon: 'fa-solid fa-clipboard-list', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Exercise Database', shortLabel: 'Moves', route: '/exercises', icon: 'fa-solid fa-book-open', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Nutrition', shortLabel: 'Fuel', route: '/Nutrition', icon: 'fa-solid fa-apple-whole', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Progress', shortLabel: 'Track', route: '/progress', icon: 'fa-solid fa-chart-line', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Settings', shortLabel: 'Settings', route: '/user-settings', icon: 'fa-solid fa-gear', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Logout', shortLabel: 'Logout', route: '/logout', icon: 'fa-solid fa-right-from-bracket', section: 'General', roles: ['member', 'trainer', 'admin'] },
  { label: 'Chat with Trainer', shortLabel: 'Chat', route: '/chat', icon: 'fa-solid fa-comments', section: 'Trainer', roles: ['member', 'trainer'] },
  { label: 'Scheduling', shortLabel: 'Plan', route: '/calendar', icon: 'fa-solid fa-calendar-days', section: 'Admin', roles: ['admin'] },
  { label: 'Users', shortLabel: 'Users', route: '/admin/users', icon: 'fa-solid fa-users', section: 'Admin', roles: ['admin'] },
  { label: 'Roles', shortLabel: 'Roles', route: '/admin/roles', icon: 'fa-solid fa-user-shield', section: 'Admin', roles: ['admin'] },
  { label: 'Test Roles', shortLabel: 'Test', route: '/admin/role-tester', icon: 'fa-solid fa-vials', section: 'Admin', roles: ['admin'] },
  { label: 'Tools', shortLabel: 'Tools', route: '/tools', icon: 'fa-solid fa-screwdriver-wrench', section: 'Admin', roles: ['admin'] },
  { label: 'Admin Chat', shortLabel: 'Chat', route: '/chat', icon: 'fa-solid fa-comments', section: 'Admin', roles: ['admin'] },
]

const desktopNavSections = computed(() => {
  const role = normalizedRole.value
  const allowed = allMenuLinks.filter((link) => Array.isArray(link.roles) && link.roles.includes(role))
  const order = ['General', 'Trainer', 'Admin']

  return order
    .map((label) => ({
      label,
      links: allowed.filter((link) => link.section === label),
    }))
    .filter((section) => section.links.length > 0)
})

const quickActions = [
  {
    title: 'Start Workout',
    subtitle: 'Open Workout Log',
    route: '/workout-log',
    icon: 'fa-solid fa-dumbbell',
    tint: 'rgba(59, 130, 246, 0.06)',
    ctaColor: '#3b82f6',
    roles: ['member', 'trainer', 'admin'],
  },
  {
    title: 'Workout Builder',
    subtitle: 'Build your next session',
    route: '/workout-builder',
    icon: 'fa-solid fa-clipboard-list',
    tint: 'rgba(139, 92, 246, 0.06)',
    ctaColor: '#8b5cf6',
    roles: ['member', 'trainer', 'admin'],
  },
  {
    title: 'Exercise Database',
    subtitle: 'Browse exercise library',
    route: '/exercises',
    icon: 'fa-solid fa-book-open',
    tint: 'rgba(20, 184, 166, 0.06)',
    ctaColor: '#14b8a6',
    roles: ['member', 'trainer', 'admin'],
  },
]

const visibleQuickActions = computed(() => {
  const role = normalizedRole.value
  return quickActions.filter((action) => Array.isArray(action.roles) && action.roles.includes(role))
})

const normalizedRole = computed(() => String(authStore.role?.value || authStore.role || 'user').trim().toLowerCase())
const isAdmin = computed(() => normalizedRole.value === 'administrator' || normalizedRole.value === 'admin')
const isTrainer = computed(() => normalizedRole.value === 'trainer' || isAdmin.value)

const roleActions = computed(() => {
  if (isAdmin.value) {
    return [
      { title: 'Users', description: 'Manage user accounts', route: '/admin/users', icon: 'fa-solid fa-users' },
      { title: 'Roles', description: 'Manage role permissions', route: '/admin/roles', icon: 'fa-solid fa-id-badge' },
      { title: 'Tools', description: 'Open admin tools', route: '/tools', icon: 'fa-solid fa-toolbox' },
      { title: 'Scheduling', description: 'Manage calendar and events', route: '/calendar', icon: 'fa-solid fa-calendar-days' },
      { title: 'Chat', description: 'Open team chat', route: '/chat', icon: 'fa-solid fa-comments' },
    ]
  }

  if (isTrainer.value) {
    return [
      { title: 'Chat with Clients', description: 'Open trainer communication', route: '/chat', icon: 'fa-solid fa-comments' },
      { title: 'Scheduling', description: 'Manage training schedule', route: '/calendar', icon: 'fa-solid fa-calendar-days' },
    ]
  }

  return []
})

const onDateChange = async ([startDate, endDate]) => {
  dashboardStartDate.value = startDate
  dashboardEndDate.value = endDate
  await fetchActivityFeed()
}

const goTo = (route) => {
  router.push(route)
}

const goToQuickAction = (route) => {
  router.push(route)
}

onMounted(async () => {
  document.body.classList.add('wa-dashboard-active')

  await authStore.fetchUser()

  try {
    const res = await axios.get(`${API_BASE}/api/user-profile-settings`, { withCredentials: true })
    const profile = res.data?.profile || {}
    firstName.value = profile.firstName || ''
  } catch {
    // Dashboard still works without profile details.
  }

  await Promise.all([fetchDashboardStats(), fetchActivityFeed(), fetchNutritionActivity()])
})

onUnmounted(() => {
  document.body.classList.remove('wa-dashboard-active')
})
</script>

<template>
  <div class="wa-dashboard">
    <main class="wa-dashboard-main">
      <section class="wa-greeting-row">
        <div class="wa-greeting">
          <p class="wa-greeting-line">Good {{ currentPeriod }},</p>
          <h1>{{ greetingName }} 👋</h1>
          <p class="wa-streak">🔥 {{ loadingMetrics ? '—' : statsSummary.streak }} Day Streak</p>
        </div>
        <div class="wa-date-picker-wrap" aria-label="Date range selector">
          <DateRangePicker @change="onDateChange" />
        </div>
      </section>

      <section class="wa-hero-card">
        <p class="wa-hero-label">{{ heroFocus.label }}</p>
        <h2>{{ heroFocus.title }}</h2>
        <p>{{ heroFocus.description }}</p>
        <button type="button" class="wa-hero-cta" @click="goToQuickAction('/workout-log')">
          Start Today's Workout
        </button>
      </section>

      <section class="wa-summary-block">
        <div class="wa-section-head">
          <h3>Today's Summary</h3>
          <router-link to="/progress">View all</router-link>
        </div>

        <div class="wa-summary-grid">
          <article v-for="card in summaryCards" :key="card.key" class="wa-summary-card">
            <div class="wa-summary-card-top">
              <span class="wa-summary-label">{{ card.label }}</span>
              <i :class="card.icon"></i>
            </div>
              <p class="wa-summary-value">{{ loadingMetrics ? '—' : card.value }}</p>
            <p class="wa-summary-helper">{{ card.helper }}</p>
          </article>
        </div>
      </section>

      <section class="wa-weekly-activity-grid">
        <article class="wa-weekly-card">
          <div class="wa-section-head">
            <h3>Workouts This Week</h3>
            <router-link to="/workout-log" aria-label="Open workout log" class="wa-weekly-link">›</router-link>
          </div>

          <p class="wa-weekly-main">
            {{ loadingMetrics ? '—' : `${weeklyProgress.completed} / ${weeklyProgress.target || '—'} completed` }}
          </p>

          <div class="wa-progress-track" role="progressbar" :aria-valuenow="weeklyProgress.percent" aria-valuemin="0" aria-valuemax="100">
            <span class="wa-progress-fill" :style="{ width: `${weeklyProgress.percent}%` }"></span>
          </div>

          <p class="wa-weekly-meta">{{ weeklyProgress.trend }}</p>

          <button type="button" class="wa-quick-start-btn" @click="goToQuickAction('/workout-log')">
            <i class="fa-solid fa-bolt"></i> Quick Start Workout
          </button>
        </article>

        <article class="wa-activity-section">
          <div class="wa-panel-header">
            <h3>Activity Feed</h3>
          </div>
          <div class="wa-panel-body wa-activity-feed">
            <article v-for="item in activityItems" :key="item.key" class="wa-activity-row">
              <span class="wa-time">{{ item.dateLabel }}</span>
              <div>
                <strong>{{ item.action }}</strong>
                <p>{{ item.detail }}</p>
              </div>
            </article>
            <p v-if="loadingActivity" class="wa-activity-empty">Loading workout activity...</p>
            <p v-else-if="!activityItems.length" class="wa-activity-empty">
              No workout activity recorded yet.<br>
              Start a workout to populate your activity feed.
            </p>
          </div>
        </article>
      </section>

      <section class="wa-quick-actions">
        <router-link
          v-for="action in visibleQuickActions"
          :key="action.route"
          :to="action.route"
          class="wa-quick-action-card"
          :style="{ '--action-tint': action.tint, '--action-cta': action.ctaColor }"
        >
          <div class="wa-quick-action-content">
            <div class="wa-quick-action-left">
              <span class="wa-quick-action-title">{{ action.title }}</span>
              <span class="wa-quick-action-subtitle">{{ action.subtitle }}</span>
            </div>
            <div class="wa-quick-action-right">
              <span class="wa-quick-action-icon"><i :class="action.icon"></i></span>
              <span class="wa-quick-action-arrow" aria-hidden="true">›</span>
            </div>
          </div>
        </router-link>
      </section>

      <section class="wa-training-progress-panel">
        <div class="wa-panel-header">
          <h3>Training Progress</h3>
        </div>
        <div class="wa-panel-body">
          <ProgressChart :start-date="dashboardStartDate" :end-date="dashboardEndDate" />
        </div>
      </section>

      <section v-if="roleActions.length" class="wa-role-tools-section">
        <div class="wa-panel-header">
          <h3>{{ isAdmin ? 'Administrator Tools' : 'Trainer Tools' }}</h3>
        </div>
        <div class="wa-role-tools-grid">
          <router-link
            v-for="action in roleActions"
            :key="action.route"
            :to="action.route"
            class="wa-role-tool-row"
          >
            <span class="wa-role-icon"><i :class="action.icon"></i></span>
            <span class="wa-role-text">
              <strong>{{ action.title }}</strong>
              <small>{{ action.description }}</small>
            </span>
            <span class="wa-role-arrow" aria-hidden="true">›</span>
          </router-link>
        </div>
      </section>

      <section class="wa-nutrition-activity-section">
        <div class="wa-panel-header">
          <h3>Nutrition Activity</h3>
        </div>
        <div class="wa-panel-body wa-nutrition-activity-feed">
          <article v-for="item in nutritionActivityItems" :key="item.key" class="wa-nutrition-activity-row">
            <div class="wa-nutrition-activity-main">
              <strong>{{ item.mealType }} Logged</strong>
              <p>{{ item.summary }}</p>
              <div class="wa-nutrition-meta">
                <span>{{ item.dateLabel }}</span>
                <span v-if="item.calories !== null">{{ item.calories }} cal</span>
              </div>
            </div>
          </article>
          <p v-if="loadingNutritionActivity" class="wa-activity-empty">Loading nutrition activity...</p>
          <p v-else-if="!nutritionActivityItems.length" class="wa-activity-empty">
            No nutrition history recorded.<br>
            Start logging meals to populate this section.
          </p>
        </div>
      </section>

      <section class="wa-nutrition-chart-section">
        <div class="wa-panel-header">
          <h3>Nutrition Trend</h3>
        </div>
        <div class="wa-panel-body">
          <NutritionLogChart />
        </div>
      </section>
    </main>

    <nav class="wa-bottom-nav" aria-label="Bottom navigation" role="navigation">
      <router-link
        v-for="item in navLinks"
        :key="item.route"
        :to="item.route"
        class="wa-bottom-link"
      >
        <i :class="item.icon"></i>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.wa-dashboard {
  --wa-accent: var(--wa-shell-accent, var(--main-color, #2563eb));
  --wa-accent-hover: color-mix(in srgb, var(--wa-accent) 84%, #ffffff 16%);
  --wa-accent-soft: var(--wa-shell-accent-soft, color-mix(in srgb, var(--wa-accent) 20%, transparent 80%));
  --wa-background: var(--wa-shell-bg-secondary, #0d1118);
  --wa-surface: var(--wa-shell-surface, #111821);
  --wa-surface-elevated: var(--wa-shell-surface-elevated, #17212d);
  --wa-surface-soft: var(--wa-shell-surface-soft, #1c2734);
  --wa-border: var(--wa-shell-border, rgba(255, 255, 255, 0.09));
  --wa-border-strong: var(--wa-shell-border-strong, rgba(255, 255, 255, 0.15));
  --wa-text-primary: var(--wa-shell-text, #f8fafc);
  --wa-text-secondary: var(--wa-shell-text-secondary, #a5afbd);
  --wa-text-muted: var(--wa-shell-text-muted, #748094);

  min-height: calc(100vh - 70px);
  background: var(--wa-background);
  color: var(--wa-text-primary);
  padding: 20px 16px calc(90px + env(safe-area-inset-bottom));
  overflow-x: clip;
}

.wa-dashboard-main {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.wa-greeting-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
}

.wa-greeting {
  min-width: 0;
}

.wa-greeting-line {
  margin: 0;
  color: var(--wa-text-muted);
  font-size: 12px;
}

.wa-greeting h1 {
  margin: 1px 0 0;
  font-size: 30px;
  line-height: 1.1;
}

.wa-streak {
  margin: 4px 0 0;
  color: var(--wa-text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.wa-date-picker-wrap {
  width: min(430px, 100%);
}

.wa-date-picker-wrap :deep(.date-picker-wrapper),
.wa-date-picker-wrap :deep(.date-range-picker),
.wa-date-picker-wrap :deep(.DateRangePicker) {
  width: 100%;
}

.wa-hero-card,
.wa-summary-block,
.wa-weekly-card,
.wa-role-tools-section,
.wa-training-progress-panel,
.wa-activity-section,
.wa-nutrition-activity-section,
.wa-nutrition-chart-section {
  background: var(--wa-surface);
  border: 1px solid var(--wa-border);
  border-radius: 16px;
  padding: 14px;
}

.wa-hero-label {
  margin: 0;
  color: var(--wa-text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.wa-hero-card h2 {
  margin: 6px 0 4px;
  font-size: 18px;
  line-height: 1.2;
}

.wa-hero-card p {
  margin: 0;
  color: var(--wa-text-secondary);
  font-size: 13px;
}

.wa-hero-cta {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 12px;
  margin-top: 14px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--wa-accent), var(--wa-accent-hover));
  cursor: pointer;
}

.wa-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.wa-section-head h3 {
  margin: 0;
  font-size: 15px;
}

.wa-section-head a {
  text-decoration: none;
  color: var(--wa-text-secondary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.wa-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.wa-summary-card {
  background: var(--wa-surface-elevated);
  border: 1px solid var(--wa-border);
  border-radius: 14px;
  padding: 10px;
}

.wa-summary-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
}

.wa-summary-label {
  font-size: 11px;
  color: var(--wa-text-muted);
}

.wa-summary-card-top i {
  color: var(--wa-accent);
  font-size: 13px;
}

.wa-summary-value {
  margin: 6px 0 0;
  font-size: 24px;
  line-height: 1;
  font-weight: 800;
}

.wa-summary-helper {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--wa-text-muted);
}

.wa-weekly-main {
  margin: 0;
  font-size: 14px;
  color: var(--wa-text-primary);
}

.wa-progress-track {
  margin-top: 10px;
  height: 10px;
  border-radius: 999px;
  background: #0a111b;
  border: 1px solid var(--wa-border);
  overflow: hidden;
}

.wa-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--wa-accent), var(--wa-accent-hover));
}

.wa-weekly-meta {
  margin: 8px 0 4px;
  color: var(--wa-text-secondary);
  font-size: 12px;
}

.wa-quick-start-btn {
  margin-top: 12px;
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--wa-border);
  border-radius: 12px;
  background: var(--wa-surface-soft);
  color: var(--wa-text-primary);
  font-weight: 600;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}

.wa-weekly-activity-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.wa-quick-start-btn:hover {
  background: color-mix(in srgb, var(--wa-surface-soft) 84%, var(--wa-accent-soft) 16%);
}

.wa-quick-start-btn i {
  font-size: 12px;
}

.wa-quick-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.wa-quick-action-card {
  background: var(--wa-surface);
  border: 1px solid var(--wa-border);
  border-radius: 14px;
  padding: 12px;
  text-decoration: none;
  color: var(--wa-text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s ease;
}

.wa-quick-action-card:hover {
  border-color: color-mix(in srgb, var(--wa-accent) 44%, var(--wa-border) 56%);
  background: color-mix(in srgb, var(--wa-surface) 80%, var(--wa-accent-soft) 20%);
}

.wa-quick-action-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wa-quick-action-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wa-quick-action-title {
  font-size: 13px;
  font-weight: 700;
}

.wa-quick-action-subtitle {
  color: var(--wa-text-secondary);
  font-size: 11px;
}

.wa-quick-action-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wa-quick-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--wa-accent);
  font-size: 14px;
}

.wa-quick-action-arrow {
  font-size: 18px;
  color: var(--wa-accent);
}

.wa-panel-header {
  padding: 0 0 10px;
  border-bottom: 1px solid var(--wa-border);
}

.wa-panel-header h3 {
  margin: 0;
  color: var(--wa-text-primary);
  font-size: 14px;
}

.wa-panel-body {
  padding: 12px 0 0;
}

.wa-role-tools-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.wa-role-tool-row {
  border: 1px solid var(--wa-border);
  border-radius: 12px;
  padding: 11px 12px;
  text-decoration: none;
  color: var(--wa-text-primary);
  background: var(--wa-surface-elevated);
  display: flex;
  align-items: center;
  gap: 10px;
}

.wa-role-tool-row:hover {
  border-color: color-mix(in srgb, var(--wa-accent) 44%, var(--wa-border) 56%);
}

.wa-role-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--wa-accent) 18%, transparent 82%);
  color: var(--wa-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wa-role-text {
  min-width: 0;
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.wa-role-text strong {
  font-size: 13px;
}

.wa-role-text small {
  font-size: 11px;
  color: var(--wa-text-muted);
}

.wa-role-arrow {
  margin-left: auto;
  color: var(--wa-accent);
  font-size: 18px;
}

.wa-activity-feed,
.wa-nutrition-activity-feed {
  display: grid;
  gap: 9px;
}

.wa-activity-row,
.wa-nutrition-activity-row {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--wa-border);
  background: var(--wa-surface-elevated);
}

.wa-activity-row .wa-time {
  min-width: 60px;
  color: color-mix(in srgb, var(--wa-accent) 70%, var(--wa-text-primary) 30%);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.wa-activity-row strong,
.wa-nutrition-activity-main strong {
  color: var(--wa-text-primary);
  font-size: 13px;
}

.wa-activity-row p,
.wa-nutrition-activity-main p {
  margin: 3px 0 0;
  color: var(--wa-text-secondary);
  font-size: 12px;
}

.wa-nutrition-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--wa-text-muted);
  font-size: 11px;
}

.wa-activity-empty {
  margin: 0;
  color: var(--wa-text-secondary);
  font-size: 12px;
}

.wa-bottom-nav {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: max(10px, env(safe-area-inset-bottom));
  z-index: 60;
  height: 70px;
  border-radius: 16px;
  border: 1px solid var(--wa-border);
  background: color-mix(in srgb, var(--wa-surface) 92%, transparent 8%);
  backdrop-filter: blur(10px);
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: 4px;
}

.wa-bottom-link {
  text-decoration: none;
  color: var(--wa-text-secondary);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.wa-bottom-link i {
  font-size: 14px;
}

.wa-bottom-link.router-link-active {
  color: var(--wa-accent);
  background: var(--wa-accent-soft);
}

.wa-desktop-rail {
  display: none;
}

.wa-weekly-link {
  cursor: pointer;
}

@media (max-width: 1023px) {
  .wa-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wa-weekly-activity-grid,
  .wa-role-tools-grid {
    grid-template-columns: 1fr;
  }

  .wa-quick-actions {
    grid-template-columns: 1fr;
  }

  .wa-quick-action-card {
    padding: 12px;
  }

  .wa-quick-action-left {
    flex: 1;
  }
}

@media (min-width: 768px) {
  .wa-dashboard {
    padding: 20px 24px 38px;
  }

  .wa-bottom-nav {
    display: none;
  }
}

@media (min-width: 1024px) {
  .wa-dashboard {
    padding: 20px 24px 40px;
  }

  .wa-dashboard-main {
    max-width: 1320px;
    gap: 14px;
  }

  .wa-summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .wa-quick-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .wa-dashboard {
    padding: 12px 12px calc(86px + env(safe-area-inset-bottom));
  }

  .wa-greeting-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .wa-greeting h1 {
    font-size: 28px;
  }

  .wa-date-picker-wrap {
    width: 100%;
  }

  .wa-hero-card,
  .wa-summary-block,
  .wa-weekly-card,
  .wa-training-progress-panel,
  .wa-activity-section,
  .wa-nutrition-activity-section,
  .wa-nutrition-chart-section,
  .wa-role-tools-section {
    padding: 12px;
  }
}

@media (max-width: 430px) {
  .wa-greeting h1 {
    font-size: 24px;
  }
}

/* Prevent the floating theme settings control from covering dashboard cards. */
:global(body.wa-dashboard-active .right-sidebar-btn) {
  top: auto;
  bottom: 102px;
  right: 12px;
  z-index: 40;
}

@media (min-width: 768px) {
  :global(body.wa-dashboard-active .right-sidebar-btn) {
    bottom: 18px;
  }
}

@media (max-width: 767px) {
  :global(body.wa-dashboard-active .right-sidebar-btn) {
    display: none !important;
  }
}
</style>
