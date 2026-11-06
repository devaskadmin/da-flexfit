<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/env'
import { useAuth } from '@/composable/useAuth'

const props = defineProps({
  username: {
    type: String,
    default: 'User'
  },
  avatarSrc: {
    type: String,
    default: '/src/asssets/images/admin.png'
  }
})

const { logout: authLogout, logoutInProgress, user: authUser } = useAuth()
const router = useRouter()
const isOpen = ref(false)
const dropdownRef = ref(null)
const buttonRef = ref(null)
const ignoreOutsideForOpenTick = ref(false)
const touchOpenGuardUntil = ref(0)
const showClickDetectedNotice = ref(false)
let clickNoticeTimer = null
let lastAvatarOpenAt = 0
let avatarTapSequence = 0
let handledAvatarTapSequence = 0
let lastAvatarTapMarkAt = 0
let lastAvatarActivationAt = 0
let lastAvatarActivationSource = ''

const OUTSIDE_SYNTHETIC_GUARD_MS = 900

const hasTouchPrimaryInput = (() => {
  if (typeof navigator === 'undefined') return false
  return Number(navigator.maxTouchPoints || 0) > 0
})()

const menuLog = (...args) => {
  console.log('[ProfileDropdown]', ...args)
}

const mapReasonForProfileDebug = (reason = '') => {
  const normalized = String(reason || '').trim().toLowerCase()
  if (normalized === 'avatar-click') return 'avatar-click'
  if (normalized === 'outside-pointer') return 'outside-click'
  if (normalized === 'route-change') return 'route-change'
  if (normalized.startsWith('menu-item:')) return 'menu-selection'
  return 'other'
}

const emitProfileStateDebug = ({ action, reason, before, after, eventType = '' }) => {
  const entry = {
    timestamp: new Date().toISOString(),
    eventName: 'PROFILE_DEBUG_STATE',
    action: String(action || 'TOGGLE').toUpperCase(),
    reason: mapReasonForProfileDebug(reason),
    before: Boolean(before),
    after: Boolean(after),
    eventType: String(eventType || ''),
    viewportWidth: typeof window !== 'undefined' ? Number(window.innerWidth || 0) : 0,
    currentRoute: String(router.currentRoute.value?.fullPath || ''),
    menuStateBefore: Boolean(before),
    menuStateAfter: Boolean(after),
    viewport: getViewportLabel(),
  }

  console.log('[PROFILE DEBUG]',
    `action=${entry.action}`,
    `reason=${entry.reason}`,
    `before=${entry.before}`,
    `after=${entry.after}`,
    `eventType=${entry.eventType || 'unknown'}`,
    `viewportWidth=${entry.viewportWidth}`,
    `timestamp=${entry.timestamp}`
  )
  sendMenuDebug(entry)
}

const getViewportLabel = () => {
  if (typeof window === 'undefined') return 'unknown'
  return window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop'
}

const getTargetSummary = (event) => {
  const target = event?.target
  if (!(target instanceof Element)) {
    return { tag: '', id: '', class: '' }
  }

  return {
    tag: String(target.tagName || '').toLowerCase(),
    id: String(target.id || '').slice(0, 80),
    class: String(target.className || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  }
}

const sendMenuDebug = (entry) => {
  const url = `${API_BASE}/api/debug/mobile-menu`
  const body = JSON.stringify(entry)

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(url, blob)
    return
  }

  fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // non-fatal diagnostics only
  })
}

const emitMenuDebug = ({ eventName, event = null, eventType = '', before = isOpen.value, after = isOpen.value }) => {
  const entry = {
    timestamp: new Date().toISOString(),
    eventName,
    menuStateBefore: Boolean(before),
    menuStateAfter: Boolean(after),
    eventTarget: getTargetSummary(event),
    eventType: String(eventType || event?.type || ''),
    currentRoute: String(router.currentRoute.value?.fullPath || ''),
    viewport: getViewportLabel(),
  }

  menuLog('debug-event', entry)
  sendMenuDebug(entry)
}

const sendProfileMenuClickDebug = ({ before, after }) => {
  const entry = {
    timestamp: new Date().toISOString(),
    event: 'PROFILE_ICON_CLICK',
    currentRoute: String(router.currentRoute.value?.fullPath || ''),
    viewportWidth: typeof window !== 'undefined' ? Number(window.innerWidth || 0) : 0,
    viewportHeight: typeof window !== 'undefined' ? Number(window.innerHeight || 0) : 0,
    userAgent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '',
    menuStateBeforeClick: Boolean(before),
    menuStateAfterClick: Boolean(after),
  }

  fetch(`${API_BASE}/api/debug/profile-menu`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => {
    // diagnostics only
  })
}

const showProfileClickDetectedMessage = () => {
  showClickDetectedNotice.value = true
  if (clickNoticeTimer) {
    clearTimeout(clickNoticeTimer)
  }
  clickNoticeTimer = window.setTimeout(() => {
    showClickDetectedNotice.value = false
    clickNoticeTimer = null
  }, 2200)
}

const dismissProfileClickNotice = () => {
  showClickDetectedNotice.value = false
  if (clickNoticeTimer) {
    clearTimeout(clickNoticeTimer)
    clickNoticeTimer = null
  }
}

const handleAvatarPress = (event) => {
  const now = Date.now()
  // Pointer/mouse/touch bursts from one physical tap should count as one sequence.
  if ((now - lastAvatarTapMarkAt) <= 160) {
    return
  }
  avatarTapSequence += 1
  lastAvatarTapMarkAt = now
  menuLog('avatar press sequence', {
    avatarTapSequence,
    eventType: event?.type || 'unknown',
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
  })
}

const handleAvatarActivate = (event, source = 'other') => {
  const now = Date.now()
  const normalizedSource = String(source || 'other')

  const isSyntheticClickAfterPointer =
    normalizedSource === 'click' &&
    lastAvatarActivationSource === 'pointerup' &&
    (now - lastAvatarActivationAt) <= 500

  if (isSyntheticClickAfterPointer) {
    menuLog('avatar activation ignored (synthetic click after pointerup)', {
      elapsedMs: now - lastAvatarActivationAt,
      source: normalizedSource,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    })
    emitProfileStateDebug({
      action: 'TOGGLE',
      reason: 'avatar-click',
      before: isOpen.value,
      after: isOpen.value,
      eventType: `${event?.type || 'unknown'}:synthetic-ignored`,
    })
    return
  }

  lastAvatarActivationAt = now
  lastAvatarActivationSource = normalizedSource
  toggleDropdown(event)
}

// Computed avatar URL with default fallback
const avatarUrl = computed(() => {
  if (props.avatarSrc && !props.avatarSrc.includes('admin.png')) {
    return props.avatarSrc
  }
  // Default avatar fallback
  return `${API_BASE}/images/avatar/default.png`
})

// Toggle dropdown open/close
const toggleDropdown = (event) => {
  const now = Date.now()
  const beforeState = isOpen.value

  if (avatarTapSequence > 0 && handledAvatarTapSequence === avatarTapSequence) {
    menuLog('toggle ignored (duplicate click for same avatar tap sequence)', {
      avatarTapSequence,
      eventType: event?.type || 'unknown',
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    })
    emitProfileStateDebug({
      action: 'TOGGLE',
      reason: 'avatar-click',
      before: beforeState,
      after: beforeState,
      eventType: `${event?.type || 'unknown'}:duplicate-ignored`,
    })
    return
  }

  if (avatarTapSequence > 0) {
    handledAvatarTapSequence = avatarTapSequence
  }

  const nextOpen = !beforeState

  sendProfileMenuClickDebug({ before: beforeState, after: nextOpen })

  if (nextOpen) {
    if (hasTouchPrimaryInput) {
      // iOS can emit delayed synthetic pointer/mouse events after tap.
      touchOpenGuardUntil.value = Date.now() + 420
    }

    ignoreOutsideForOpenTick.value = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ignoreOutsideForOpenTick.value = false
      })
    })
  }
  isOpen.value = nextOpen
  if (nextOpen) {
    lastAvatarOpenAt = now
  }

  emitProfileStateDebug({
    action: nextOpen ? 'OPEN' : 'CLOSE',
    reason: 'avatar-click',
    before: beforeState,
    after: nextOpen,
    eventType: event?.type || 'click',
  })

  emitMenuDebug({
    eventName: 'MENU_TOGGLE_CLICK',
    event,
    before: beforeState,
    after: nextOpen,
  })
  menuLog('toggle', { nextOpen, ignoreOutsideForOpenTick: ignoreOutsideForOpenTick.value })
}

// Close dropdown
const closeDropdown = (reason = 'unknown') => {
  const beforeState = isOpen.value
  if (!isOpen.value) {
    menuLog('close ignored (already closed)', { reason })
    return
  }
  isOpen.value = false
  emitProfileStateDebug({
    action: 'CLOSE',
    reason,
    before: beforeState,
    after: false,
    eventType: reason,
  })
  emitMenuDebug({
    eventName: 'MENU_CLOSE',
    eventType: reason,
    before: beforeState,
    after: false,
  })
  menuLog('closed', { reason })
}

// Handle pointer/touch outside so mobile taps do not immediately collapse the menu.
const handlePointerOutside = (event) => {
  emitMenuDebug({
    eventName: event?.type === 'touchstart' ? 'TOUCH_START' : 'POINTER_DOWN',
    event,
    before: isOpen.value,
    after: isOpen.value,
  })

  if (!isOpen.value) {
    menuLog('outside ignored (menu closed)', { eventType: event?.type || 'unknown' })
    return
  }

  if (touchOpenGuardUntil.value > Date.now()) {
    menuLog('outside ignored (touch open guard)', {
      eventType: event?.type || 'unknown',
      guardMsRemaining: touchOpenGuardUntil.value - Date.now(),
    })
    return
  }

  if ((Date.now() - lastAvatarOpenAt) < OUTSIDE_SYNTHETIC_GUARD_MS) {
    menuLog('outside ignored (post-avatar synthetic guard)', {
      eventType: event?.type || 'unknown',
      elapsedMs: Date.now() - lastAvatarOpenAt,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    })
    emitProfileStateDebug({
      action: 'CLOSE',
      reason: 'outside-pointer',
      before: isOpen.value,
      after: isOpen.value,
      eventType: `${event?.type || 'unknown'}:synthetic-ignored`,
    })
    return
  }

  if (ignoreOutsideForOpenTick.value) {
    menuLog('outside ignored (same tap guard)', {
      eventType: event?.type || 'unknown',
    })
    return
  }

  const target = event.target
  if (target instanceof Element && target.closest('.profile-dropdown-wrapper')) {
    menuLog('outside ignored (inside wrapper via closest)', { eventType: event?.type || 'unknown' })
    return
  }

  const path = typeof event.composedPath === 'function' ? event.composedPath() : []

  if (path.length > 0) {
    if (path.includes(dropdownRef.value) || path.includes(buttonRef.value)) {
      menuLog('outside ignored (inside composedPath)', { eventType: event?.type || 'unknown' })
      return
    }
  } else if (
    (dropdownRef.value && dropdownRef.value.contains(target)) ||
    (buttonRef.value && buttonRef.value.contains(target))
  ) {
    menuLog('outside ignored (inside contains)', { eventType: event?.type || 'unknown' })
    return
  }

  if (dropdownRef.value && buttonRef.value) {
    emitMenuDebug({
      eventName: 'OUTSIDE_CLICK',
      event,
      before: isOpen.value,
      after: false,
    })
    closeDropdown('outside-pointer')
  }
}

// Handle keyboard escape key
const handleKeyDown = (event) => {
  if (event.key === 'Escape' && isOpen.value) {
    closeDropdown('escape')
  }
}

// Menu item handlers
const handleViewProfile = () => {
  closeDropdown('menu-item:view-profile')
  router.push({ name: 'view_profile' })
}

const handleAccountSettings = () => {
  closeDropdown('menu-item:account-settings')
  router.push({ name: 'user_settings' })
}

const handleHelp = () => {
  closeDropdown('menu-item:help')
  // Navigate to help page - adjust route name as needed
  router.push({ name: 'help' }).catch(() => {
    // Fallback: open help in current view or show notification
    console.log('Help page not configured')
  })
}

const handleSignOut = async () => {
  closeDropdown('menu-item:sign-out')
  // Use shared logout function from useAuth
  await authLogout()
}

let removeOutsideListener = () => {}

const registerOutsideListener = () => {
  window.addEventListener('pointerdown', handlePointerOutside, true)

  // Legacy fallback for browsers that do not emit pointer events consistently.
  const needsTouchFallback = !window.PointerEvent
  if (needsTouchFallback) {
    window.addEventListener('touchstart', handlePointerOutside, true)
  }

  menuLog('listener registered', {
    mode: needsTouchFallback ? 'pointerdown+touchstart' : 'pointerdown',
  })
  return () => {
    window.removeEventListener('pointerdown', handlePointerOutside, true)
    if (needsTouchFallback) {
      window.removeEventListener('touchstart', handlePointerOutside, true)
    }
    menuLog('listener removed', {
      mode: needsTouchFallback ? 'pointerdown+touchstart' : 'pointerdown',
    })
  }
}

// Setup and cleanup event listeners
onMounted(() => {
  removeOutsideListener = registerOutsideListener()
  document.addEventListener('keydown', handleKeyDown)
  emitMenuDebug({ eventName: 'COMPONENT_MOUNT' })
  menuLog('mounted')
})

onUnmounted(() => {
  emitMenuDebug({ eventName: 'COMPONENT_UNMOUNT' })
  if (clickNoticeTimer) {
    clearTimeout(clickNoticeTimer)
    clickNoticeTimer = null
  }
  removeOutsideListener()
  document.removeEventListener('keydown', handleKeyDown)
  menuLog('unmounted')
})

// Close dropdown when route changes
const unsubscribe = router.afterEach(() => {
  emitMenuDebug({
    eventName: 'ROUTE_CHANGE',
    before: isOpen.value,
    after: false,
  })
  closeDropdown('route-change')
})

watch(isOpen, (next, prev) => {
  if (next === prev) return
  emitMenuDebug({
    eventName: next ? 'MENU_OPEN' : 'MENU_CLOSE',
    before: prev,
    after: next,
  })
})

watch(logoutInProgress, (next, prev) => {
  if (next === prev) return
  emitMenuDebug({
    eventName: 'AUTH_STATE_CHANGE',
    eventType: `logoutInProgress:${next}`,
    before: isOpen.value,
    after: isOpen.value,
  })
})

watch(
  () => Boolean(authUser?.value),
  (next, prev) => {
    if (next === prev) return
    emitMenuDebug({
      eventName: 'AUTH_STATE_CHANGE',
      eventType: `userSessionPresent:${next}`,
      before: isOpen.value,
      after: isOpen.value,
    })
  }
)

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<template>
  <div class="profile-dropdown-wrapper">
    <!-- Profile Button -->
    <button
      ref="buttonRef"
      type="button"
      class="profile-dropdown-btn"
      :class="{ 'is-open': isOpen }"
      @pointerdown.stop="handleAvatarPress($event)"
      @mousedown.stop
      @touchstart.stop="handleAvatarPress($event); emitMenuDebug({ eventName: 'TOUCH_START', event: $event, before: isOpen, after: isOpen })"
      @pointerup.stop="handleAvatarActivate($event, 'pointerup')"
      @click.stop="handleAvatarActivate($event, 'click')"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      aria-label="Open profile menu"
    >
      <img :src="avatarUrl" :alt="`${username}'s avatar`" class="profile-avatar">
    </button>

    <!-- Dropdown Menu -->
    <transition name="profile-dropdown-fade">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="profile-dropdown-menu"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        role="menu"
        aria-label="Profile menu"
      >
        <!-- User Info Section -->
        <div class="dropdown-user-info">
          <div class="user-avatar-large">
            <img :src="avatarUrl" :alt="`${username}'s avatar`">
          </div>
          <div class="user-info-text">
            <p class="user-display-name">{{ username }}</p>
            <p class="user-email">View your profile</p>
          </div>
        </div>

        <!-- Divider -->
        <div class="dropdown-divider"></div>

        <!-- Menu Items -->
        <div class="dropdown-items">
          <!-- View Profile -->
          <button
            class="dropdown-item"
            @click="handleViewProfile"
            role="menuitem"
          >
            <span class="dropdown-icon">
              <i class="fa-regular fa-user"></i>
            </span>
            <span class="dropdown-label">View Profile</span>
          </button>

          <!-- Account Settings -->
          <button
            class="dropdown-item"
            @click="handleAccountSettings"
            role="menuitem"
          >
            <span class="dropdown-icon">
              <i class="fa-solid fa-gear"></i>
            </span>
            <span class="dropdown-label">Account Settings</span>
          </button>

          <!-- Help -->
          <button
            class="dropdown-item"
            @click="handleHelp"
            role="menuitem"
          >
            <span class="dropdown-icon">
              <i class="fa-regular fa-circle-question"></i>
            </span>
            <span class="dropdown-label">Help</span>
          </button>
        </div>

        <!-- Divider -->
        <div class="dropdown-divider"></div>

        <!-- Sign Out -->
        <div class="dropdown-items">
          <button
            class="dropdown-item dropdown-item-danger"
            @click="handleSignOut"
            :disabled="logoutInProgress"
            role="menuitem"
          >
            <span class="dropdown-icon">
              <i class="fa-solid fa-right-from-bracket"></i>
            </span>
            <span class="dropdown-label" v-if="logoutInProgress">Signing out...</span>
            <span class="dropdown-label" v-else>Sign Out</span>
          </button>
        </div>
      </div>
    </transition>

    <transition name="profile-click-notice">
      <div
        v-if="showClickDetectedNotice"
        class="profile-click-notice"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        role="status"
        aria-live="polite"
      >
        <span class="profile-click-notice__text">Profile icon click detected</span>
        <button type="button" class="profile-click-notice__close" @click.stop="dismissProfileClickNotice">Close</button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.profile-dropdown-wrapper {
  position: relative;
  display: inline-block;
}

.profile-click-notice {
  position: fixed;
  top: calc(72px + env(safe-area-inset-top, 0px));
  right: max(10px, env(safe-area-inset-right, 0px));
  z-index: 2500;
  background: rgba(15, 23, 42, 0.96);
  color: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 10px;
  padding: 10px 12px;
  width: min(320px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 20px));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.profile-click-notice__text {
  font-size: 13px;
  line-height: 1.25;
  font-weight: 600;
}

.profile-click-notice__close {
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(30, 41, 59, 0.88);
  color: #ffffff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.profile-click-notice__close:hover {
  background: rgba(51, 65, 85, 0.92);
}

/* Profile Button */
.profile-dropdown-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  outline: none;
}

.profile-dropdown-btn:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: scale(1.05);
}

.profile-dropdown-btn.is-open {
  border-color: rgba(59, 130, 246, 0.5);
}

.profile-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

@media (max-width: 768px) {
  .profile-dropdown-btn {
    width: 40px;
    height: 40px;
  }
}

@media (max-width: 480px) {
  .profile-dropdown-btn {
    width: 38px;
    height: 38px;
  }
}

/* Dropdown Menu */
.profile-dropdown-menu {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  background: var(--dropdown-bg, #112143);
  border: 1px solid var(--dropdown-border, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.25);
  min-width: 280px;
  z-index: 1050;
  overflow: hidden;
}

/* Arrow/Pointer */
.profile-dropdown-menu::before {
  content: '';
  position: absolute;
  top: -8px;
  right: 16px;
  width: 14px;
  height: 14px;
  background: var(--dropdown-bg, #112143);
  border: 1px solid var(--dropdown-border, rgba(255, 255, 255, 0.1));
  border-bottom: none;
  border-right: none;
  border-radius: 3px 0 0 0;
  transform: rotate(45deg);
  z-index: -1;
}

/* User Info Section */
.dropdown-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--dropdown-header-bg, rgba(255, 255, 255, 0.03));
}

.user-avatar-large {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid rgba(59, 130, 246, 0.3);
}

.user-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info-text {
  flex: 1;
  min-width: 0;
}

.user-display-name {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff !important;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: #ffffff !important;
  margin: 4px 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Divider */
.dropdown-divider {
  height: 1px;
  background: var(--dropdown-divider, rgba(255, 255, 255, 0.08));
  margin: 0;
}

/* Menu Items Container */
.dropdown-items {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

/* Menu Item */
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: none;
  border: none;
  color: #ffffff !important;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  outline: none;
  position: relative;
}

.dropdown-item:hover {
  background: var(--dropdown-hover-bg, rgba(59, 130, 246, 0.15));
  color: #ffffff !important;
  padding-left: 18px;
}

.dropdown-item:active {
  background: var(--dropdown-active-bg, rgba(59, 130, 246, 0.25));
  color: #ffffff !important;
}

.dropdown-item:focus-visible {
  color: #ffffff !important;
  background: var(--dropdown-hover-bg, rgba(59, 130, 246, 0.15));
  outline: 2px solid rgba(255, 255, 255, 0.45);
  outline-offset: -2px;
}

/* Danger variant for Sign Out */
.dropdown-item-danger {
  color: #ffffff !important;
}

.dropdown-item-danger:hover {
  background: var(--dropdown-danger-bg, rgba(248, 113, 113, 0.1));
  color: #ffffff !important;
}

.dropdown-item-danger:active,
.dropdown-item-danger:focus-visible {
  color: #ffffff !important;
}

/* Icon */
.dropdown-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  flex-shrink: 0;
  font-size: 16px;
  color: #ffffff !important;
}

.dropdown-icon i {
  color: #ffffff !important;
}

.dropdown-label {
  color: #ffffff !important;
}

.dropdown-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Transition/Animation */
.profile-dropdown-fade-enter-active {
  animation: profileDropdownSlideIn 0.2s ease-out forwards;
}

.profile-dropdown-fade-leave-active {
  animation: profileDropdownSlideOut 0.15s ease-in forwards;
}

@keyframes profileDropdownSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes profileDropdownSlideOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

.profile-click-notice-enter-active,
.profile-click-notice-leave-active {
  transition: opacity 0.16s ease;
}

.profile-click-notice-enter-from,
.profile-click-notice-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 576px) {
  .profile-dropdown-menu {
    min-width: 0;
    width: min(280px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px));
    max-width: min(280px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px));
    right: max(8px, env(safe-area-inset-right, 0px));
  }

  .profile-dropdown-menu::before {
    right: 18px;
  }

  .dropdown-user-info {
    flex-direction: column;
    text-align: center;
    padding: 12px;
  }

  .user-avatar-large {
    margin-bottom: 4px;
  }

  .user-display-name,
  .user-email {
    text-align: center;
  }

  .dropdown-item {
    padding: 8px 12px;
  }

  .dropdown-item:hover {
    padding-left: 14px;
  }
}
</style>
