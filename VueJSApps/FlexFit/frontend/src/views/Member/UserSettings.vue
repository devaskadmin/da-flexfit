<script setup>
import { ref, reactive } from 'vue'

const activeTab = ref('profile')

const profile = reactive({
  firstName: 'Mitchell',
  lastName: 'Shay',
  username: 'mitch_shay',
  email: 'mitch@flexfit.com',
  phone: '',
  bio: '',
  gender: 'male',
  dateOfBirth: '',
  location: '',
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

function save() {
  errorMsg.value = ''
  successMsg.value = ''
  saveStatus.value = 'saving'
  setTimeout(() => {
    saveStatus.value = 'saved'
    successMsg.value = 'Settings saved successfully.'
  }, 900)
  setTimeout(() => {
    saveStatus.value = ''
  }, 3000)
}

const tabs = [
  { id: 'profile',       label: 'Profile',          icon: 'fa-solid fa-user' },
  { id: 'fitness',       label: 'Fitness Profile',  icon: 'fa-solid fa-dumbbell' },
  { id: 'notifications', label: 'Notifications',    icon: 'fa-solid fa-bell' },
  { id: 'display',       label: 'Display',          icon: 'fa-solid fa-display' },
  { id: 'security',      label: 'Security',         icon: 'fa-solid fa-shield-halved' },
]

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
</script>

<template>
  <div class="settings-page">

    <!-- Header -->
    <div class="settings-header mb-25">
      <div>
        <h2 class="settings-title">Account Settings</h2>
        <p class="settings-subtitle">Manage your profile, fitness data and preferences</p>
      </div>
      <button class="ff-btn-save" :class="{ saving: saveStatus==='saving', saved: saveStatus==='saved' }" @click="save">
        <i v-if="saveStatus==='saving'" class="fa-solid fa-spinner fa-spin"></i>
        <i v-else-if="saveStatus==='saved'" class="fa-solid fa-check"></i>
        <i v-else class="fa-solid fa-floppy-disk"></i>
        {{ saveStatus==='saving' ? 'Saving...' : saveStatus==='saved' ? 'Saved!' : 'Save Changes' }}
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger mb-15">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success mb-15">{{ successMsg }}</div>

    <div class="settings-layout">

      <!-- Sidebar nav -->
      <nav class="settings-nav panel-bg">
        <button v-for="tab in tabs" :key="tab.id"
          class="s-nav-item"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id">
          <span class="s-nav-icon"><i :class="tab.icon"></i></span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Main content -->
      <div class="settings-content">

        <!-- PROFILE TAB -->
        <section v-if="activeTab==='profile'" class="s-panel panel-bg">
          <div class="s-panel-head">
            <h4 class="s-panel-title">Public Profile</h4>
            <p class="s-panel-sub">This information is visible on your athlete card</p>
          </div>
          <div class="avatar-row mb-25">
            <div class="avatar-circle">
              {{ profile.firstName[0] }}{{ profile.lastName[0] }}
              <button class="avatar-cam"><i class="fa-solid fa-camera"></i></button>
            </div>
            <div>
              <div class="avatar-name">{{ profile.firstName }} {{ profile.lastName }}</div>
              <div class="avatar-handle">@{{ profile.username }}</div>
              <span class="member-badge"><i class="fa-solid fa-crown"></i> Elite Member</span>
            </div>
          </div>
          <div class="ff-form-grid">
            <div class="ff-field">
              <label class="ff-label">First Name</label>
              <input v-model="profile.firstName" class="form-control" type="text" placeholder="First name" />
            </div>
            <div class="ff-field">
              <label class="ff-label">Last Name</label>
              <input v-model="profile.lastName" class="form-control" type="text" placeholder="Last name" />
            </div>
            <div class="ff-field">
              <label class="ff-label">Username</label>
              <div class="input-group">
                <span class="input-group-text">@</span>
                <input v-model="profile.username" class="form-control" type="text" placeholder="username" />
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Email Address</label>
              <input v-model="profile.email" class="form-control" type="email" placeholder="email@example.com" />
            </div>
            <div class="ff-field">
              <label class="ff-label">Phone Number</label>
              <input v-model="profile.phone" class="form-control" type="tel" placeholder="+1 (555) 000-0000" />
            </div>
            <div class="ff-field">
              <label class="ff-label">Location</label>
              <input v-model="profile.location" class="form-control" type="text" placeholder="City, Country" />
            </div>
            <div class="ff-field">
              <label class="ff-label">Gender</label>
              <select v-model="profile.gender" class="form-select">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </div>
            <div class="ff-field">
              <label class="ff-label">Date of Birth</label>
              <input v-model="profile.dateOfBirth" class="form-control" type="date" />
            </div>
            <div class="ff-field full-width">
              <label class="ff-label">Bio</label>
              <textarea v-model="profile.bio" class="form-control" rows="3" placeholder="Tell your coach and training partners about yourself..."></textarea>
            </div>
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
            <p class="s-panel-sub">Control what FlexFit notifies you about</p>
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
        <section v-if="activeTab==='display'" class="s-panel panel-bg">
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
</template>

<style scoped>
.settings-page {
  --ff-border-strong: rgba(148, 163, 184, 0.44);
  --ff-border-soft: rgba(148, 163, 184, 0.32);
  padding: 0 2px;
  color: var(--text-color);
}

.settings-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
}
.settings-title { font-size: 1.45rem; font-weight: 700; margin: 0; color: var(--text-color); }
.settings-subtitle { font-size: .83rem; opacity: .92; margin: 3px 0 0; color: var(--text-color-secondary); font-weight: 500; }

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

.settings-nav {
  display: flex; flex-direction: column; gap: 3px;
  width: 186px; flex-shrink: 0;
  border-radius: 12px; padding: 10px 8px;
  border: 1.5px solid var(--ff-border-strong);
}
.s-nav-item {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 13px; border-radius: 8px; border: none;
  background: transparent; color: #000000;
  font-size: .87rem; font-weight: 600; cursor: pointer;
  text-align: left; width: 100%;
  transition: background .15s, color .15s;
}
.s-nav-item span,
.s-nav-item i { color: #000000 !important; }
.s-nav-icon {
  width: 30px; height: 30px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.08); font-size: .82rem;
  color: #000000;
  flex-shrink: 0; transition: background .15s;
}
.s-nav-item:hover .s-nav-icon,
.s-nav-item.active .s-nav-icon { background: rgba(0,0,0,.14); color: #000000; }
.s-nav-item:hover  { color: #000000; }
.s-nav-item.active { color: #000000; font-weight: 700; }

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
.avatar-cam {
  position: absolute; bottom: 0; right: 0;
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid transparent; background: #2081e2; color: #fff;
  font-size: .58rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
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
.ff-label  { font-size: .73rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; opacity: 1; color: var(--text-color); }

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
  color: #111111 !important;
  opacity: 1;
}

:global(body.light-theme) .settings-page {
  --ff-border-strong: rgba(15, 23, 42, .28);
  --ff-border-soft: rgba(15, 23, 42, .22);
}

:global(body.light-theme) .settings-page a:hover {
  color: #000000 !important;
}

:global(body.light-theme) .settings-page .s-nav-item,
:global(body.light-theme) .settings-page .s-nav-item span,
:global(body.light-theme) .settings-page .s-nav-icon,
:global(body.light-theme) .settings-page .s-nav-icon i {
  color: #000000 !important;
  opacity: 1 !important;
}

:global(body.light-theme) .settings-page .s-nav-item:hover,
:global(body.light-theme) .settings-page .s-nav-item.active {
  color: #000000 !important;
  font-weight: 700;
}

:global(body.light-theme) .settings-page .s-nav-item:hover .s-nav-icon,
:global(body.light-theme) .settings-page .s-nav-item.active .s-nav-icon,
:global(body.light-theme) .settings-page .s-nav-item:hover .s-nav-icon i,
:global(body.light-theme) .settings-page .s-nav-item.active .s-nav-icon i {
  color: #000000 !important;
}

:global(body.light-theme) .s-panel,
:global(body.light-theme) .settings-nav {
  border: 1.5px solid rgba(15, 23, 42, .24);
}

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

@media (max-width: 768px) {
  .settings-layout { flex-direction: column; }
  .settings-nav { flex-direction: row; flex-wrap: wrap; width: 100%; }
  .s-nav-item { flex: 1 1 auto; justify-content: center; }
  .ff-form-grid { grid-template-columns: 1fr; }
  .ff-field.full-width { grid-column: 1; }
  .theme-tiles { flex-direction: column; }
}
</style>