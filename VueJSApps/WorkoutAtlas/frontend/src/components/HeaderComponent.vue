<script setup>
const props = defineProps(['onNavCloseClick', 'isExpanded', 'toggleSidebar', 'profileToggleSidebar', 'canUseThemeSettings'])
import {onMounted, ref, onUnmounted, watchEffect, computed} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Tr from "@/i18n/translation"
import {toggleTheme, currentActiveTheme} from "@/composable/manageThemeSetting.js"
import {layoutPosition} from "@/composable/navPositionSetting";
import { API_BASE } from '@/config/env'
import { useAuth } from '@/composable/useAuth'
import ProfileDropdown from '@/components/ProfileDropdown.vue'
import MobileSearchModal from '@/components/MobileSearchModal.vue'

const router = useRouter()
const authStore = useAuth()

const isFullScreen = ref(false);
const mobileSearchOpen = ref(false)
import waHeaderLogo from '@/assets/logo/tablet-desktop-logo.png'
const navbarLogo = waHeaderLogo

// RBAC: Determine admin access based on resolved role
const normalizedRole = computed(() => {
  return String(authStore.role?.value || authStore.role || '').trim().toLowerCase()
})

const isAdmin = computed(() => {
  return normalizedRole.value === 'administrator' || normalizedRole.value === 'admin'
})

const toggleFullscreen = () => {
  let elem = document.documentElement;

  if (!document.fullscreenElement && !document.mozFullScreenElement &&
      !document.webkitFullscreenElement && !document.msFullscreenElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }

  isFullScreen.value = !isFullScreen.value;
};

const { t, locale } = useI18n()
const supportedLocales = Tr.supportedLocales

const switchLanguage = async (event) => {
  const newLocale = event.target.value
  await Tr.switchLanguage(newLocale)
}

const isMobileExpanded = ref(false)
const isMobile = ref(false)

const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)

const handleResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

const checkScreenSize = (() => {
  isMobile.value = windowWidth.value >= 320 && windowWidth.value <= 991;
})

const toggleHeader = (() => {
  isMobileExpanded.value = !isMobileExpanded.value;
})

const isLightTheme = computed(() => {
  return currentActiveTheme.value === 'light-theme';
})

const unreadCount = ref(0)
const unreadBadge = computed(() => (unreadCount.value > 9 ? '9+' : String(unreadCount.value)))
let unreadPollTimer = null
const currentUsername = ref('User')
const currentAvatarPath = ref('')

const loadUnreadCount = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
      credentials: 'include',
    })

    if (!response.ok) return
    const data = await response.json()
    unreadCount.value = Number(data?.unreadCount || 0)
  } catch {
    unreadCount.value = 0
  }
}

const openNotifications = () => {
  router.push({ name: 'notifications' })
}

const loadCurrentUser = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/session`, {
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' },
    })

    if (!response.ok) return

    const data = await response.json()
    const username = data?.user?.username
    const avatarPath = data?.user?.avatarPath
    
    if (username && String(username).trim()) {
      currentUsername.value = String(username).trim()
    }
    
    if (avatarPath && String(avatarPath).trim()) {
      currentAvatarPath.value = `${API_BASE}${avatarPath}`
    } else {
      currentAvatarPath.value = `${API_BASE}/images/avatar/default.png`
    }
  } catch (_) {
    // keep default fallback label
    currentAvatarPath.value = `${API_BASE}/images/avatar/default.png`
  }
}

watchEffect(() => {
  window.addEventListener('resize', checkScreenSize);
  checkScreenSize();
})

onMounted(() => {
  Tr.switchLanguage(Tr.guessDefaultLocale());
  const btnFullscreen = document.getElementById('btnFullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', toggleFullscreen);
  }

  window.addEventListener('resize', handleResize)
  loadUnreadCount()
  loadCurrentUser()
  unreadPollTimer = setInterval(loadUnreadCount, 60000)
})

const themeIconClass = computed(() => {
  return isLightTheme.value ? 'fa-light fa-cloud-moon' : 'fa-light fa-sun-bright';
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (unreadPollTimer) {
    clearInterval(unreadPollTimer)
  }
})
</script>

<template>
  <!-- Clean top navbar with RBAC-driven admin tools visibility -->
  <header class="top-navbar">
    <!-- Left: Logo + Hamburger -->
    <div class="navbar-left">
      <router-link :to="{name: 'dashboard_index'}" class="navbar-logo">
        <img :src="navbarLogo" alt="WorkoutAtlas" class="navbar-logo-img">
      </router-link>

      <button v-if="layoutPosition !== 'horizontal'" class="hamburger-btn" @click="onNavCloseClick" title="Toggle sidebar" aria-label="Toggle sidebar">
        <i class="fa-light fa-bars-sort"></i>
      </button>
    </div>

    <!-- Center: Flexible spacer -->
    <div class="navbar-spacer"></div>

    <!-- Right: Admin tools (conditional) + User profile (always) -->
    <div class="navbar-right">
      <!-- Admin-only tools: visible only for admin/administrator role -->
      <div v-if="isAdmin" class="admin-tools">
        <!-- Search: full bar on desktop, icon opens modal on mobile -->
        <form class="navbar-search navbar-search-desktop" @submit.prevent>
          <input type="search" placeholder="Search..." required>
          <button type="submit" aria-label="Search">
            <i class="fa-solid fa-magnifying-glass"></i>
          </button>
        </form>
        <button class="navbar-btn mobile-search-btn" @click="mobileSearchOpen = true" title="Search" aria-label="Open search">
          <i class="fa-light fa-magnifying-glass"></i>
        </button>

        <!-- Language selector -->
        <div class="lang-select">
          <select @change="switchLanguage" title="Change language" aria-label="Change language">
            <option
              v-for="sLocale in supportedLocales"
              :key="`locale-${sLocale}`"
              :value="sLocale"
              :selected="locale === sLocale"
            >
              {{ t(`locale.${sLocale}`) }}
            </option>
          </select>
        </div>

        <!-- Messages -->
        <div class="navbar-btn-box">
          <button class="navbar-btn" id="messageDropdown" data-bs-toggle="dropdown" aria-expanded="false" title="Messages" aria-label="Messages">
            <i class="fa-light fa-comment-dots"></i>
            <span class="badge bg-danger">3</span>
          </button>
          <ul class="message-dropdown dropdown-menu" aria-labelledby="messageDropdown">
            <li>
              <a href="#" class="d-flex">
                <div class="avatar">
                  <img src="@/assets/images/avatar.png" alt="image">
                </div>
                <div class="msg-txt">
                  <span class="name">Archer Cowie</span>
                  <span class="msg-short">There are many variations of passages of Lorem Ipsum.</span>
                  <span class="time">2 Hours ago</span>
                </div>
              </a>
            </li>
            <li>
              <a href="#" class="d-flex">
                <div class="avatar">
                  <img src="@/assets/images/avatar-2.png" alt="image">
                </div>
                <div class="msg-txt">
                  <span class="name">Cody Rodway</span>
                  <span class="msg-short">There are many variations of passages of Lorem Ipsum.</span>
                  <span class="time">2 Hours ago</span>
                </div>
              </a>
            </li>
            <li>
              <a href="#" class="d-flex">
                <div class="avatar">
                  <img src="@/assets/images/avatar-3.png" alt="image">
                </div>
                <div class="msg-txt">
                  <span class="name">Zane Bain</span>
                  <span class="msg-short">There are many variations of passages of Lorem Ipsum.</span>
                  <span class="time">2 Hours ago</span>
                </div>
              </a>
            </li>
            <li>
              <a href="#" class="show-all-btn">Show all message</a>
            </li>
          </ul>
        </div>

        <!-- Notifications -->
        <div class="navbar-btn-box">
          <button class="navbar-btn" @click="openNotifications" title="Notifications" aria-label="Open notifications">
            <i class="fa-light fa-bell animate"></i>
            <span v-if="unreadCount > 0" class="badge bg-danger">{{ unreadBadge }}</span>
          </button>
        </div>

        <!-- Fullscreen -->
        <button class="navbar-btn" id="btnFullscreen" @click="toggleFullscreen" title="Toggle fullscreen" aria-label="Toggle fullscreen">
          <i :class="isFullScreen ? 'fa-light fa-compress' : 'fa-light fa-expand'"></i>
        </button>

        <!-- Theme toggle -->
        <button class="navbar-btn" @click="toggleTheme" title="Toggle theme" aria-label="Toggle theme">
          <i :class="themeIconClass"></i>
        </button>
      </div>

      <!-- User profile: visible for all authenticated users -->
      <div class="user-profile">
        <ProfileDropdown 
          :username="currentUsername" 
          :avatar-src="currentAvatarPath"
        />
      </div>
    </div>
  </header>
  <MobileSearchModal :is-open="mobileSearchOpen" @close="mobileSearchOpen = false" />
</template>

<style scoped>
.top-navbar {
  --wa-header-height: 68px;
  --wa-header-control-size: 42px;
  --wa-topbar-bg: #000000;
  --wa-topbar-surface: #151d29;
  --wa-topbar-surface-hover: #1a2330;
  --wa-topbar-border: rgba(148, 163, 184, 0.2);
  --wa-topbar-border-strong: rgba(148, 163, 184, 0.32);
  --wa-topbar-icon: #a9b5c7;
  --wa-topbar-icon-strong: #e2e8f0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--wa-header-height);
  background: var(--wa-topbar-bg);
  border-bottom: 1px solid var(--wa-topbar-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  max-width: none;
  padding: 0 14px 0 10px;
  z-index: 1052;
  gap: 0;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--wa-header-height);
  flex-shrink: 0;
}

.navbar-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--wa-header-control-size);
  min-width: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  text-decoration: none;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.navbar-logo:hover {
  opacity: 0.85;
}

.navbar-logo img {
  height: 34px;
  width: auto;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
}

.navbar-logo-img {
  height: 34px;
  width: auto;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
}

.hamburger-btn {
  width: var(--wa-header-control-size);
  height: var(--wa-header-control-size);
  background: var(--wa-topbar-surface);
  border: 1px solid var(--wa-topbar-border);
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  color: var(--wa-topbar-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
}

.hamburger-btn:hover {
  color: var(--wa-topbar-icon-strong);
  background: var(--wa-topbar-surface-hover);
  border-color: var(--wa-topbar-border-strong);
}

.navbar-spacer {
  flex: 1 1 auto;
  min-width: 8px;
}

.navbar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-left: auto;
  min-width: 0;
  flex: 0 0 auto;
  flex-wrap: nowrap;
}

.admin-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
  flex: 0 0 auto;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: 0;
  flex: 0 0 auto;
}

.user-profile :deep(.profile-dropdown-btn) {
  width: var(--wa-header-control-size);
  height: var(--wa-header-control-size);
}

/* Search form styling */
.navbar-search {
  display: flex;
  align-items: center;
  background: var(--wa-topbar-surface);
  border: 1px solid var(--wa-topbar-border);
  border-radius: 10px;
  height: var(--wa-header-control-size);
  padding: 0 10px;
  gap: 8px;
  min-width: 188px;
  width: clamp(188px, 20vw, 280px);
  max-width: 280px;
  flex: 0 1 auto;
}

.navbar-search input {
  background: var(--wa-topbar-surface);
  border: none;
  outline: none;
  font-size: 0.9rem;
  color: var(--wa-shell-text, #f8fafc);
  flex: 1;
  min-width: 0;
}

.navbar-search input::placeholder {
  color: var(--wa-shell-text-muted, #748094);
}

.navbar-search button {
  background: var(--wa-topbar-surface);
  border: 0;
  border-left: 1px solid var(--wa-topbar-border);
  border-radius: 0;
  cursor: pointer;
  color: var(--wa-topbar-icon);
  font-size: 0.88rem;
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.navbar-search button:hover {
  color: var(--wa-topbar-icon-strong);
  background: var(--wa-topbar-surface-hover);
}

/* Language selector */
.lang-select select {
  background: var(--wa-topbar-surface);
  border: 1px solid var(--wa-topbar-border);
  border-radius: 10px;
  height: var(--wa-header-control-size);
  min-width: 62px;
  width: auto;
  padding: 0 28px 0 10px;
  color: var(--wa-topbar-icon-strong);
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.lang-select select:hover {
  background: var(--wa-topbar-surface-hover);
  border-color: var(--wa-topbar-border-strong);
}

.lang-select select:focus {
  outline: none;
  border-color: var(--wa-shell-accent, var(--main-color, #3b82f6));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--wa-shell-accent, var(--main-color, #3b82f6)) 24%, transparent 76%);
}

/* Icon buttons */
.navbar-btn-box {
  position: relative;
  flex: 0 0 auto;
}

.navbar-btn {
  width: var(--wa-header-control-size);
  height: var(--wa-header-control-size);
  background: var(--wa-topbar-surface);
  border: 1px solid var(--wa-topbar-border);
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  color: var(--wa-topbar-icon);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease, border-color 0.2s ease;
  position: relative;
}

.navbar-btn:hover {
  color: var(--wa-topbar-icon-strong);
  background: var(--wa-topbar-surface-hover);
  border-color: var(--wa-topbar-border-strong);
}

.navbar-btn .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Message dropdown */
.message-dropdown {
  min-width: 300px;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--wa-shell-border, rgba(255, 255, 255, 0.09));
  border-radius: 8px;
  background: var(--wa-shell-surface-elevated, #17212d);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.message-dropdown li {
  list-style: none;
  border-bottom: 1px solid var(--wa-shell-divider, rgba(255, 255, 255, 0.09));
}

.message-dropdown li:last-child {
  border-bottom: none;
}

.message-dropdown a {
  padding: 12px 16px;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.2s ease;
}

.message-dropdown a:hover {
  background-color: var(--wa-shell-surface-soft, #1c2734);
}

.message-dropdown .avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.message-dropdown .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-dropdown .msg-txt {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.message-dropdown .name {
  font-weight: 600;
  color: var(--wa-shell-text, #f8fafc);
  font-size: 0.9rem;
}

.message-dropdown .msg-short {
  font-size: 0.85rem;
  color: var(--wa-shell-text-secondary, #a5afbd);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-dropdown .time {
  font-size: 0.75rem;
  color: var(--wa-shell-text-muted, #748094);
}

.message-dropdown .show-all-btn {
  display: block;
  text-align: center;
  padding: 10px;
  color: var(--wa-shell-accent, var(--main-color, #3b82f6));
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.message-dropdown .show-all-btn:hover {
  background-color: var(--wa-shell-surface-soft, #1c2734);
}

/* Desktop search bar: shown on desktop, hidden on mobile */
.navbar-search-desktop {
  display: flex;
}

/* Mobile search icon: hidden on desktop, shown on mobile */
.mobile-search-btn {
  display: none;
}

/* ======== Mobile Header (â‰¤768px) ======== */
.navbar-mobile-search-row {
  display: none;
}

@media (max-width: 768px) {
  .top-navbar {
    flex-wrap: nowrap;
    height: auto;
    min-height: 64px;
    padding: 10px 14px;
    align-items: center;
    overflow: visible;
  }

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    height: auto;
    flex-shrink: 0;
  }

  .navbar-logo {
    min-width: unset;
    height: auto;
  }

  .navbar-logo img,
  .navbar-logo-img {
    height: 28px;
  }

  .navbar-spacer {
    flex: 1;
    min-width: 8px;
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    flex-wrap: nowrap;
  }

  .admin-tools {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: nowrap;
  }

  /* Show mobile search icon, hide full desktop search bar */
  .mobile-search-btn {
    display: flex;
  }

  .navbar-search-desktop {
    display: none;
  }

  /* Hide fullscreen and language selector on mobile */
  #btnFullscreen,
  .lang-select {
    display: none;
  }

  /* Icon buttons: uniform touch target */
  .navbar-btn {
    width: 36px;
    height: 36px;
    font-size: 1rem;
    padding: 0;
    justify-content: center;
  }

  /* Notification / message badge */
  .navbar-btn .badge {
    transform: scale(0.85);
    top: -3px;
    right: -3px;
    min-width: 16px;
    height: 16px;
    font-size: 0.65rem;
  }

  /* Avatar container spacing */
  .user-profile {
    margin-left: 4px;
  }
}

/* â‰¤480px: further compress */
@media (max-width: 480px) {
  .top-navbar {
    padding: 8px 10px;
    min-height: 56px;
  }

  .navbar-logo img,
  .navbar-logo-img {
    height: 24px;
  }

  .navbar-btn {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }
}

/* Header stays dark even when body has .light-theme */
.light-theme .top-navbar {
  background: var(--wa-topbar-bg);
  border-bottom: 1px solid var(--wa-topbar-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.light-theme .hamburger-btn,
.light-theme .navbar-btn,
.light-theme .navbar-search button {
  color: var(--wa-topbar-icon);
}

.light-theme .hamburger-btn:hover,
.light-theme .navbar-btn:hover,
.light-theme .navbar-search button:hover {
  color: var(--wa-topbar-icon-strong);
}

.light-theme .navbar-search,
.light-theme .lang-select select {
  background: var(--wa-topbar-surface);
  border-color: var(--wa-topbar-border);
}

.light-theme .navbar-search input,
.light-theme .lang-select select {
  color: var(--wa-shell-text-secondary, #a5afbd);
}

.light-theme .navbar-search input::placeholder {
  color: var(--wa-shell-text-muted, #748094);
}
</style>
