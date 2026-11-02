<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router';
import { API_BASE } from '@/config/env';
import { useAuth } from '@/composable/useAuth';
import AvatarModal from '@/components/AvatarModal.vue';
import ExercisePickerModal from '@/components/workout-builder/ExercisePickerModal.vue';

const activeTab = ref('profile')
const route = useRoute();
const authStore = useAuth()
const showAvatarModal = ref(false)

const normalizedRole = computed(() => {
  return String(
    authStore.user?.value?.role ||
    authStore.user?.value?.roleSlug ||
    authStore.user?.role ||
    authStore.user?.roleSlug ||
    ''
  ).trim().toLowerCase()
})

const isAdmin = computed(() => ['admin', 'administrator'].includes(normalizedRole.value))

const profile = reactive({
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  phone: '',
  bio: '',
  gender: 'male',
  dateOfBirth: '',
  location: '',
  avatarName: '',
  avatarPath: '',
})

const fitness = reactive({
  primaryGoal: 'body_recomposition',
  activityLevel: 'intermediate',
  experienceLevel: 'intermediate',
  currentWeight: '198.2',
  targetWeight: '185',
  height: "5'11",
  restingHR: '61',
  weeklyTarget: '5',
  preferredUnits: 'imperial',
})

const notifications = reactive({
  workoutReminders: true,
  nutritionReminders: true,
  weeklyReport: true,
  streakAlerts: true,
  coachMessages: false,
  productUpdates: false,
})

const display = reactive({
  language: 'en',
  dashboardLayout: 'detailed',
  startPage: 'dashboard',
})

const loadDisplayFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem('wa_display_settings')
    if (!stored) return
    const d = JSON.parse(stored)
    if (d.language)        display.language = d.language
    if (d.dashboardLayout) display.dashboardLayout = d.dashboardLayout
    if (d.startPage)       display.startPage = d.startPage
  } catch (_) {}
}

const security = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  twoFactor: false,
})

const saveStatus = ref('')
const errorMsg = ref('')
const successMsg = ref('')

async function save() {
  errorMsg.value = ''
  successMsg.value = ''
  saveStatus.value = 'saving'
  const settingsPayload = { settings: {} }

  if (isAdmin.value) {
    settingsPayload.settings.display = {
      language: display.language,
      dashboardLayout: display.dashboardLayout,
      startPage: display.startPage,
    }
  }

  try {
    const response = await fetch(`${API_BASE}/api/user-profile-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settingsPayload),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error || 'Failed to save settings.')
    }

    saveStatus.value = 'saved'
    successMsg.value = 'Settings saved successfully.'
    setTimeout(() => {
      saveStatus.value = ''
    }, 3000)
  } catch (err) {
    saveStatus.value = ''
    errorMsg.value = err?.message || 'Failed to save settings.'
  }
}

const tabs = [
  { id: 'profile',       label: 'Profile',          icon: 'fa-solid fa-user' },
  { id: 'fitness',       label: 'Fitness Profile',  icon: 'fa-solid fa-dumbbell' },
  { id: 'goals',         label: 'My Goals',         icon: 'fa-solid fa-bullseye' },
  { id: 'notifications', label: 'Notifications',    icon: 'fa-solid fa-bell' },
  { id: 'display',       label: 'Display',          icon: 'fa-solid fa-display' },
  { id: 'security',      label: 'Security',         icon: 'fa-solid fa-shield-halved' },
]

const visibleTabs = computed(() => {
  if (isAdmin.value) return tabs
  return tabs.filter((tab) => tab.id !== 'display')
})

// Mobile navigation
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= 768)
const mobileMenuOpen = ref(false)
const tabEmoji = {
  profile:       '👤',
  fitness:       '🏋️',
  goals:         '🎯',
  notifications: '🔔',
  display:       '🖥️',
  security:      '🛡️',
}
const handleResize = () => { isMobile.value = window.innerWidth <= 768 }

const goalOptions = [
  { value: 'lose_weight',         label: 'Lose Weight',   icon: 'fa-solid fa-scale-unbalanced-flip' },
  { value: 'build_muscle',        label: 'Build Muscle',  icon: 'fa-solid fa-dumbbell' },
  { value: 'body_recomposition',  label: 'Body Recomp',   icon: 'fa-solid fa-arrows-rotate' },
  { value: 'improve_endurance',   label: 'Endurance',     icon: 'fa-solid fa-heart-pulse' },
  { value: 'maintain',            label: 'Maintain',      icon: 'fa-solid fa-check-double' },
  { value: 'athletic_performance',label: 'Performance',   icon: 'fa-solid fa-trophy' },
]

const notifOptions = [
  { key: 'workoutReminders',   label: 'Workout Reminders',   desc: 'Daily push when a session is scheduled',  icon: 'fa-solid fa-dumbbell' },
  { key: 'nutritionReminders', label: 'Nutrition Reminders', desc: 'Reminder to log your meals',              icon: 'fa-solid fa-utensils' },
  { key: 'weeklyReport',       label: 'Weekly Report',       desc: 'Summary of your week every Sunday',       icon: 'fa-solid fa-chart-bar' },
  { key: 'streakAlerts',       label: 'Streak Alerts',       desc: 'Alert when your streak is at risk',       icon: 'fa-solid fa-fire' },
  { key: 'coachMessages',      label: 'Coach Messages',      desc: 'In-app notification for coach notes',     icon: 'fa-solid fa-comments' },
  { key: 'productUpdates',     label: 'Product Updates',     desc: 'New features and announcements',          icon: 'fa-solid fa-rocket' },
]

const loadUserSettings = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/user-profile-settings`, { credentials: 'include' });
    if (!response.ok) return;
    const data = await response.json();
    applyProfileFromServer(data?.profile || {});
    const settings = data?.settings || {};
    const persistedDisplay = settings?.display || {};
    if (isAdmin.value) {
      display.language = persistedDisplay.language || display.language;
      display.dashboardLayout = persistedDisplay.dashboardLayout || display.dashboardLayout;
      display.startPage = persistedDisplay.startPage || display.startPage;
    }
  } catch (_) {
    // keep local fallback
  }
}

const isLikelyEmail = (value) => /@/.test(String(value || ''));

const toEmailUsername = (value) => {
  const str = String(value || '').trim();
  if (!str) return '';
  const at = str.indexOf('@');
  return at > 0 ? str.slice(0, at) : str;
};

const applyProfileFromServer = (serverProfile = {}) => {
  const firstName = String(serverProfile?.firstName || '').trim();
  const lastName = String(serverProfile?.lastName || '').trim();
  const emailCandidate = String(serverProfile?.email || '').trim();
  const usernameCandidate = String(serverProfile?.username || '').trim();

  const resolvedEmail = emailCandidate || (isLikelyEmail(usernameCandidate) ? usernameCandidate : '');
  const resolvedUsername = toEmailUsername(resolvedEmail || usernameCandidate);

  profile.firstName = firstName;
  profile.lastName = lastName;
  profile.email = resolvedEmail;
  profile.username = resolvedUsername;
  profile.avatarName = serverProfile?.avatarName || '';
  profile.avatarPath = serverProfile?.avatarPath || '';
};

// Avatar handling functions
const openAvatarModal = () => {
  showAvatarModal.value = true
}

const closeAvatarModal = () => {
  showAvatarModal.value = false
}

const handleAvatarSelected = (avatarData) => {
  // Update local profile state
  profile.avatarName = avatarData.avatarName
  profile.avatarPath = avatarData.avatarPath
  
  // Update auth store user state
  if (authStore.user?.value) {
    authStore.user.value.avatarName = avatarData.avatarName
    authStore.user.value.avatarPath = avatarData.avatarPath
  } else if (authStore.user) {
    authStore.user.avatarName = avatarData.avatarName
    authStore.user.avatarPath = avatarData.avatarPath
  }
  
  closeAvatarModal()
  successMsg.value = 'Avatar updated successfully!'
  setTimeout(() => { successMsg.value = '' }, 3000)
}

const getAvatarUrl = () => {
  const avatarPath = profile.avatarPath || '/images/avatar/default.png'
  return `${API_BASE}${avatarPath}`
}

const getInitials = () => {
  const firstInitial = profile.firstName?.[0] || ''
  const lastInitial = profile.lastName?.[0] || ''
  return `${firstInitial}${lastInitial}`.toUpperCase()
}

// ─── Goals ───────────────────────────────────────────────────────────────────
const goals = ref([])
const goalsLoading = ref(false)
const goalsError = ref('')
const goalsSuccess = ref('')
const goalFormOpen = ref(false)
const goalFormMode = ref('add')
const goalFormId = ref(null)
const goalFormBusy = ref(false)
const goalFormError = ref('')
const showPastGoals = ref(false)

const goalForm = reactive({
  goalType: 'body_weight',
  exerciseId: null,
  exerciseName: '',
  currentValue: '',
  targetValue: '',
  targetUnit: 'lb',
  targetDate: '',
})

const allExercises = ref([])
const exercisesLoaded = ref(false)
const exercisePickerOpen = ref(false)

const activeGoals = computed(() => goals.value.filter(g => g.status === 'active'))
const completedGoals = computed(() => goals.value.filter(g => g.status === 'completed'))
const archivedGoals = computed(() => goals.value.filter(g => g.status === 'archived'))

const loadGoals = async () => {
  goalsLoading.value = true
  goalsError.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/goals`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to load goals.')
    const data = await res.json()
    goals.value = Array.isArray(data.goals) ? data.goals : []
  } catch (e) {
    goalsError.value = e.message || 'Failed to load goals.'
  } finally {
    goalsLoading.value = false
  }
}

const loadAllExercises = async () => {
  if (exercisesLoaded.value) return
  try {
    const res = await fetch(`${API_BASE}/api/exercises?view=all`, { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    allExercises.value = Array.isArray(data) ? data : []
    exercisesLoaded.value = true
  } catch (_) {}
}

const openExercisePicker = () => {
  loadAllExercises()
  exercisePickerOpen.value = true
}

const handleExercisePickerAdd = (payload) => {
  const ex = Array.isArray(payload) ? payload[0] : payload
  if (!ex || !ex.ExerciseID) return
  goalForm.exerciseId = ex.ExerciseID
  goalForm.exerciseName = ex.ExerciseTitle
  exercisePickerOpen.value = false
}

const clearExercise = () => {
  goalForm.exerciseId = null
  goalForm.exerciseName = ''
}

const openAddGoal = () => {
  goalFormMode.value = 'add'
  goalFormId.value = null
  goalFormError.value = ''
  Object.assign(goalForm, {
    goalType: 'body_weight',
    exerciseId: null,
    exerciseName: '',
    currentValue: '',
    targetValue: '',
    targetUnit: 'lb',
    targetDate: '',
  })
  clearExercise()
  goalFormOpen.value = true
}

const openEditGoal = (goal) => {
  goalFormMode.value = 'edit'
  goalFormId.value = goal.id
  goalFormError.value = ''
  Object.assign(goalForm, {
    goalType: goal.goalType,
    exerciseId: goal.exerciseId,
    exerciseName: goal.exerciseName || '',
    currentValue: goal.currentValue ?? '',
    targetValue: goal.targetValue,
    targetUnit: goal.targetUnit,
    targetDate: goal.targetDate,
  })
  goalFormOpen.value = true
}

const closeGoalForm = () => {
  goalFormOpen.value = false
  goalFormError.value = ''
  clearExercise()
}

const submitGoalForm = async () => {
  goalFormError.value = ''
  if (!goalForm.targetValue || Number(goalForm.targetValue) <= 0) {
    goalFormError.value = 'Target value is required and must be greater than 0.'
    return
  }
  if (!goalForm.targetDate) {
    goalFormError.value = 'Target date is required.'
    return
  }
  if (goalForm.goalType === 'exercise_weight' && !goalForm.exerciseId) {
    goalFormError.value = 'Please select an exercise from the list.'
    return
  }
  goalFormBusy.value = true
  try {
    const body = {
      goalType: goalForm.goalType,
      targetValue: Number(goalForm.targetValue),
      targetUnit: goalForm.targetUnit,
      targetDate: goalForm.targetDate,
    }
    if (goalForm.currentValue !== '' && goalForm.currentValue != null) {
      body.currentValue = Number(goalForm.currentValue)
    }
    if (goalForm.goalType === 'exercise_weight') {
      body.exerciseId = goalForm.exerciseId
      body.exerciseName = goalForm.exerciseName
    }
    const url = goalFormMode.value === 'edit'
      ? `${API_BASE}/api/goals/${goalFormId.value}`
      : `${API_BASE}/api/goals`
    const method = goalFormMode.value === 'edit' ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save goal.')
    closeGoalForm()
    await loadGoals()
    goalsSuccess.value = goalFormMode.value === 'edit' ? 'Goal updated.' : 'Goal created.'
    setTimeout(() => { goalsSuccess.value = '' }, 3000)
  } catch (e) {
    goalFormError.value = e.message || 'Failed to save goal.'
  } finally {
    goalFormBusy.value = false
  }
}

const completeGoal = async (id) => {
  goalsError.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/goals/${id}/complete`, { method: 'PATCH', credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to complete goal.')
    await loadGoals()
    goalsSuccess.value = 'Goal marked as completed!'
    setTimeout(() => { goalsSuccess.value = '' }, 3000)
  } catch (e) { goalsError.value = e.message }
}

const archiveGoal = async (id) => {
  goalsError.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/goals/${id}/archive`, { method: 'PATCH', credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to archive goal.')
    await loadGoals()
    goalsSuccess.value = 'Goal archived.'
    setTimeout(() => { goalsSuccess.value = '' }, 3000)
  } catch (e) { goalsError.value = e.message }
}

const deleteGoal = async (id) => {
  if (!confirm('Delete this goal permanently?')) return
  goalsError.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/goals/${id}`, { method: 'DELETE', credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to delete goal.')
    await loadGoals()
    goalsSuccess.value = 'Goal deleted.'
    setTimeout(() => { goalsSuccess.value = '' }, 3000)
  } catch (e) { goalsError.value = e.message }
}

const formatGoalDate = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const goalDisplayText = (goal) => {
  if (goal.goalType === 'body_weight') {
    return `Reach ${goal.targetValue} ${goal.targetUnit}`
  }
  return `${goal.exerciseName || 'Exercise'} ${goal.targetValue} ${goal.targetUnit}`
}

onMounted(() => {
  const requestedTab = String(route.query?.tab || '').trim().toLowerCase();
  if (requestedTab && visibleTabs.value.some((tab) => String(tab.id || '').toLowerCase() === requestedTab)) {
    activeTab.value = requestedTab;
  }

  authStore.fetchUser()
  loadDisplayFromLocalStorage();
  loadUserSettings();
  loadGoals();
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

watch(
  () => isAdmin.value,
  (nextIsAdmin) => {
    if (!nextIsAdmin && activeTab.value === 'display') {
      activeTab.value = 'profile'
    }
  },
  { immediate: true }
)

watch(
  () => activeTab.value,
  (nextTab) => {
    if (!isAdmin.value && nextTab === 'display') {
      activeTab.value = 'profile'
    }
  }
)

watch(
  () => profile.email,
  (nextEmail) => {
    profile.username = toEmailUsername(nextEmail);
  }
)
</script>

<template>
  <div class="app-page-shell">
  <div class="app-page-canvas app-inner-shell settings-canvas">
  <div class="settings-page">

    <!-- Header -->
    <div class="settings-header ff-page-header app-header-gradient">
      <div>
        <h2 class="settings-title">Account Settings</h2>
        <p class="settings-subtitle">Manage your profile, fitness data and preferences</p>
      </div>
      <!-- Desktop save in header -->
      <button class="ff-btn-save ff-btn-save-desktop wa-btn--blue" :class="{ saving: saveStatus==='saving', saved: saveStatus==='saved' }" @click="save">
        <i v-if="saveStatus==='saving'" class="fa-solid fa-spinner fa-spin"></i>
        <i v-else-if="saveStatus==='saved'" class="fa-solid fa-check"></i>
        <i v-else class="fa-solid fa-floppy-disk"></i>
        {{ saveStatus==='saving' ? 'Saving...' : saveStatus==='saved' ? 'Saved!' : 'Save Changes' }}
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger mb-15">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success mb-15">{{ successMsg }}</div>

    <div class="settings-layout">

      <!-- Desktop sidebar nav -->
      <nav v-if="!isMobile" class="ff-settings-nav panel-bg">
        <button v-for="tab in visibleTabs" :key="tab.id"
          class="s-nav-item"
          :class="{ active: activeTab === tab.id, inactive: activeTab !== tab.id }"
          :aria-current="activeTab === tab.id ? 'page' : null"
          @click="activeTab = tab.id">
          <span class="s-nav-icon" :class="{ active: activeTab === tab.id, inactive: activeTab !== tab.id }">
            <i :class="tab.icon"></i>
          </span>
          <span class="s-nav-label">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Mobile dropdown nav -->
      <div v-if="isMobile" class="mobile-nav-dropdown">
        <button
          class="mobile-nav-trigger"
          :class="{ open: mobileMenuOpen }"
          @click="mobileMenuOpen = !mobileMenuOpen">
          <span class="mobile-nav-selected">
            <span class="mobile-nav-emoji">{{ tabEmoji[activeTab] }}</span>
            <span class="mobile-nav-label">{{ visibleTabs.find(t => t.id === activeTab)?.label }}</span>
          </span>
          <i class="fa-solid fa-chevron-down mobile-nav-chevron" :class="{ rotated: mobileMenuOpen }"></i>
        </button>
        <div class="mobile-nav-menu" :class="{ open: mobileMenuOpen }">
          <button
            v-for="(tab, idx) in visibleTabs"
            :key="tab.id"
            class="mobile-nav-item"
            :class="{ active: activeTab === tab.id, 'no-border': idx === visibleTabs.length - 1 }"
            @click="activeTab = tab.id; mobileMenuOpen = false">
            <span class="mobile-nav-item-emoji">{{ tabEmoji[tab.id] }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </div>
      </div>

      <!-- Main content -->
      <div class="settings-content">

        <!-- PROFILE TAB -->
        <section v-if="activeTab==='profile'" class="s-panel panel-bg">

          <!-- Centered profile header -->
          <div class="profile-header">
            <div class="profile-header__avatar">
              <div class="avatar-circle has-image">
                <img :src="getAvatarUrl()" alt="Profile avatar" class="profile-avatar" />
                <button class="avatar-cam" @click="openAvatarModal" title="Change avatar">
                  <i class="fa-solid fa-camera"></i>
                </button>
              </div>
            </div>
            <div class="profile-header__identity">
              <div class="avatar-name">{{ profile.firstName }} {{ profile.lastName }}</div>
              <div class="avatar-handle">@{{ profile.username }}</div>
              <div class="profile-meta">
                <span v-if="profile.email" class="profile-meta-pill">
                  <i class="fa-regular fa-envelope"></i>
                  {{ profile.email }}
                </span>
              </div>
              <span class="member-badge"><i class="fa-solid fa-crown"></i> Elite Member</span>
            </div>
            <div class="profile-header__actions">
              <button @click="openAvatarModal" class="change-avatar-btn wa-btn--blue">
                <i class="fa-solid fa-image"></i> Change Avatar
              </button>
            </div>
          </div>

          <!-- Basic Information -->
          <div class="settings-section">
            <h5 class="section-label">Basic Information</h5>
            <div class="settings-grid">
              <div class="ff-field">
                <label class="ff-label">First Name</label>
                <input v-model="profile.firstName" class="form-control ff-field-needs-update" type="text" placeholder="First name" />
              </div>
              <div class="ff-field">
                <label class="ff-label">Last Name</label>
                <input v-model="profile.lastName" class="form-control ff-field-needs-update" type="text" placeholder="Last name" />
              </div>
            </div>
          </div>

          <!-- Account Information -->
          <div class="settings-section">
            <h5 class="section-label">Account Information</h5>
            <div class="settings-grid">
              <div class="ff-field">
                <label class="ff-label">Username</label>
                <div class="input-group">
                  <span class="input-group-text">@</span>
                  <input v-model="profile.username" class="form-control ff-field-needs-update" type="text" placeholder="username" />
                </div>
              </div>
              <div class="ff-field">
                <label class="ff-label">Email Address</label>
                <input v-model="profile.email" class="form-control ff-field-needs-update" type="email" placeholder="email@example.com" />
              </div>
            </div>
          </div>

          <!-- Personal Information -->
          <div class="settings-section">
            <h5 class="section-label">Personal Information</h5>
            <div class="settings-grid">
              <div class="ff-field">
                <label class="ff-label">Phone Number</label>
                <input v-model="profile.phone" class="form-control ff-field-needs-update" type="tel" placeholder="+1 (555) 000-0000" />
              </div>
              <div class="ff-field">
                <label class="ff-label">Location</label>
                <input v-model="profile.location" class="form-control" type="text" placeholder="City, Country" />
              </div>
              <div class="ff-field">
                <label class="ff-label">Gender</label>
                <select v-model="profile.gender" class="form-select ff-field-needs-update">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not">Prefer not to say</option>
                </select>
              </div>
              <div class="ff-field">
                <label class="ff-label">Date of Birth</label>
                <input v-model="profile.dateOfBirth" class="form-control ff-field-needs-update ff-date-input" type="date" />
              </div>
            </div>
          </div>

          <!-- About Me -->
          <div class="settings-section">
            <h5 class="section-label">About Me</h5>
            <div class="ff-field bio-field">
              <label class="ff-label">Bio</label>
              <textarea v-model="profile.bio" class="form-control" rows="3" placeholder="Tell your coach and training partners about yourself..."></textarea>
            </div>
          </div>

          <!-- Mobile sticky save -->
          <div class="account-save-mobile">
            <button class="ff-btn-save" :class="{ saving: saveStatus==='saving', saved: saveStatus==='saved' }" @click="save">
              <i v-if="saveStatus==='saving'" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else-if="saveStatus==='saved'" class="fa-solid fa-check"></i>
              <i v-else class="fa-solid fa-floppy-disk"></i>
              {{ saveStatus==='saving' ? 'Saving...' : saveStatus==='saved' ? 'Saved!' : 'Save Changes' }}
            </button>
          </div>

        </section>

        <!-- FITNESS TAB -->
        <section v-if="activeTab==='fitness'" class="s-panel panel-bg">
          <div class="s-panel-head">
            <h4 class="s-panel-title">Fitness Profile</h4>
            <p class="s-panel-sub">Used to personalise your dashboard, recommendations and macros</p>
          </div>
          <div class="ff-field full-width mb-20">
            <label class="ff-label">Primary Goal</label>
            <div class="goal-grid">
              <button v-for="g in goalOptions" :key="g.value"
                class="goal-chip" :class="{ active: fitness.primaryGoal === g.value }"
                @click="fitness.primaryGoal = g.value">
                <i :class="g.icon"></i> {{ g.label }}
              </button>
            </div>
          </div>
          <div class="ff-form-grid">
            <div class="ff-field">
              <label class="ff-label">Current Weight</label>
              <div class="input-group">
                <input v-model="fitness.currentWeight" class="form-control" type="number" step="0.1" placeholder="0" />
                <span class="input-group-text">{{ fitness.preferredUnits === 'imperial' ? 'lbs' : 'kg' }}</span>
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Target Weight</label>
              <div class="input-group">
                <input v-model="fitness.targetWeight" class="form-control" type="number" step="0.1" placeholder="0" />
                <span class="input-group-text">{{ fitness.preferredUnits === 'imperial' ? 'lbs' : 'kg' }}</span>
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Height</label>
              <input v-model="fitness.height" class="form-control" type="text" placeholder="e.g. 5ft 10in" />
            </div>
            <div class="ff-field">
              <label class="ff-label">Resting Heart Rate</label>
              <div class="input-group">
                <input v-model="fitness.restingHR" class="form-control" type="number" placeholder="60" />
                <span class="input-group-text">bpm</span>
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Weekly Session Target</label>
              <div class="input-group">
                <input v-model="fitness.weeklyTarget" class="form-control" type="number" min="1" max="14" placeholder="4" />
                <span class="input-group-text">sessions</span>
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Measurement Units</label>
              <div class="unit-toggle">
                <button class="unit-btn" :class="{ active: fitness.preferredUnits==='imperial' }" @click="fitness.preferredUnits='imperial'">
                  <i class="fa-solid fa-flag-usa"></i> Imperial
                </button>
                <button class="unit-btn" :class="{ active: fitness.preferredUnits==='metric' }" @click="fitness.preferredUnits='metric'">
                  <i class="fa-solid fa-earth-europe"></i> Metric
                </button>
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Activity Level</label>
              <select v-model="fitness.activityLevel" class="form-select">
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly Active</option>
                <option value="intermediate">Intermediate</option>
                <option value="very_active">Very Active</option>
                <option value="athlete">Athlete</option>
              </select>
            </div>
            <div class="ff-field">
              <label class="ff-label">Experience Level</label>
              <select v-model="fitness.experienceLevel" class="form-select">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="elite">Elite / Competitive</option>
              </select>
            </div>
          </div>
        </section>

        <!-- NOTIFICATIONS TAB -->
        <section v-if="activeTab==='notifications'" class="s-panel panel-bg">
          <div class="s-panel-head">
            <h4 class="s-panel-title">Notifications</h4>
            <p class="s-panel-sub">Control what WorkoutAtlas notifies you about</p>
          </div>
          <div class="notif-list">
            <div v-for="item in notifOptions" :key="item.key" class="notif-row">
              <div class="notif-icon-box"><i :class="item.icon"></i></div>
              <div class="notif-text">
                <strong>{{ item.label }}</strong>
                <span>{{ item.desc }}</span>
              </div>
              <label class="ff-switch">
                <input type="checkbox" v-model="notifications[item.key]" />
                <span class="sw-track"><span class="sw-thumb"></span></span>
              </label>
            </div>
          </div>
        </section>

        <!-- DISPLAY TAB -->
        <section v-if="isAdmin && activeTab==='display'" class="s-panel panel-bg">
          <div class="s-panel-head">
            <h4 class="s-panel-title">Display and App</h4>
            <p class="s-panel-sub">Language and application preferences</p>
          </div>
          <div class="ff-form-grid">
            <div class="ff-field">
              <label class="ff-label">Language</label>
              <select v-model="display.language" class="form-select">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            <div class="ff-field">
              <label class="ff-label">Dashboard Layout</label>
              <select v-model="display.dashboardLayout" class="form-select">
                <option value="detailed">Detailed</option>
                <option value="compact">Compact</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div class="ff-field">
              <label class="ff-label">Default Start Page</label>
              <select v-model="display.startPage" class="form-select">
                <option value="dashboard">Dashboard</option>
                <option value="workouts">Workouts</option>
                <option value="nutrition">Nutrition</option>
              </select>
            </div>
          </div>
        </section>

        <!-- SECURITY TAB -->
        <section v-if="activeTab==='security'" class="s-panel panel-bg">
          <div class="s-panel-head">
            <h4 class="s-panel-title">Security</h4>
            <p class="s-panel-sub">Manage your password and account protection</p>
          </div>
          <div class="ff-form-grid mb-20">
            <div class="ff-field full-width">
              <label class="ff-label">Current Password</label>
              <input v-model="security.currentPassword" class="form-control" type="password" placeholder="Enter current password" />
            </div>
            <div class="ff-field">
              <label class="ff-label">New Password</label>
              <input v-model="security.newPassword" class="form-control" type="password" placeholder="Minimum 8 characters" />
            </div>
            <div class="ff-field">
              <label class="ff-label">Confirm New Password</label>
              <input v-model="security.confirmPassword" class="form-control" type="password" placeholder="Re-enter new password" />
            </div>
          </div>
          <div class="notif-row twofa-row">
            <div class="notif-icon-box"><i class="fa-solid fa-mobile-screen"></i></div>
            <div class="notif-text">
              <strong>Two-Factor Authentication</strong>
              <span>Add an extra layer of security to your account</span>
            </div>
            <label class="ff-switch">
              <input type="checkbox" v-model="security.twoFactor" />
              <span class="sw-track"><span class="sw-thumb"></span></span>
            </label>
          </div>
          <div class="danger-zone mt-25">
            <div class="danger-inner">
              <div>
                <h5 class="danger-title"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone</h5>
                <p class="danger-desc">Permanently delete your account and all associated data. This cannot be undone.</p>
              </div>
              <button class="btn-delete-account wa-btn--red">Delete Account</button>
            </div>
          </div>
        </section>

        <!-- GOALS TAB -->
        <section v-if="activeTab==='goals'" class="s-panel panel-bg">
          <div class="goals-panel-head">
            <div>
              <h4 class="s-panel-title">My Goals</h4>
              <p class="s-panel-sub">Track your body weight and exercise weight targets</p>
            </div>
            <button v-if="!goalFormOpen" class="btn-add-goal wa-btn--green" @click="openAddGoal">
              <i class="fa-solid fa-plus"></i> Add Goal
            </button>
          </div>

          <!-- Add / Edit form -->
          <div v-if="goalFormOpen" class="goal-form-panel">
            <div class="goal-form-header">
              <h5>{{ goalFormMode === 'edit' ? 'Edit Goal' : 'New Goal' }}</h5>
              <button class="goal-form-close" @click="closeGoalForm" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <!-- Type selector (add only) -->
            <div v-if="goalFormMode === 'add'" class="goal-type-row">
              <button class="goal-type-btn" :class="{ active: goalForm.goalType === 'body_weight' }" @click="goalForm.goalType = 'body_weight'; clearExercise()">
                <i class="fa-solid fa-weight-scale"></i> Body Weight
              </button>
              <button class="goal-type-btn" :class="{ active: goalForm.goalType === 'exercise_weight' }" @click="goalForm.goalType = 'exercise_weight'; loadAllExercises()">
                <i class="fa-solid fa-dumbbell"></i> Exercise Weight
              </button>
            </div>

            <!-- Exercise picker -->
            <div v-if="goalForm.goalType === 'exercise_weight'" class="goal-form-field mb-12">
              <label class="ff-label">Exercise</label>
              <div v-if="!goalForm.exerciseId" class="ex-pick-btn-wrap">
                <button type="button" class="btn-pick-exercise" @click="openExercisePicker">
                  <i class="fa-solid fa-magnifying-glass"></i> Choose Exercise...
                </button>
              </div>
              <div v-else class="ex-selected-row">
                <div class="ex-selected-info">
                  <i class="fa-solid fa-dumbbell"></i>
                  <span>{{ goalForm.exerciseName }}</span>
                </div>
                <button type="button" class="ex-change-btn" @click="openExercisePicker">Change</button>
                <button type="button" class="ex-clear-btn-icon" @click="clearExercise" title="Remove">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            <!-- Value + date grid -->
            <div class="goal-form-grid">
              <div class="goal-form-field">
                <label class="ff-label">Current Value <span style="opacity:.6;text-transform:none;letter-spacing:0">(optional)</span></label>
                <div class="input-group">
                  <input v-model="goalForm.currentValue" class="form-control" type="number" step="0.1" min="0" placeholder="0" />
                  <span class="input-group-text">{{ goalForm.targetUnit }}</span>
                </div>
              </div>
              <div class="goal-form-field">
                <label class="ff-label">Target Value</label>
                <div class="input-group">
                  <input v-model="goalForm.targetValue" class="form-control" type="number" step="0.1" min="0.1" placeholder="0" />
                  <span class="input-group-text">{{ goalForm.targetUnit }}</span>
                </div>
              </div>
              <div class="goal-form-field">
                <label class="ff-label">Target Date</label>
                <input v-model="goalForm.targetDate" class="form-control ff-date-input" type="date" />
              </div>
              <div class="goal-form-field">
                <label class="ff-label">Unit</label>
                <div class="unit-toggle">
                  <button class="unit-btn" :class="{ active: goalForm.targetUnit==='lb' }" @click="goalForm.targetUnit='lb'">lb</button>
                  <button class="unit-btn" :class="{ active: goalForm.targetUnit==='kg' }" @click="goalForm.targetUnit='kg'">kg</button>
                </div>
              </div>
            </div>

            <div v-if="goalFormError" class="goal-form-error">{{ goalFormError }}</div>

            <div class="goal-form-actions">
              <button class="btn-goal-cancel" @click="closeGoalForm">Cancel</button>
              <button class="btn-goal-save" @click="submitGoalForm" :disabled="goalFormBusy">
                <i v-if="goalFormBusy" class="fa-solid fa-spinner fa-spin"></i>
                <i v-else class="fa-solid fa-check"></i>
                {{ goalFormMode === 'edit' ? 'Save Changes' : 'Create Goal' }}
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="goalsLoading" class="goals-loading">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading goals...
          </div>

          <!-- Empty state -->
          <div v-else-if="!goalsLoading && activeGoals.length === 0 && !goalFormOpen" class="goals-empty">
            <i class="fa-solid fa-bullseye"></i>
            <p>No active goals yet. Tap <strong>Add Goal</strong> to get started.</p>
          </div>

          <!-- Active goals -->
          <div v-if="activeGoals.length > 0" class="goals-list">
            <div v-for="goal in activeGoals" :key="goal.id" class="goal-card">
              <div class="goal-icon" :class="goal.goalType === 'body_weight' ? 'goal-icon--bw' : 'goal-icon--ex'">
                <i :class="goal.goalType === 'body_weight' ? 'fa-solid fa-weight-scale' : 'fa-solid fa-dumbbell'"></i>
              </div>
              <div class="goal-card-body">
                <div class="goal-card-title">{{ goalDisplayText(goal) }}</div>
                <div class="goal-card-meta">
                  <span v-if="goal.currentValue != null"><i class="fa-solid fa-arrow-trend-up"></i> {{ goal.currentValue }} {{ goal.targetUnit }}</span>
                  <span><i class="fa-regular fa-calendar"></i> {{ formatGoalDate(goal.targetDate) }}</span>
                </div>
              </div>
              <div class="goal-card-actions">
                <button class="goal-btn goal-btn--edit" @click="openEditGoal(goal)" title="Edit goal">
                  <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button class="goal-btn goal-btn--complete" @click="completeGoal(goal.id)" title="Mark complete">
                  <i class="fa-solid fa-circle-check"></i>
                </button>
                <button class="goal-btn goal-btn--archive" @click="archiveGoal(goal.id)" title="Archive goal">
                  <i class="fa-regular fa-folder-closed"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Past goals (collapsed) -->
          <div v-if="completedGoals.length > 0 || archivedGoals.length > 0" class="goals-past-section">
            <button class="goals-past-toggle" @click="showPastGoals = !showPastGoals">
              <i :class="showPastGoals ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i>
              Past Goals ({{ completedGoals.length + archivedGoals.length }})
            </button>
            <div v-if="showPastGoals" class="goals-list goals-list--past">
              <div v-for="goal in [...completedGoals, ...archivedGoals]" :key="goal.id" class="goal-card goal-card--past">
                <div class="goal-icon" :class="goal.status === 'completed' ? 'goal-icon--done' : 'goal-icon--arch'">
                  <i :class="goal.status === 'completed' ? 'fa-solid fa-trophy' : 'fa-regular fa-folder-closed'"></i>
                </div>
                <div class="goal-card-body">
                  <div class="goal-card-title">{{ goalDisplayText(goal) }}</div>
                  <div class="goal-card-meta">
                    <span class="goal-badge" :class="'goal-badge--' + goal.status">{{ goal.status }}</span>
                    <span v-if="goal.completedAt"><i class="fa-solid fa-check"></i> {{ formatGoalDate(goal.completedAt.slice(0,10)) }}</span>
                  </div>
                </div>
                <div class="goal-card-actions">
                  <button class="goal-btn goal-btn--delete" @click="deleteGoal(goal.id)" title="Delete permanently">
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="goalsSuccess" class="goal-msg goal-msg--ok">{{ goalsSuccess }}</div>
          <div v-if="goalsError" class="goal-msg goal-msg--err">{{ goalsError }}</div>
        </section>

      </div>
    </div>
  </div>
  </div>
  </div>

  <!-- Avatar Selection Modal -->
  <AvatarModal 
    v-if="showAvatarModal" 
    @close="closeAvatarModal" 
    @avatar-selected="handleAvatarSelected" 
  />

  <!-- Exercise Picker Modal (Goals) -->
  <ExercisePickerModal
    :is-open="exercisePickerOpen"
    :exercises="allExercises"
    :user-id="authStore.user?.value?.id ?? authStore.user?.id"
    @close="exercisePickerOpen = false"
    @add="handleExercisePickerAdd"
  />
</template>

<style scoped>
.settings-page {
  --ff-surface-1: var(--wa-shell-surface, #121923);
  --ff-surface-2: var(--wa-shell-surface-elevated, #17212d);
  --ff-surface-3: var(--wa-shell-surface-soft, #1d2a38);
  --ff-text: var(--wa-shell-text, #f8fafc);
  --ff-text-secondary: var(--wa-shell-text-secondary, #a4b0c0);
  --ff-text-muted: var(--wa-shell-text-muted, #738196);
  --ff-accent: var(--wa-shell-accent, var(--main-color, #3b82f6));
  --ff-border-strong: rgba(148, 163, 184, 0.44);
  --ff-border-soft: rgba(148, 163, 184, 0.32);
  padding: 0;
  color: var(--ff-text);
}

.settings-page .panel-bg {
  background: var(--ff-surface-1) !important;
}

.settings-page .settings-header.ff-page-header.app-header-gradient {
  background: linear-gradient(135deg, #0f2561 0%, #112463 42%, #1b2444 100%) !important;
  border-color: rgba(120, 145, 175, 0.24);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

.settings-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px;
  border: 1.5px solid var(--ff-border-strong);
  padding: 14px 18px;
  min-height: auto;
}
.settings-title { font-size: 1.45rem; font-weight: 700; margin: 0; color: #ffffff !important; }
.settings-subtitle { font-size: .83rem; opacity: .92; margin: 3px 0 0; color: var(--ff-text-secondary) !important; font-weight: 500; }

.ff-btn-save {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px; border-radius: 8px; border: none;
  background: #2081e2; color: #fff; font-size: .88rem; font-weight: 600;
  cursor: pointer; transition: background .2s, transform .1s;
}
.ff-btn-save:hover  { background: #176bbf; }
.ff-btn-save:active { transform: scale(.97); }
.ff-btn-save.saving { background: #555; }
.ff-btn-save.saved  { background: #16a34a; }

.settings-layout { display: flex; gap: 20px; align-items: flex-start; }

.ff-settings-nav {
  display: flex; flex-direction: column; gap: 3px;
  width: 186px; flex-shrink: 0;
  border-radius: 12px; padding: 10px 8px;
  border: 1.5px solid var(--ff-border-strong);
  background: var(--ff-surface-1);
}
.s-nav-item {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 13px; border-radius: 8px; border: none;
  background: transparent; color: var(--ff-text-secondary);
  font-size: .85rem; font-weight: 500; cursor: pointer;
  text-align: left; width: 100%;
  transition: background .15s, color .15s, border-color .15s;
}
.s-nav-item .s-nav-label,
.s-nav-item i { color: var(--ff-text-secondary) !important; }
.s-nav-icon {
  width: 30px; height: 30px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  background: var(--ff-surface-2); font-size: .8rem;
  color: var(--ff-text-muted);
  flex-shrink: 0; transition: background .15s;
}
.s-nav-item:hover .s-nav-icon,
.s-nav-item.active .s-nav-icon { background: color-mix(in srgb, var(--ff-accent) 16%, var(--ff-surface-2) 84%); color: #60a5fa; }
.s-nav-item:hover  {
  color: var(--ff-text);
  background: var(--ff-surface-2);
}
.s-nav-item.active {
  color: var(--ff-text);
  font-weight: 600;
  background: color-mix(in srgb, var(--ff-accent) 14%, var(--ff-surface-2) 86%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ff-accent) 32%, transparent 68%);
}

.settings-content { flex: 1; min-width: 0; }
.s-panel {
  border-radius: 14px;
  padding: 26px 28px;
  border: 1.5px solid var(--ff-border-strong);
  background: var(--ff-surface-1);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}
.s-panel-head {
  margin-bottom: 22px; padding-bottom: 16px;
  border-bottom: 1.5px solid var(--ff-border-soft);
}
.s-panel-title { font-size: 1rem; font-weight: 700; margin: 0 0 3px; color: var(--ff-text); }
.s-panel-sub   { font-size: .8rem; opacity: .96; margin: 0; color: var(--ff-text-secondary); font-weight: 500; }

.avatar-row { display: flex; align-items: center; gap: 18px; }
.avatar-circle {
  position: relative; width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #2081e2 0%, #7c3aed 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; font-weight: 700; color: #fff; flex-shrink: 0;
}
.avatar-circle.has-image {
  padding: 0;
  background: none;
}
.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.avatar-initials {
  font-size: 2rem;
  font-weight: 600;
  color: #fff;
}
.avatar-cam {
  position: absolute; bottom: 0; right: 0;
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid transparent; background: #2081e2; color: #fff;
  font-size: .58rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.change-avatar-btn {
  margin-top: 8px;
  padding: 6px 12px;
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border-soft);
  color: var(--ff-text-secondary);
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.change-avatar-btn:hover {
  background: var(--ff-surface-3);
  color: var(--ff-text);
}
.avatar-name   { font-size: 1rem; font-weight: 700; color: var(--ff-text); }
.avatar-handle { font-size: .8rem; opacity: .96; margin-top: 2px; color: var(--ff-text-secondary); font-weight: 500; }
.member-badge {
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 7px; padding: 3px 11px; border-radius: 20px;
  background: linear-gradient(90deg,#f59e0b,#f97316);
  color: #fff; font-size: .72rem; font-weight: 700;
}

.ff-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 22px; }
.ff-field  { display: flex; flex-direction: column; gap: 6px; }
.ff-field.full-width { grid-column: 1 / -1; }
.ff-label  { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; opacity: .75; color: var(--ff-text-secondary); margin-bottom: 4px; }

/* ── Centered profile header ── */
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding-bottom: 16px;
  margin-bottom: 4px;
  border-bottom: 1.5px solid var(--ff-border-soft);
}

.profile-avatar {
  width: 76px;
  height: 76px;
  object-fit: cover;
  border-radius: 50%;
}

.profile-header .avatar-circle {
  width: 76px;
  height: 76px;
}

.profile-header .member-badge {
  margin-top: 2px;
}

.profile-header .change-avatar-btn {
  margin-top: 4px;
  font-size: 0.78rem;
  padding: 5px 14px;
}

/* ── Settings sections (grouped cards) ── */
.settings-section {
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border-soft);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}

.settings-section:last-of-type {
  margin-bottom: 0;
}

.section-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2563eb;
  margin: 0 0 10px;
  opacity: 0.9;
}

/* ── Settings grid (2-col desktop, 1-col mobile) ── */
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.bio-field {
  grid-column: 1 / -1;
}

/* ── Sticky mobile save ── */
.account-save-mobile {
  margin-top: 16px;
  width: 100%;
}

.account-save-mobile .ff-btn-save {
  width: 100%;
  height: 48px;
  justify-content: center;
  border-radius: 12px;
  font-size: 0.95rem;
}

/* Desktop: hide account-save-mobile, show header save */
@media (min-width: 769px) {
  .account-save-mobile { display: none; }
  .ff-btn-save-desktop { display: inline-flex; }
}

/* Mobile: hide desktop save, show sticky bottom */
@media (max-width: 768px) {
  .ff-btn-save-desktop { display: none !important; }
  .account-save-mobile {
    position: sticky;
    bottom: 12px;
    z-index: 20;
    background: transparent;
  }
  .account-save-mobile .ff-btn-save {
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
  }
}

.ff-check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: .86rem;
  color: var(--ff-text);
}

.ff-check-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.form-control, .form-select {
  background-color: var(--ff-surface-3) !important;
  border: 1.5px solid var(--ff-border-soft) !important;
  color: var(--ff-text) !important;
  font-weight: 500;
}
.form-control:focus, .form-select:focus {
  background-color: color-mix(in srgb, var(--ff-surface-3) 86%, #ffffff 14%) !important;
  border-color: var(--ff-accent) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ff-accent) 24%, transparent 76%) !important;
  color: var(--ff-text) !important;
}
.input-group-text {
  background-color: var(--ff-surface-2) !important;
  border: 1.5px solid var(--ff-border-soft) !important;
  color: var(--ff-text-muted) !important;
}

.goal-grid { display: flex; flex-wrap: wrap; gap: 9px; }
.goal-chip {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: 40px;
  border: 1.5px solid var(--ff-border-soft);
  background: rgba(255,255,255,.05); color: inherit;
  font-size: .82rem; cursor: pointer; transition: all .18s;
}
.goal-chip:hover  { border-color: #2081e2; color: #2081e2; background: rgba(32,129,226,.1); }
.goal-chip.active { border-color: #2081e2; background: rgba(32,129,226,.2); color: #2081e2; font-weight: 600; }

.unit-toggle { display: flex; border-radius: 8px; overflow: hidden; border: 1.5px solid var(--ff-border-soft); }
.unit-btn {
  flex: 1; padding: 9px; border: none; background: transparent;
  color: inherit; font-size: .85rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: background .15s;
}
.unit-btn.active { background: rgba(32,129,226,.25); color: #2081e2; font-weight: 600; }

.theme-tiles { display: flex; gap: 12px; }
.theme-tile {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 18px 10px; border-radius: 12px;
  border: 2px solid var(--ff-border-soft); background: rgba(255,255,255,.04);
  color: inherit; font-size: .82rem; cursor: pointer; transition: all .18s;
}
.theme-tile i { font-size: 1.4rem; }
.theme-tile.active { border-color: #2081e2; background: rgba(32,129,226,.18); color: #2081e2; font-weight: 600; }

.notif-list { display: flex; flex-direction: column; gap: 3px; }
.notif-row {
  display: flex; align-items: center; gap: 14px;
  padding: 13px 14px; border-radius: 10px;
  border: 1.5px solid var(--ff-border-soft); transition: background .15s, border-color .15s;
}
.notif-row:hover { background: rgba(255,255,255,.04); border-color: var(--ff-border-strong); }
.twofa-row { border: 1.5px solid var(--ff-border-strong) !important; background: rgba(255,255,255,.03); }
.notif-icon-box {
  width: 38px; height: 38px; border-radius: 9px;
  background: rgba(32,129,226,.18); color: #2081e2;
  display: flex; align-items: center; justify-content: center;
  font-size: .9rem; flex-shrink: 0;
}
.notif-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.notif-text strong { font-size: .88rem; font-weight: 700; color: var(--ff-text); }
.notif-text span   { font-size: .76rem; opacity: .96; color: var(--ff-text-secondary); }

.ff-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; cursor: pointer; display: inline-block; }
.ff-switch input { opacity: 0; width: 0; height: 0; }
.sw-track { position: absolute; inset: 0; border-radius: 34px; background: rgba(255,255,255,.15); transition: background .25s; }
.ff-switch input:checked + .sw-track { background: #2081e2; }
.sw-thumb { position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; border-radius: 50%; background: #fff; transition: transform .25s; }
.ff-switch input:checked + .sw-track .sw-thumb { transform: translateX(20px); }

/* Fields that need updating - lighter background */
.ff-field-needs-update {
  background-color: rgba(100, 116, 139, 0.08) !important;
  border: 1.5px solid rgba(100, 116, 139, 0.18) !important;
}
.ff-field-needs-update:focus {
  background-color: rgba(100, 116, 139, 0.12) !important;
  border-color: rgba(100, 116, 139, 0.28) !important;
}

:global(body.light-theme) .ff-field-needs-update {
  background-color: rgba(15, 23, 42, 0.06) !important;
  border: 1.5px solid rgba(15, 23, 42, 0.18) !important;
}
:global(body.light-theme) .ff-field-needs-update:focus {
  background-color: rgba(15, 23, 42, 0.12) !important;
  border-color: rgba(15, 23, 42, 0.28) !important;
}

.danger-zone { border-radius: 12px; border: 1.5px solid rgba(239,68,68,.42); background: rgba(239,68,68,.07); padding: 20px 22px; }
.danger-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.danger-title { font-size: .92rem; font-weight: 700; color: #ef4444; margin: 0 0 4px; }
.danger-desc  { font-size: .8rem; opacity: .86; margin: 0; }
.btn-delete-account {
  padding: 8px 18px; border-radius: 8px;
  border: 1px solid #ef4444; background: transparent;
  color: #ef4444; font-size: .84rem; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: background .2s, color .2s;
}
.btn-delete-account:hover { background: #ef4444; color: #fff; }

:global(body.light-theme) .settings-page,
:global(body.light-theme) .settings-page h2,
:global(body.light-theme) .settings-page h3,
:global(body.light-theme) .settings-page h4,
:global(body.light-theme) .settings-page h5,
:global(body.light-theme) .settings-page p,
:global(body.light-theme) .settings-page span,
:global(body.light-theme) .settings-page small,
:global(body.light-theme) .settings-page strong,
:global(body.light-theme) .settings-page label,
:global(body.light-theme) .settings-page .s-nav-item,
:global(body.light-theme) .settings-page .settings-subtitle,
:global(body.light-theme) .settings-page .s-panel-sub,
:global(body.light-theme) .settings-page .avatar-handle,
:global(body.light-theme) .settings-page .notif-text span,
:global(body.light-theme) .settings-page .danger-desc,
:global(body.light-theme) .settings-page a,
:global(body.light-theme) .settings-page a:visited {
  color: #797979 !important;
  opacity: 1;
}

:global(body.light-theme) .settings-page {
  --ff-border-strong: rgba(15, 23, 42, .28);
  --ff-border-soft: rgba(15, 23, 42, .22);
}

:global(body.light-theme) .settings-page a:hover {
  color: #797979 !important;
}

/* Override all sidebar-related colors in light theme */
:global(body.light-theme) .sidebar-txt,
:global(body.light-theme) .sidebar-link,
:global(body.light-theme) .sidebar-link .sidebar-txt {
  color: #797979 !important;
}

:global(body.light-theme) .settings-page .s-nav-item,
:global(body.light-theme) .settings-page .s-nav-item .s-nav-label,
:global(body.light-theme) .settings-page .s-nav-icon,
:global(body.light-theme) .settings-page .s-nav-icon i {
  color: #334155 !important;
  opacity: 1 !important;
}

:global(body.light-theme) .settings-page .s-nav-item:hover,
:global(body.light-theme) .settings-page .s-nav-item.active {
  color: #1e3a8a !important;
}

:global(body.light-theme) .settings-page .s-nav-item:hover .s-nav-icon,
:global(body.light-theme) .settings-page .s-nav-item.active .s-nav-icon,
:global(body.light-theme) .settings-page .s-nav-item:hover .s-nav-icon i,
:global(body.light-theme) .settings-page .s-nav-item.active .s-nav-icon i {
  color: #1e3a8a !important;
}

/* Account Settings submenu contrast improvements */
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item {
  color: #4b5563 !important;
  font-weight: 500;
  background: transparent;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item .s-nav-label,
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item i {
  color: #4b5563 !important;
  font-weight: 500;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-icon {
  background: rgba(100, 116, 139, .15);
  color: #64748b !important;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-icon i {
  color: #64748b !important;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item:hover {
  background: #f8fafc;
  color: #374151 !important;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item:hover .s-nav-label,
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item:hover i {
  color: #374151 !important;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item:hover .s-nav-icon {
  background: rgba(59, 130, 246, .16);
  color: #334155 !important;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item:hover .s-nav-icon i {
  color: #334155 !important;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active {
  background: #eff6ff;
  color: #1d4ed8 !important;
  font-weight: 600;
  box-shadow: inset 0 0 0 1.5px #3b82f6;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active .s-nav-label,
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active i {
  color: #1d4ed8 !important;
  font-weight: 600;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active .s-nav-icon {
  background: rgba(59, 130, 246, .22);
  color: #1d4ed8 !important;
}

:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active .s-nav-icon i {
  color: #1d4ed8 !important;
}

:global(body.light-theme) .s-panel,
:global(body.light-theme) .ff-settings-nav {
  border: 1.5px solid rgba(15, 23, 42, .24);
}

.ff-settings-nav .s-nav-item {
  color: var(--ff-text-secondary) !important;
  background: transparent !important;
  opacity: 1 !important;
}

.ff-settings-nav .s-nav-item .s-nav-label,
.ff-settings-nav .s-nav-item i {
  color: var(--ff-text-secondary) !important;
  opacity: 1 !important;
}

.ff-settings-nav .s-nav-item.active {
  background: color-mix(in srgb, var(--ff-accent) 14%, var(--ff-surface-2) 86%) !important;
  color: var(--ff-text) !important;
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ff-accent) 46%, transparent 54%);
}

.ff-settings-nav .s-nav-item.active .s-nav-label,
.ff-settings-nav .s-nav-item.active i {
  color: #60a5fa !important;
  font-weight: 700;
  opacity: 1 !important;
}

.ff-settings-nav .s-nav-icon {
  background: var(--ff-surface-2) !important;
}

.ff-settings-nav .s-nav-item.active .s-nav-icon {
  background: color-mix(in srgb, var(--ff-accent) 16%, var(--ff-surface-2) 84%) !important;
}

:global(body.light-theme) .settings-section {
  background: rgba(0,0,0,0.02);
  border-color: rgba(15, 23, 42, .18);
}

:global(body.light-theme) .ff-label { opacity: .65; color: #374151; }

:global(body.light-theme) .s-panel-head { border-bottom-color: rgba(15, 23, 42, .24); }
:global(body.light-theme) .s-nav-icon   { background: rgba(0,0,0,.06); }

/* ── Goals tab ──────────────────────────────────────────────────────────────── */
.goals-panel-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; margin-bottom: 18px; padding-bottom: 16px;
  border-bottom: 1.5px solid var(--ff-border-soft);
  flex-wrap: wrap;
}
.btn-add-goal {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 18px; border-radius: 8px; border: none;
  background: #2081e2; color: #fff; font-size: .85rem; font-weight: 600;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: background .2s;
}
.btn-add-goal:hover { background: #176bbf; }

/* form panel */
.goal-form-panel {
  background: var(--ff-surface-2);
  border: 1.5px solid var(--ff-border-strong);
  border-radius: 12px; padding: 18px 20px; margin-bottom: 18px;
}
.goal-form-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.goal-form-header h5 { margin: 0; font-size: .95rem; font-weight: 700; color: var(--ff-text); }
.goal-form-close {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: rgba(255,255,255,.08); color: var(--ff-text-secondary);
  cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .8rem;
  transition: background .15s, color .15s;
}
.goal-form-close:hover { background: rgba(239,68,68,.2); color: #ef4444; }

/* type buttons */
.goal-type-row { display: flex; gap: 9px; margin-bottom: 14px; }
.goal-type-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 14px; border-radius: 8px;
  border: 1.5px solid var(--ff-border-soft);
  background: rgba(255,255,255,.04); color: var(--ff-text-secondary);
  font-size: .86rem; font-weight: 500; cursor: pointer; transition: all .18s;
}
.goal-type-btn:hover { border-color: #2081e2; color: #2081e2; background: rgba(32,129,226,.08); }
.goal-type-btn.active { border-color: #2081e2; background: rgba(32,129,226,.18); color: #2081e2; font-weight: 700; }

/* form grid */
.goal-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin-bottom: 14px; }
.goal-form-field { display: flex; flex-direction: column; gap: 5px; }
.mb-12 { margin-bottom: 12px; }

/* exercise search */
.ex-search-wrap { position: relative; display: flex; align-items: center; }
.ex-search-wrap .form-control { padding-right: 34px; }
.ex-clear-btn {
  position: absolute; right: 8px; background: transparent; border: none;
  color: var(--ff-text-secondary); cursor: pointer; padding: 4px; font-size: .8rem;
  display: flex; align-items: center;
}
.ex-clear-btn:hover { color: #ef4444; }
.ex-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
  background: var(--ff-surface-2); border: 1.5px solid var(--ff-border-strong);
  border-radius: 8px; overflow: hidden; max-height: 220px; overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
}
.ex-search-wrap { position: relative; }
.ex-dropdown-item {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px; border: none; background: transparent;
  color: var(--ff-text); font-size: .86rem; cursor: pointer;
  border-bottom: 1px solid var(--ff-border-soft); text-align: left;
  transition: background .12s;
}
.ex-dropdown-item:last-child { border-bottom: none; }
.ex-dropdown-item:hover { background: rgba(32,129,226,.12); }
.ex-name { font-weight: 500; }
.ex-muscle { font-size: .74rem; color: var(--ff-text-muted); }

/* form actions */
.goal-form-actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-goal-cancel {
  padding: 9px 18px; border-radius: 8px; font-size: .85rem; font-weight: 600;
  border: 1.5px solid var(--ff-border-soft); background: transparent;
  color: var(--ff-text-secondary); cursor: pointer; transition: all .18s;
}
.btn-goal-cancel:hover { border-color: var(--ff-border-strong); color: var(--ff-text); }
.btn-goal-save {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 20px; border-radius: 8px; border: none;
  background: #16a34a; color: #fff; font-size: .85rem; font-weight: 600;
  cursor: pointer; transition: background .2s;
}
.btn-goal-save:hover:not(:disabled) { background: #15803d; }
.btn-goal-save:disabled { opacity: .6; cursor: not-allowed; }
.goal-form-error {
  padding: 8px 12px; border-radius: 6px;
  background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3);
  color: #f87171; font-size: .82rem; margin-bottom: 12px;
}

/* goals list */
.goals-loading, .goals-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 32px 16px; color: var(--ff-text-secondary); font-size: .9rem;
  text-align: center;
}
.goals-empty i { font-size: 2rem; opacity: .3; }
.goals-empty p { margin: 0; }
.goals-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.goal-card {
  display: flex; align-items: center; gap: 13px;
  padding: 13px 14px; border-radius: 10px;
  background: var(--ff-surface-2); border: 1.5px solid var(--ff-border-soft);
  transition: border-color .15s;
}
.goal-card:hover { border-color: var(--ff-border-strong); }
.goal-card--past { opacity: .65; }
.goal-card--past:hover { opacity: .9; }

/* goal icon */
.goal-icon {
  width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: .88rem;
}
.goal-icon--bw   { background: rgba(59,130,246,.18); color: #60a5fa; }
.goal-icon--ex   { background: rgba(168,85,247,.18); color: #c084fc; }
.goal-icon--done { background: rgba(22,163,74,.18);  color: #4ade80; }
.goal-icon--arch { background: rgba(100,116,139,.15); color: #94a3b8; }

.goal-card-body  { flex: 1; min-width: 0; }
.goal-card-title { font-size: .9rem; font-weight: 700; color: var(--ff-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.goal-card-meta  { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 3px; }
.goal-card-meta span { font-size: .76rem; color: var(--ff-text-secondary); display: flex; align-items: center; gap: 4px; }

/* action buttons */
.goal-card-actions { display: flex; gap: 5px; flex-shrink: 0; }
.goal-btn {
  width: 32px; height: 32px; border-radius: 7px; border: none;
  display: flex; align-items: center; justify-content: center;
  font-size: .82rem; cursor: pointer; transition: background .15s, color .15s;
  color: #fff;
}
.goal-btn--edit    { background: #2563eb; }
.goal-btn--edit:hover { background: #1d4ed8; }
.goal-btn--complete { background: #16a34a; }
.goal-btn--complete:hover { background: #15803d; }
.goal-btn--archive  { background: #64748b; }
.goal-btn--archive:hover { background: #475569; }
.goal-btn--delete   { background: #dc2626; }
.goal-btn--delete:hover  { background: #b91c1c; }

/* past goals toggle */
.goals-past-section { margin-top: 8px; }
.goals-past-toggle {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 4px; background: transparent; border: none;
  color: var(--ff-text-secondary); font-size: .82rem; font-weight: 600;
  cursor: pointer; transition: color .15s; text-transform: uppercase; letter-spacing: .04em;
}
.goals-past-toggle:hover { color: var(--ff-text); }
.goals-past-toggle i { font-size: .7rem; }
.goals-list--past { margin-top: 8px; }

/* badge */
.goal-badge { padding: 2px 9px; border-radius: 20px; font-size: .71rem; font-weight: 700; text-transform: capitalize; }
.goal-badge--completed { background: rgba(22,163,74,.18); color: #4ade80; }
.goal-badge--archived  { background: rgba(100,116,139,.18); color: #94a3b8; }

/* messages */
.goal-msg { padding: 9px 13px; border-radius: 8px; font-size: .84rem; margin-top: 12px; }
.goal-msg--ok  { background: rgba(22,163,74,.12); border: 1px solid rgba(22,163,74,.3); color: #4ade80; }
.goal-msg--err { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #f87171; }

@media (max-width: 600px) {
  .goal-form-grid { grid-template-columns: 1fr; }
  .goal-type-row { flex-direction: column; }
  .goal-card-title { font-size: .84rem; }
}
:global(body.light-theme) .goal-chip    { border-color: rgba(0,0,0,.2); background: #fff; }
:global(body.light-theme) .unit-toggle  { border-color: rgba(0,0,0,.2); }
:global(body.light-theme) .theme-tile   { border-color: rgba(0,0,0,.2); background: #fff; }
:global(body.light-theme) .twofa-row    { border-color: rgba(0,0,0,.2) !important; background: rgba(0,0,0,.02); }
:global(body.light-theme) .notif-row:hover { background: rgba(0,0,0,.03); border-color: rgba(0,0,0,.16); }
:global(body.light-theme) .form-control,
:global(body.light-theme) .form-select  {
  background-color: #fff !important;
  border: 1.5px solid rgba(0,0,0,.24) !important;
  color: #111111 !important;
}
:global(body.light-theme) .input-group-text {
  background-color: #f0f0f0 !important;
  border: 1.5px solid rgba(0,0,0,.24) !important;
  color: #111111 !important;
}
:global(body.light-theme) .sw-track { background: rgba(0,0,0,.18); }

.form-control::placeholder,
textarea::placeholder {
  color: var(--ff-text-muted) !important;
  opacity: 1;
}

.settings-page input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(0.78);
}

:global(body:not(.light-theme)) .settings-page .mobile-nav-trigger {
  background: var(--ff-surface-2);
  border-color: var(--ff-border-soft);
  box-shadow: 0 8px 20px rgba(0,0,0,.2);
}

:global(body:not(.light-theme)) .settings-page .mobile-nav-trigger.open {
  background: color-mix(in srgb, var(--ff-accent) 16%, var(--ff-surface-2) 84%);
  border-color: color-mix(in srgb, var(--ff-accent) 44%, transparent 56%);
}

:global(body:not(.light-theme)) .settings-page .mobile-nav-menu {
  background: var(--ff-surface-1);
}

:global(body:not(.light-theme)) .settings-page .mobile-nav-item {
  color: var(--ff-text-secondary);
  border-bottom-color: var(--ff-border-soft);
}

:global(body:not(.light-theme)) .settings-page .mobile-nav-item:hover {
  background: var(--ff-surface-2);
}

:global(body:not(.light-theme)) .settings-page .mobile-nav-item.active {
  background: color-mix(in srgb, var(--ff-accent) 16%, var(--ff-surface-2) 84%);
  color: #93c5fd;
}

:global(body.light-theme) .form-control::placeholder,
:global(body.light-theme) textarea::placeholder {
  color: #64748b !important;
  opacity: 1;
}

/* ── Mobile dropdown nav ───────────────────────────────────────── */
.mobile-nav-dropdown {
  width: 100%;
  position: relative;
  margin-bottom: 4px;
}
.mobile-nav-trigger {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border: 1px solid #dbe5f3;
  border-radius: 14px;
  box-shadow: 0 3px 10px rgba(0,0,0,.05);
  cursor: pointer;
  transition: border-color .2s, background .2s;
}
.mobile-nav-trigger.open {
  background: #eef4ff;
  border-color: #2f6df6;
}
:global(body.dark-theme) .mobile-nav-trigger,
:global(body:not(.light-theme)) .mobile-nav-trigger {
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.15);
  color: #e2e8f0;
}
:global(body.dark-theme) .mobile-nav-trigger.open,
:global(body:not(.light-theme)) .mobile-nav-trigger.open {
  background: rgba(47,109,246,.18);
  border-color: #2f6df6;
}
.mobile-nav-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  color: #1e4db7;
}
:global(body:not(.light-theme)) .mobile-nav-selected { color: #93c5fd; }
.mobile-nav-emoji  { font-size: 1.1rem; line-height: 1; }
.mobile-nav-chevron {
  font-size: 0.8rem;
  color: #64748b;
  transition: transform .25s ease;
}
.mobile-nav-chevron.rotated { transform: rotate(180deg); }

.mobile-nav-menu {
  overflow: hidden;
  max-height: 0;
  transition: max-height .25s ease, opacity .2s ease;
  opacity: 0;
  margin-top: 8px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,.08);
  display: flex;
  flex-direction: column;
}
.mobile-nav-menu.open {
  max-height: 320px;
  opacity: 1;
}
:global(body:not(.light-theme)) .mobile-nav-menu {
  background: #1e293b;
  box-shadow: 0 8px 20px rgba(0,0,0,.3);
}
.mobile-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #edf1f7;
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  text-align: left;
  transition: background .15s;
}
.mobile-nav-item:hover    { background: #f4f7fc; }
.mobile-nav-item.active   { background: #eef4ff; color: #1e4db7; font-weight: 700; }
.mobile-nav-item.no-border { border-bottom: none; }
:global(body:not(.light-theme)) .mobile-nav-item        { color: #cbd5e1; border-bottom-color: rgba(255,255,255,.07); }
:global(body:not(.light-theme)) .mobile-nav-item:hover  { background: rgba(255,255,255,.06); }
:global(body:not(.light-theme)) .mobile-nav-item.active { background: rgba(47,109,246,.2); color: #93c5fd; }
.mobile-nav-item-emoji { font-size: 1.05rem; width: 22px; text-align: center; flex-shrink: 0; }

/* ── Mobile (≤ 768px) — settings layout, panels ────────────────── */
@media (max-width: 768px) {
  /* Prevent horizontal overflow; full bleed */
  .settings-page,
  .settings-canvas,
  .settings-layout,
  .settings-content,
  .s-panel,
  .settings-section,
  .settings-grid {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    margin-left: 0;
    margin-right: 0;
  }

  /* Page canvas: reduce gap */
  .settings-canvas { gap: 12px; }

  /* Layout: stack vertically, no side squeeze */
  .settings-layout {
    flex-direction: column;
    gap: 12px;
    padding-left: 0;
    padding-right: 0;
  }

  /* Content area: explicitly full width */
  .settings-content {
    flex: 1;
    min-width: 0;
    width: 100%;
  }

  /* Panel: full width, no gap from edges */
  .s-panel {
    padding: 14px 12px;
    width: 100%;
    border-radius: 14px;
  }

  /* Header: compact */
  .settings-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 14px;
    margin-bottom: 10px;
  }
  .settings-title    { font-size: 1.25rem; }
  .settings-subtitle { font-size: 0.82rem; }

  /* Settings grid: single column, full width */
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    width: 100%;
  }

  /* Settings sections: full width, tighter */
  .settings-section {
    padding: 12px;
    margin-bottom: 10px;
    border-radius: 10px;
    width: 100%;
  }

  /* Profile header: centered content, full-width card */
  .profile-header {
    gap: 5px;
    padding-bottom: 14px;
    width: 100%;
    align-items: center;
  }

  .s-panel-head {
    margin-bottom: 14px;
    padding-bottom: 12px;
  }

  /* Avatar row: compact, row layout */
  .avatar-row {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }
  .avatar-circle {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
  }
  .avatar-info .btn-avatar {
    height: 30px;
    font-size: 0.75rem;
    padding: 0 12px;
  }

  /* Form inputs: mobile-friendly height */
  .form-control,
  .form-select {
    height: 40px;
    font-size: 16px;
    border-radius: 10px;
    padding: 8px 10px;
  }
  input[type="date"].form-control {
    font-size: 16px !important;
  }
  textarea.form-control {
    height: auto;
    min-height: 80px;
  }
  .ff-label {
    font-size: 0.75rem;
    margin-bottom: 4px;
  }

  /* Two-column grid on ≥ 430px, single below */
  .ff-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .ff-field.full-width { grid-column: 1 / -1; }

  /* Goal chips: tighter */
  .goal-chip {
    padding: 6px 12px;
    font-size: 0.78rem;
  }

  /* Theme tiles: stack */
  .theme-tiles { flex-direction: column; }

  /* Danger zone: stack */
  .danger-inner {
    flex-direction: column;
    gap: 12px;
  }
  .btn-delete-account { width: 100%; }
}

/* ── Small mobile (≤ 430px) — single-column forms ──────────────── */
@media (max-width: 430px) {
  .ff-form-grid { grid-template-columns: 1fr; }
}

/* ── Tiny mobile (≤ 390px) ──────────────────────────────────────── */
@media (max-width: 390px) {
  .settings-title  { font-size: 1.15rem; }
  .settings-header { padding: 12px 12px; }
  .s-panel         { padding: 10px; }
}

/* ═══════════════════════════════════════════════════════════════════
   CHANGE 1 — Dark Account Settings Navigation (v0.85.40.3.1)
   Override all existing nav styles to enforce dark navy filled look.
   ═══════════════════════════════════════════════════════════════════ */

/* --- Desktop sidebar nav container --- */
.settings-page .ff-settings-nav {
  background: #0a1526 !important;
  border-color: rgba(32, 129, 226, 0.18) !important;
}

/* --- Each nav item: solid dark filled background --- */
.settings-page .ff-settings-nav .s-nav-item {
  background: #0d1e38 !important;
  color: #8fa8cc !important;
  border-radius: 8px;
  font-weight: 500;
}
.settings-page .ff-settings-nav .s-nav-item .s-nav-label,
.settings-page .ff-settings-nav .s-nav-item i {
  color: #8fa8cc !important;
  font-weight: 500;
}

/* --- Icon box: blend with item background --- */
.settings-page .ff-settings-nav .s-nav-icon {
  background: rgba(255, 255, 255, 0.07) !important;
  color: #6b87ad !important;
}

/* --- Hover --- */
.settings-page .ff-settings-nav .s-nav-item:hover {
  background: #152540 !important;
  color: #d0e0f5 !important;
}
.settings-page .ff-settings-nav .s-nav-item:hover .s-nav-label,
.settings-page .ff-settings-nav .s-nav-item:hover i {
  color: #d0e0f5 !important;
}
.settings-page .ff-settings-nav .s-nav-item:hover .s-nav-icon {
  background: rgba(32, 129, 226, 0.2) !important;
  color: #60a5fa !important;
}

/* --- Active: strong blue-navy fill --- */
.settings-page .ff-settings-nav .s-nav-item.active {
  background: #1a3d75 !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  box-shadow: inset 3px 0 0 #2081e2 !important;
}
.settings-page .ff-settings-nav .s-nav-item.active .s-nav-label,
.settings-page .ff-settings-nav .s-nav-item.active i {
  color: #ffffff !important;
  font-weight: 700 !important;
}
.settings-page .ff-settings-nav .s-nav-item.active .s-nav-icon {
  background: rgba(32, 129, 226, 0.3) !important;
  color: #93c5fd !important;
}

/* --- Override light-theme to keep dark nav --- */
:global(body.light-theme) .settings-page .ff-settings-nav {
  background: #0a1526 !important;
  border-color: rgba(32, 129, 226, 0.22) !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item {
  background: #0d1e38 !important;
  color: #8fa8cc !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item .s-nav-label,
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item i {
  color: #8fa8cc !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-icon {
  background: rgba(255,255,255,.07) !important;
  color: #6b87ad !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item:hover {
  background: #152540 !important;
  color: #d0e0f5 !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item:hover .s-nav-icon {
  background: rgba(32,129,226,.2) !important;
  color: #60a5fa !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active {
  background: #1a3d75 !important;
  color: #ffffff !important;
  box-shadow: inset 3px 0 0 #2081e2 !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active .s-nav-label,
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active i {
  color: #ffffff !important;
}
:global(body.light-theme) .settings-page .ff-settings-nav .s-nav-item.active .s-nav-icon {
  background: rgba(32,129,226,.3) !important;
  color: #93c5fd !important;
}

/* --- Mobile nav: dark filled ---
   Apply to both light and dark themes unconditionally */
.settings-page .mobile-nav-trigger {
  background: #0d1e38 !important;
  border-color: rgba(32, 129, 226, 0.25) !important;
  color: #d0e0f5 !important;
  box-shadow: 0 4px 12px rgba(0,0,0,.35) !important;
}
.settings-page .mobile-nav-trigger.open {
  background: #152a50 !important;
  border-color: #2081e2 !important;
}
.settings-page .mobile-nav-selected { color: #93c5fd !important; }

.settings-page .mobile-nav-menu {
  background: #0a1526 !important;
  box-shadow: 0 8px 24px rgba(0,0,0,.5) !important;
}
.settings-page .mobile-nav-item {
  background: #0d1e38 !important;
  color: #8fa8cc !important;
  border-bottom-color: rgba(255,255,255,.06) !important;
}
.settings-page .mobile-nav-item:hover {
  background: #152540 !important;
  color: #d0e0f5 !important;
}
.settings-page .mobile-nav-item.active {
  background: #1a3d75 !important;
  color: #fff !important;
  font-weight: 700 !important;
}

/* ── Change 3: Exercise picker button (v0.85.40.3.1) ── */
.btn-pick-exercise {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 11px 16px; border-radius: 8px;
  border: 1.5px dashed var(--ff-border-strong);
  background: rgba(255,255,255,.03); color: var(--ff-text-secondary);
  font-size: .88rem; cursor: pointer; text-align: left;
  transition: border-color .18s, background .18s, color .18s;
}
.btn-pick-exercise:hover {
  border-color: #2081e2; background: rgba(32,129,226,.08); color: #60a5fa;
}
.ex-selected-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 8px;
  background: rgba(32,129,226,.12); border: 1.5px solid rgba(32,129,226,.3);
}
.ex-selected-info {
  flex: 1; display: flex; align-items: center; gap: 9px;
  color: #60a5fa; font-size: .88rem; font-weight: 600; overflow: hidden;
}
.ex-selected-info span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ex-change-btn {
  padding: 4px 11px; border-radius: 6px; border: 1px solid rgba(32,129,226,.4);
  background: transparent; color: #60a5fa; font-size: .76rem; font-weight: 600;
  cursor: pointer; flex-shrink: 0; white-space: nowrap; transition: background .15s;
}
.ex-change-btn:hover { background: rgba(32,129,226,.18); }
.ex-clear-btn-icon {
  width: 26px; height: 26px; border-radius: 5px; border: none; flex-shrink: 0;
  background: rgba(255,255,255,.08); color: var(--ff-text-secondary);
  display: flex; align-items: center; justify-content: center; font-size: .75rem;
  cursor: pointer; transition: background .15s, color .15s;
}
.ex-clear-btn-icon:hover { background: rgba(239,68,68,.2); color: #ef4444; }

/* 0.85.164 - Account Settings modernization */
.settings-page {
  --ff-border-strong: rgba(148, 163, 184, 0.36);
  --ff-border-soft: rgba(148, 163, 184, 0.22);
}

.settings-header {
  align-items: flex-start;
  gap: 12px;
  border-radius: 10px;
  padding: 16px 20px;
}

.settings-title {
  font-size: 1.5rem;
  line-height: 1.2;
}

.settings-subtitle {
  font-size: 0.86rem;
  margin-top: 4px;
  color: #cbd5e1 !important;
}

.ff-btn-save,
.change-avatar-btn,
.btn-add-goal,
.btn-goal-save,
.btn-delete-account {
  border-radius: 7px !important;
  min-height: 38px;
  font-weight: 650;
}

.ff-btn-save,
.change-avatar-btn {
  background: rgba(30, 64, 175, 0.3) !important;
  border: 1px solid rgba(59, 130, 246, 0.6) !important;
  color: #ffffff !important;
}

.ff-btn-save:hover,
.change-avatar-btn:hover {
  background: rgba(30, 64, 175, 0.45) !important;
  border-color: rgba(147, 197, 253, 0.74) !important;
  color: #ffffff !important;
}

.ff-btn-save:focus-visible,
.change-avatar-btn:focus-visible,
.btn-add-goal:focus-visible,
.btn-goal-save:focus-visible,
.btn-delete-account:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(148, 197, 253, 0.34);
}

.btn-add-goal,
.btn-goal-save {
  background: rgba(13, 91, 85, 0.32) !important;
  border: 1px solid rgba(16, 185, 129, 0.54) !important;
  color: #ffffff !important;
}

.btn-add-goal:hover,
.btn-goal-save:hover:not(:disabled) {
  background: rgba(13, 91, 85, 0.46) !important;
  border-color: rgba(110, 231, 183, 0.72) !important;
}

.btn-delete-account {
  background: rgba(91, 24, 45, 0.36) !important;
  border: 1px solid rgba(248, 113, 113, 0.54) !important;
  color: #ffffff !important;
}

.btn-delete-account:hover {
  background: rgba(127, 29, 29, 0.58) !important;
  border-color: rgba(252, 165, 165, 0.78) !important;
}

.profile-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  text-align: left;
  gap: 12px;
  padding-bottom: 10px;
  margin-bottom: 8px;
}

.profile-header__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-header__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.profile-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.profile-avatar,
.profile-header .avatar-circle {
  width: 74px;
  height: 74px;
}

.avatar-name {
  color: #f8fafc;
  font-size: 1.02rem;
  line-height: 1.22;
}

.avatar-handle {
  color: #cbd5e1;
  margin-top: 0;
  line-height: 1.2;
}

.profile-meta {
  margin-top: 1px;
}

.profile-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  background: rgba(15, 23, 42, 0.44);
  border: 1px solid rgba(148, 163, 184, 0.34);
  color: #e2e8f0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.change-avatar-btn {
  margin-top: 0;
  padding: 7px 14px;
  font-size: 0.8rem;
  white-space: nowrap;
}

.profile-header .change-avatar-btn {
  margin-top: 0;
}

.profile-header .member-badge {
  margin-top: 3px;
}

.ff-settings-nav {
  width: 198px;
  padding: 10px;
  border-radius: 10px;
}

.s-nav-item {
  min-height: 40px;
  min-height: 40px !important;
  border-radius: 6px !important;
  padding: 8px 11px;
  border: 1px solid transparent;
  color: #e2e8f0;
  background: #0f1d33;
}

.s-nav-item .s-nav-label,
.s-nav-item i {
  color: #e2e8f0 !important;
}

.s-nav-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.56) !important;
  color: #cbd5e1 !important;
}

.s-nav-item:hover {
  background: #152540 !important;
  border-color: rgba(96, 165, 250, 0.34);
}

.s-nav-item.active {
  background: #1a3d75 !important;
  border-color: rgba(147, 197, 253, 0.54);
  box-shadow: inset 3px 0 0 #2081e2 !important;
}

.s-nav-item.active .s-nav-label,
.s-nav-item.active i {
  color: #ffffff !important;
}

.settings-content {
  min-width: 0;
}

.s-panel {
  border-radius: 10px;
  padding: 20px 22px;
  border: 1px solid var(--ff-border-strong);
}

.settings-section {
  border-radius: 9px;
  padding: 13px;
  margin-bottom: 11px;
  border: 1px solid var(--ff-border-soft);
}

.section-label,
.s-panel-title {
  color: #e2e8f0 !important;
}

.section-label {
  font-size: 0.74rem;
  margin-bottom: 9px;
}

.ff-label {
  color: #f1f5f9 !important;
  opacity: 1;
}

.form-control,
.form-select {
  height: 40px;
  min-height: 40px;
  border-radius: 7px !important;
  color: #ffffff !important;
}

.form-select option {
  color: #ffffff;
  background: #1e293b;
}

textarea.form-control {
  min-height: 92px;
  height: auto;
}

.settings-grid {
  gap: 11px 12px;
}

.ff-date-input {
  color-scheme: dark;
  padding-right: 34px;
}

.settings-page .ff-date-input::-webkit-calendar-picker-indicator {
  filter: brightness(0) invert(1);
  opacity: 0.95;
  width: 18px;
  height: 18px;
  margin-left: 6px;
  cursor: pointer;
}

:global(body.light-theme) .settings-page .section-label,
:global(body.light-theme) .settings-page .s-panel-title {
  color: #e2e8f0 !important;
}

:global(body.light-theme) .settings-page .ff-label {
  color: #f1f5f9 !important;
  opacity: 1 !important;
}

@media (max-width: 768px) {
  .settings-header {
    padding: 13px 14px;
  }

  .s-panel {
    padding: 14px 12px;
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    margin-bottom: 6px;
    padding-bottom: 10px;
  }

  .profile-header__identity {
    align-items: center;
    text-align: center;
  }

  .profile-header__actions {
    width: 100%;
    justify-content: center;
  }

  .change-avatar-btn {
    width: 100%;
    max-width: 240px;
  }

  .settings-section {
    padding: 12px;
  }

  .settings-grid,
  .ff-form-grid {
    grid-template-columns: 1fr;
  }

  .ff-btn-save,
  .account-save-mobile .ff-btn-save,
  .btn-add-goal,
  .btn-goal-save,
  .btn-goal-cancel,
  .btn-delete-account {
    min-height: 40px;
  }
}

/* 0.85.164-A - Keep settings nav text/icons white across all states */
.settings-page .ff-settings-nav .s-nav-item,
.settings-page .ff-settings-nav .s-nav-item.inactive,
.settings-page .ff-settings-nav .s-nav-item.active,
.settings-page .ff-settings-nav .s-nav-item:hover,
.settings-page .ff-settings-nav .s-nav-item:focus,
.settings-page .ff-settings-nav .s-nav-item:focus-visible,
.settings-page .ff-settings-nav .s-nav-item .s-nav-label,
.settings-page .ff-settings-nav .s-nav-item .s-nav-label:link,
.settings-page .ff-settings-nav .s-nav-item .s-nav-label:visited,
.settings-page .ff-settings-nav .s-nav-item .s-nav-label:hover,
.settings-page .ff-settings-nav .s-nav-item .s-nav-label:focus,
.settings-page .ff-settings-nav .s-nav-item .s-nav-label:focus-visible,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon i,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon i:link,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon i:visited,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon i:hover,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon i:focus,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon i:focus-visible,
.settings-page .ff-settings-nav .s-nav-item i {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

.settings-page .ff-settings-nav .s-nav-item:focus-visible {
  outline: none;
  box-shadow: inset 3px 0 0 #2081e2, 0 0 0 2px rgba(147, 197, 253, 0.35);
}

/* Keep mobile settings nav labels/icons readable at 390px checks */
.settings-page .mobile-nav-selected,
.settings-page .mobile-nav-item,
.settings-page .mobile-nav-item:hover,
.settings-page .mobile-nav-item.active,
.settings-page .mobile-nav-item-emoji,
.settings-page .mobile-nav-item span {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

/* 0.85.164-D - Account Settings button polish */
.settings-page .ff-btn-save,
.settings-page .change-avatar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 6px !important;
  border: 1px solid rgba(59, 130, 246, 0.72) !important;
  background: rgba(30, 64, 175, 0.34) !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  font-weight: 650;
  padding: 0 14px;
}

.settings-page .ff-btn-save:hover,
.settings-page .change-avatar-btn:hover {
  background: rgba(30, 64, 175, 0.5) !important;
  border-color: rgba(147, 197, 253, 0.82) !important;
  color: #ffffff !important;
}

.settings-page .ff-btn-save-desktop,
.settings-page .profile-header .change-avatar-btn {
  height: 36px;
  min-height: 36px;
}

.settings-page .profile-header .change-avatar-btn {
  margin-top: 0 !important;
}

.settings-page .ff-settings-nav {
  padding: 9px;
  gap: 4px;
}

.settings-page .ff-settings-nav .s-nav-item {
  height: 40px;
  min-height: 40px !important;
  border-radius: 6px !important;
  padding: 0 10px;
  gap: 10px;
  background: #0d1e38 !important;
  border: 1px solid transparent;
  color: #ffffff !important;
}

.settings-page .ff-settings-nav .s-nav-item .s-nav-label,
.settings-page .ff-settings-nav .s-nav-item i,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon,
.settings-page .ff-settings-nav .s-nav-item .s-nav-icon i {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

.settings-page .ff-settings-nav .s-nav-icon {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: rgba(15, 23, 42, 0.52) !important;
}

.settings-page .ff-settings-nav .s-nav-item:hover {
  background: #173056 !important;
  border-color: rgba(96, 165, 250, 0.44);
}

.settings-page .ff-settings-nav .s-nav-item.active {
  background: #1a3d75 !important;
  border-color: rgba(147, 197, 253, 0.62) !important;
  box-shadow: inset 3px 0 0 #2081e2 !important;
}

.settings-page .ff-settings-nav .s-nav-item:focus-visible {
  outline: none;
  box-shadow: inset 3px 0 0 #2081e2, 0 0 0 2px rgba(147, 197, 253, 0.38);
}

@media (max-width: 768px) {
  .settings-page .account-save-mobile .ff-btn-save {
    height: 42px;
    min-height: 42px;
    border-radius: 6px !important;
    padding: 0 14px;
  }

  .settings-page .profile-header .change-avatar-btn {
    min-height: 40px;
    height: 40px;
  }
}

/* 0.85.164-E - Mobile profile card correction */
@media (max-width: 768px) {
  .settings-page .profile-header {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    align-items: start;
    justify-items: start;
    text-align: left;
    gap: 8px 10px;
    padding-bottom: 6px;
    margin-bottom: 2px;
  }

  .settings-page .profile-header__avatar {
    grid-column: 1;
    grid-row: 1 / span 2;
    width: 56px;
    height: 56px;
    align-self: start;
    justify-self: start;
  }

  .settings-page .profile-header .avatar-circle,
  .settings-page .profile-header .profile-avatar {
    width: 48px;
    height: 48px;
  }

  .settings-page .profile-header .avatar-circle {
    position: relative;
    overflow: visible;
  }

  .settings-page .profile-header .avatar-cam {
    width: 22px !important;
    height: 22px !important;
    min-height: 0 !important;
    min-width: 0 !important;
    padding: 0 !important;
    border-radius: 50% !important;
    top: auto !important;
    left: auto !important;
    right: -2px !important;
    bottom: -2px !important;
    font-size: 0.58rem;
    line-height: 1;
    z-index: 2;
  }

  .settings-page .profile-header__identity {
    grid-column: 2;
    grid-row: 1;
    width: 100%;
    align-items: flex-start;
    text-align: left;
    gap: 1px;
    min-width: 0;
  }

  .settings-page .avatar-name,
  .settings-page .avatar-handle {
    width: 100%;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .settings-page .profile-meta {
    width: 100%;
    margin-top: 2px;
  }

  .settings-page .profile-meta-pill {
    max-width: 100%;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere;
    line-height: 1.15;
  }

  .settings-page .profile-header .member-badge {
    margin-top: 3px;
  }

  .settings-page .profile-header__actions {
    grid-column: 2;
    grid-row: 2;
    width: auto;
    justify-content: flex-start;
  }

  .settings-page .profile-header .change-avatar-btn {
    width: auto;
    max-width: none;
    min-height: 36px;
    height: 36px;
    padding: 0 12px;
  }
}

@media (max-width: 340px) {
  .settings-page .profile-header {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
    gap: 6px;
  }

  .settings-page .profile-header__avatar,
  .settings-page .profile-header__identity,
  .settings-page .profile-header__actions {
    grid-column: 1;
    grid-row: auto;
    align-self: auto;
    justify-self: center;
  }

  .settings-page .profile-header__identity {
    align-items: center;
    text-align: center;
  }

  .settings-page .profile-header__actions {
    justify-content: center;
  }
}
</style>