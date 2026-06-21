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
    default: '/src/assets/images/admin.png'
  }
})

const { logout: authLogout, logoutInProgress } = useAuth()
const router = useRouter()
const isOpen = ref(false)
const dropdownRef = ref(null)
const buttonRef = ref(null)

// Computed avatar URL with default fallback
const avatarUrl = computed(() => {
  if (props.avatarSrc && !props.avatarSrc.includes('admin.png')) {
    return props.avatarSrc
  }
  // Default avatar fallback
  return `${API_BASE}/images/avatar/default.png`
})

// Toggle dropdown open/close
const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

// Close dropdown
const closeDropdown = () => {
  isOpen.value = false
}

// Handle click outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target) &&
      buttonRef.value && !buttonRef.value.contains(event.target)) {
    closeDropdown()
  }
}

// Handle keyboard escape key
const handleKeyDown = (event) => {
  if (event.key === 'Escape' && isOpen.value) {
    closeDropdown()
  }
}

// Menu item handlers
const handleViewProfile = () => {
  closeDropdown()
  router.push({ name: 'view_profile' })
}

const handleAccountSettings = () => {
  closeDropdown()
  router.push({ name: 'user_settings' })
}

const handleHelp = () => {
  closeDropdown()
  // Navigate to help page - adjust route name as needed
  router.push({ name: 'help' }).catch(() => {
    // Fallback: open help in current view or show notification
    console.log('Help page not configured')
  })
}

const handleSignOut = async () => {
  closeDropdown()
  // Use shared logout function from useAuth
  await authLogout()
}

// Setup and cleanup event listeners
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})

// Close dropdown when route changes
const unsubscribe = router.afterEach(() => {
  closeDropdown()
})

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
      class="profile-dropdown-btn"
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
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
              <i class="fa-regular fa-gear"></i>
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
              <i class="fa-regular fa-arrow-right-from-bracket"></i>
            </span>
            <span class="dropdown-label" v-if="logoutInProgress">Signing out...</span>
            <span class="dropdown-label" v-else>Sign Out</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.profile-dropdown-wrapper {
  position: relative;
  display: inline-block;
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
    width: 32px;
    height: 32px;
  }
}

@media (max-width: 480px) {
  .profile-dropdown-btn {
    width: 28px;
    height: 28px;
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
  color: var(--dropdown-text, #c8d4f0);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: var(--dropdown-subtext, #8b97b2);
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
  color: var(--dropdown-text, #c8d4f0);
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
  color: var(--dropdown-text-hover, #ffffff);
  padding-left: 18px;
}

.dropdown-item:active {
  background: var(--dropdown-active-bg, rgba(59, 130, 246, 0.25));
}

/* Danger variant for Sign Out */
.dropdown-item-danger {
  color: var(--dropdown-danger-text, #f87171);
}

.dropdown-item-danger:hover {
  background: var(--dropdown-danger-bg, rgba(248, 113, 113, 0.1));
  color: var(--dropdown-danger-hover, #fca5a5);
}

/* Icon */
.dropdown-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  flex-shrink: 0;
  font-size: 16px;
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

/* Responsive */
@media (max-width: 576px) {
  .profile-dropdown-menu {
    min-width: 240px;
    right: -20px;
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
