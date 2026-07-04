<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
import { API_BASE } from '@/config/env';
import { useAuth } from '@/composable/useAuth';
import { getDefaultTheme, sanitizeTheme } from '@/composable/manageThemeSetting';
import AvatarModal from '@/components/AvatarModal.vue';

const activeTab = ref('profile')
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
  theme: 'dark',
  language: 'en',
  dashboardLayout: 'detailed',
  startPage: 'dashboard',
  navPosition: 'vertical',
  themeDirection: 'ltr',
  primaryColor: 'blue-color',
  themeColor: getDefaultTheme(),
  navbarSize: 'default',
  sidebarBackground: '',
  mainBackground: '',
  preloaderEnabled: true,
  hideThemeSidebar: false,
})

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
      theme: display.theme,
      language: display.language,
      dashboardLayout: display.dashboardLayout,
      startPage: display.startPage,
      hideThemeSidebar: display.hideThemeSidebar,
    }
    settingsPayload.settings.themeConfig = collectThemeConfig()
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

    if (isAdmin.value) {
      applyThemeConfigToLocalStorage()
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

const themeOptions = [
  { value: 'dark',  label: 'Dark',   icon: 'fa-solid fa-moon' },
  { value: 'light', label: 'Light',  icon: 'fa-solid fa-sun' },
  { value: 'auto',  label: 'System', icon: 'fa-solid fa-circle-half-stroke' },
]

const navPositionOptions = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'twoColumn', label: 'Two Column' },
  { value: 'flushMenu', label: 'Flush' },
]

const themeDirectionOptions = [
  { value: 'ltr', label: 'LTR' },
  { value: 'rtl', label: 'RTL' },
]

const primaryColorOptions = [
  'blue-color', 'orange-color', 'pink-color', 'eagle_green-color', 'purple-color',
  'gold-color', 'green-color', 'deep_pink-color', 'tea_green-color', 'yellow_green-color'
]

const themeColorOptions = [
  { value: 'light-theme', label: 'Light Theme' },
  { value: 'dark-theme', label: 'Dark Theme' },
  { value: 'blue-theme', label: 'Blue Theme' },
]

const navbarSizeOptions = [
  { value: 'default', label: 'Default' },
  { value: 'small', label: 'Small' },
  { value: 'expand', label: 'Expand on Hover' },
]

const buildAssetUrl = (name) => new URL(`/src/assets/images/${name}`, import.meta.url).toString();

const sidebarBackgroundOptions = [
  { value: '', label: 'None' },
  { value: buildAssetUrl('nav-bg-1.jpg'), label: 'Nav BG 1' },
  { value: buildAssetUrl('nav-bg-2.jpg'), label: 'Nav BG 2' },
  { value: buildAssetUrl('nav-bg-3.jpg'), label: 'Nav BG 3' },
  { value: buildAssetUrl('nav-bg-4.jpg'), label: 'Nav BG 4' },
]

const mainBackgroundOptions = [
  { value: '', label: 'None' },
  { value: buildAssetUrl('main-bg-1.jpg'), label: 'Main BG 1' },
  { value: buildAssetUrl('main-bg-2.jpg'), label: 'Main BG 2' },
  { value: buildAssetUrl('main-bg-3.jpg'), label: 'Main BG 3' },
  { value: buildAssetUrl('main-bg-4.jpg'), label: 'Main BG 4' },
]

const collectThemeConfig = () => ({
  navPosition: display.navPosition,
  themeDirection: display.themeDirection,
  primaryColor: display.primaryColor,
  themeColor: display.themeColor,
  navbarSize: display.navbarSize,
  sidebarBackground: display.sidebarBackground,
  mainBackground: display.mainBackground,
  preloaderEnabled: !!display.preloaderEnabled,
  hideThemeSidebar: !!display.hideThemeSidebar,
})

const applyThemeConfigToLocalStorage = () => {
  if (!isAdmin.value) return

  const cfg = collectThemeConfig();

  localStorage.setItem('layoutPosition', cfg.navPosition);
  localStorage.setItem('layoutDirection', cfg.themeDirection);
  localStorage.setItem('selectedStyleSheet', cfg.primaryColor);
  localStorage.setItem('currentActiveTheme', cfg.themeColor);
  localStorage.setItem('preloaderEnabled', String(cfg.preloaderEnabled));
  localStorage.setItem('hideThemeSidebar', String(cfg.hideThemeSidebar));

  if (cfg.navbarSize === 'small') {
    localStorage.setItem('sidebarSmall', 'enabled');
    localStorage.removeItem('sidebarHover');
  } else if (cfg.navbarSize === 'expand') {
    localStorage.setItem('sidebarHover', 'enabled');
    localStorage.removeItem('sidebarSmall');
  } else {
    localStorage.removeItem('sidebarHover');
    localStorage.removeItem('sidebarSmall');
  }

  if (cfg.sidebarBackground) localStorage.setItem('navbackgroundImage', cfg.sidebarBackground);
  else localStorage.removeItem('navbackgroundImage');

  if (cfg.mainBackground) localStorage.setItem('mainBackgroundImage', cfg.mainBackground);
  else localStorage.removeItem('mainBackgroundImage');

  window.dispatchEvent(new CustomEvent('ff-theme-settings-updated', { detail: cfg }));
}

const loadDisplayFromLocalStorage = () => {
  if (!isAdmin.value) return

  display.navPosition = localStorage.getItem('layoutPosition') || display.navPosition;
  display.themeDirection = localStorage.getItem('layoutDirection') || display.themeDirection;
  display.primaryColor = localStorage.getItem('selectedStyleSheet') || display.primaryColor;
  display.themeColor = sanitizeTheme(localStorage.getItem('currentActiveTheme') || display.themeColor);
  display.navbarSize = localStorage.getItem('sidebarHover') ? 'expand' : localStorage.getItem('sidebarSmall') ? 'small' : 'default';
  display.sidebarBackground = localStorage.getItem('navbackgroundImage') || '';
  display.mainBackground = localStorage.getItem('mainBackgroundImage') || '';
  display.preloaderEnabled = localStorage.getItem('preloaderEnabled') !== 'false';
  display.hideThemeSidebar = localStorage.getItem('hideThemeSidebar') === 'true';
}

const loadUserSettings = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/user-profile-settings`, { credentials: 'include' });
    if (!response.ok) return;
    const data = await response.json();
    applyProfileFromServer(data?.profile || {});
    const settings = data?.settings || {};
    const persistedDisplay = settings?.display || {};
    const cfg = settings?.themeConfig || {};

    if (isAdmin.value) {
      display.theme = persistedDisplay.theme || display.theme;
      display.language = persistedDisplay.language || display.language;
      display.dashboardLayout = persistedDisplay.dashboardLayout || display.dashboardLayout;
      display.startPage = persistedDisplay.startPage || display.startPage;

      display.navPosition = cfg.navPosition || display.navPosition;
      display.themeDirection = cfg.themeDirection || display.themeDirection;
      display.primaryColor = cfg.primaryColor || display.primaryColor;
      display.themeColor = sanitizeTheme(cfg.themeColor || display.themeColor);
      display.navbarSize = cfg.navbarSize || display.navbarSize;
      display.sidebarBackground = cfg.sidebarBackground ?? display.sidebarBackground;
      display.mainBackground = cfg.mainBackground ?? display.mainBackground;
      display.preloaderEnabled = typeof cfg.preloaderEnabled === 'boolean' ? cfg.preloaderEnabled : display.preloaderEnabled;
      if (typeof cfg.hideThemeSidebar === 'boolean') {
        display.hideThemeSidebar = cfg.hideThemeSidebar;
      } else if (typeof persistedDisplay.hideThemeSidebar === 'boolean') {
        display.hideThemeSidebar = persistedDisplay.hideThemeSidebar;
      }

      applyThemeConfigToLocalStorage();
    }
  } catch (_) {
    // keep local fallback
  }
}

const saveThemeVisibility = async () => {
  if (!isAdmin.value) return
  await save();
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

onMounted(() => {
  authStore.fetchUser()
  loadDisplayFromLocalStorage();
  loadUserSettings();
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
      <button class="ff-btn-save ff-btn-save-desktop" :class="{ saving: saveStatus==='saving', saved: saveStatus==='saved' }" @click="save">
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
            <div class="avatar-circle has-image">
              <img :src="getAvatarUrl()" alt="Profile avatar" class="profile-avatar" />
              <button class="avatar-cam" @click="openAvatarModal" title="Change avatar">
                <i class="fa-solid fa-camera"></i>
              </button>
            </div>
            <div class="avatar-name">{{ profile.firstName }} {{ profile.lastName }}</div>
            <div class="avatar-handle">@{{ profile.username }}</div>
            <span class="member-badge"><i class="fa-solid fa-crown"></i> Elite Member</span>
            <button @click="openAvatarModal" class="change-avatar-btn">
              <i class="fa-solid fa-image"></i> Change Avatar
            </button>
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
                <input v-model="profile.dateOfBirth" class="form-control ff-field-needs-update" type="date" />
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
            <p class="s-panel-sub">Theme, language and layout preferences</p>
          </div>
          <div class="ff-field full-width mb-20">
            <label class="ff-label">Theme</label>
            <div class="theme-tiles">
              <button v-for="t in themeOptions" :key="t.value"
                class="theme-tile" :class="{ active: display.theme===t.value }"
                @click="display.theme=t.value">
                <i :class="t.icon"></i>
                <span>{{ t.label }}</span>
              </button>
            </div>
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

            <div class="ff-field">
              <label class="ff-label">Nav Position</label>
              <select v-model="display.navPosition" class="form-select">
                <option v-for="opt in navPositionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div class="ff-field">
              <label class="ff-label">Theme Direction</label>
              <select v-model="display.themeDirection" class="form-select">
                <option v-for="opt in themeDirectionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div class="ff-field">
              <label class="ff-label">Primary Color</label>
              <select v-model="display.primaryColor" class="form-select">
                <option v-for="opt in primaryColorOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>

            <div class="ff-field">
              <label class="ff-label">Theme Color</label>
              <select v-model="display.themeColor" class="form-select">
                <option v-for="opt in themeColorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div class="ff-field">
              <label class="ff-label">Navbar Size</label>
              <select v-model="display.navbarSize" class="form-select">
                <option v-for="opt in navbarSizeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div class="ff-field">
              <label class="ff-label">Sidebar Background</label>
              <select v-model="display.sidebarBackground" class="form-select">
                <option v-for="opt in sidebarBackgroundOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div class="ff-field">
              <label class="ff-label">Main Background</label>
              <select v-model="display.mainBackground" class="form-select">
                <option v-for="opt in mainBackgroundOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div class="ff-field">
              <label class="ff-label">Main Preloader</label>
              <select v-model="display.preloaderEnabled" class="form-select">
                <option :value="true">Enabled</option>
                <option :value="false">Disabled</option>
              </select>
            </div>

            <div v-if="isAdmin" class="ff-field full-width">
              <label class="ff-check-row">
                <input type="checkbox" v-model="display.hideThemeSidebar" @change="saveThemeVisibility" />
                <span>Hide - Theming side menu advanced theming config</span>
              </label>
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
              <button class="btn-delete-account">Delete Account</button>
            </div>
          </div>
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
</template>

<style scoped>
.settings-page {
  --ff-border-strong: rgba(148, 163, 184, 0.44);
  --ff-border-soft: rgba(148, 163, 184, 0.32);
  padding: 0;
  color: var(--text-color);
}

.settings-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px;
  border: 1.5px solid var(--ff-border-strong);
  padding: 14px 18px;
  min-height: auto;
}
.settings-title { font-size: 1.45rem; font-weight: 700; margin: 0; color: #ffffff !important; }
.settings-subtitle { font-size: .83rem; opacity: .92; margin: 3px 0 0; color: #cbd5e1 !important; font-weight: 500; }

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
}
.s-nav-item {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 13px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-color);
  font-size: .85rem; font-weight: 500; cursor: pointer;
  text-align: left; width: 100%;
  transition: background .15s, color .15s, border-color .15s;
}
.s-nav-item .s-nav-label,
.s-nav-item i { color: var(--text-color) !important; }
.s-nav-icon {
  width: 30px; height: 30px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(148,163,184,.15); font-size: .8rem;
  color: var(--text-color-secondary);
  flex-shrink: 0; transition: background .15s;
}
.s-nav-item:hover .s-nav-icon,
.s-nav-item.active .s-nav-icon { background: rgba(37,99,235,.18); color: #2563eb; }
.s-nav-item:hover  {
  color: var(--text-color);
  background: rgba(148,163,184,.12);
}
.s-nav-item.active {
  color: var(--text-color);
  font-weight: 600;
  background: rgba(37,99,235,.12);
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.22);
}

.settings-content { flex: 1; min-width: 0; }
.s-panel { border-radius: 14px; padding: 26px 28px; border: 1.5px solid var(--ff-border-strong); }
.s-panel-head {
  margin-bottom: 22px; padding-bottom: 16px;
  border-bottom: 1.5px solid var(--ff-border-soft);
}
.s-panel-title { font-size: 1rem; font-weight: 700; margin: 0 0 3px; color: var(--text-color); }
.s-panel-sub   { font-size: .8rem; opacity: .96; margin: 0; color: var(--text-color-secondary); font-weight: 500; }

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
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s;
}
.change-avatar-btn:hover {
  background: #e2e8f0;
}
.avatar-name   { font-size: 1rem; font-weight: 700; }
.avatar-handle { font-size: .8rem; opacity: .96; margin-top: 2px; color: var(--text-color-secondary); font-weight: 500; }
.member-badge {
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 7px; padding: 3px 11px; border-radius: 20px;
  background: linear-gradient(90deg,#f59e0b,#f97316);
  color: #fff; font-size: .72rem; font-weight: 700;
}

.ff-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 22px; }
.ff-field  { display: flex; flex-direction: column; gap: 6px; }
.ff-field.full-width { grid-column: 1 / -1; }
.ff-label  { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; opacity: .75; color: var(--text-color); margin-bottom: 4px; }

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
  background: rgba(255, 255, 255, 0.04);
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
  color: var(--text-color);
}

.ff-check-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.form-control, .form-select {
  background-color: rgba(255,255,255,.06) !important;
  border: 1.5px solid var(--ff-border-soft) !important;
  color: inherit !important;
  font-weight: 500;
}
.form-control:focus, .form-select:focus {
  background-color: rgba(255,255,255,.09) !important;
  border-color: #2081e2 !important;
  box-shadow: 0 0 0 3px rgba(32,129,226,.2) !important;
  color: inherit !important;
}
.input-group-text {
  background-color: rgba(255,255,255,.05) !important;
  border: 1.5px solid var(--ff-border-soft) !important;
  color: inherit !important;
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
.notif-text strong { font-size: .88rem; font-weight: 700; color: var(--text-color); }
.notif-text span   { font-size: .76rem; opacity: .96; color: var(--text-color-secondary); }

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
  color: #475569 !important;
  background: transparent !important;
  opacity: 1 !important;
}

.ff-settings-nav .s-nav-item .s-nav-label,
.ff-settings-nav .s-nav-item i {
  color: #475569 !important;
  opacity: 1 !important;
}

.ff-settings-nav .s-nav-item.active {
  background: #eff6ff !important;
  color: #1d4ed8 !important;
  box-shadow: inset 0 0 0 1.5px #3b82f6;
}

.ff-settings-nav .s-nav-item.active .s-nav-label,
.ff-settings-nav .s-nav-item.active i {
  color: #1d4ed8 !important;
  font-weight: 700;
  opacity: 1 !important;
}

.ff-settings-nav .s-nav-icon {
  background: #eef2ff !important;
}

.ff-settings-nav .s-nav-item.active .s-nav-icon {
  background: #dbeafe !important;
}

:global(body.light-theme) .settings-section {
  background: rgba(0,0,0,0.02);
  border-color: rgba(15, 23, 42, .18);
}

:global(body.light-theme) .ff-label { opacity: .65; color: #374151; }

:global(body.light-theme) .s-panel-head { border-bottom-color: rgba(15, 23, 42, .24); }
:global(body.light-theme) .s-nav-icon   { background: rgba(0,0,0,.06); }
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
  color: var(--text-color-secondary) !important;
  opacity: 1;
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
    font-size: 0.88rem;
    border-radius: 10px;
    padding: 8px 10px;
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
</style>