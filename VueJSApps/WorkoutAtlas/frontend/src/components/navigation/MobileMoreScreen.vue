<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { sidebarMenus } from '@/components/sidebarMenu'
import { useAuth } from '@/composable/useAuth'
import { userHasWorkouts } from '@/composable/workoutStatusManager'

const emit = defineEmits(['close'])

const route = useRoute()
const authStore = useAuth()

const hasSavedWorkoutPlan = userHasWorkouts

const safeParseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

const normalizeRoleValue = (candidate) => {
  const value = String(candidate || '').trim().toLowerCase()
  if (value === 'administrator') return 'admin'
  return value
}

const normalizedRole = computed(() =>
  normalizeRoleValue(
    authStore.user?.value?.role ||
    authStore.user?.value?.roleSlug ||
    authStore.user?.value?.role_slug ||
    authStore.user?.value?.user_role ||
    authStore.user?.role ||
    authStore.user?.roleSlug ||
    authStore.user?.role_slug ||
    authStore.user?.user_role ||
    authStore.currentUser?.role ||
    authStore.currentUser?.roleSlug ||
    authStore.currentUser?.role_slug ||
    authStore.currentUser?.user_role ||
    localStorage.getItem('role') ||
    localStorage.getItem('userRole') ||
    safeParseStoredUser()?.role ||
    safeParseStoredUser()?.roleSlug ||
    safeParseStoredUser()?.role_slug ||
    safeParseStoredUser()?.user_role ||
    ''
  )
)

const isAdmin = computed(() => normalizedRole.value === 'admin')
const isTrainer = computed(() => normalizedRole.value === 'trainer')
const canViewTrainerMenu = computed(() => isAdmin.value || isTrainer.value)
const canViewAdminMenu = computed(() => isAdmin.value)
const canViewToolsMenu = computed(() => isAdmin.value)

const shouldRenderMenuItem = (menu) => {
  if (!menu?.requiresWorkoutLists && !menu?.requiresUnlock) return true
  return hasSavedWorkoutPlan.value
}

const getSectionByName = (name) => {
  const target = String(name || '').trim().toLowerCase()
  return sidebarMenus.value.find((section) => String(section?.menu_name || '').trim().toLowerCase() === target)
}

const dashboardSection = computed(() => {
  return sidebarMenus.value.find((section) => String(section?.menu_name || '').toLowerCase().includes('dashboard')) || { menus: [] }
})

const trainerSection = computed(() => getSectionByName('trainer') || { menus: [] })
const adminSection = computed(() => getSectionByName('administrator') || { menus: [] })
const toolsSection = computed(() => getSectionByName('developer tools') || { menus: [] })

const getMenuByLinkName = (menus, linkName) => {
  return (Array.isArray(menus) ? menus : []).find((item) => item?.link_name === linkName && shouldRenderMenuItem(item))
}

const quickStartItem = computed(() => {
  const workoutsItem = getMenuByLinkName(dashboardSection.value?.menus, 'workouts')
  if (!workoutsItem) return null
  return {
    title: 'Quick Start Workout',
    name: workoutsItem.name,
    link_name: workoutsItem.link_name,
    icon: 'fa-solid fa-bolt',
  }
})

const accountItems = computed(() => {
  const menus = Array.isArray(dashboardSection.value?.menus) ? dashboardSection.value.menus : []
  const picks = ['progress_stats', 'user_settings']
  return picks
    .map((linkName) => getMenuByLinkName(menus, linkName))
    .filter(Boolean)
})

const trainerItems = computed(() => {
  if (!canViewTrainerMenu.value) return []
  return (Array.isArray(trainerSection.value?.menus) ? trainerSection.value.menus : []).filter(shouldRenderMenuItem)
})

const adminItems = computed(() => {
  if (!canViewAdminMenu.value) return []
  const adminMenus = (Array.isArray(adminSection.value?.menus) ? adminSection.value.menus : []).filter(shouldRenderMenuItem)
  const toolsMenus = canViewToolsMenu.value
    ? (Array.isArray(toolsSection.value?.menus) ? toolsSection.value.menus : []).filter(shouldRenderMenuItem)
    : []
  return [...adminMenus, ...toolsMenus]
})

const logoutItem = computed(() => {
  return getMenuByLinkName(dashboardSection.value?.menus, 'logout')
})

const isActiveRoute = (linkName) => {
  return String(route.name || '') === String(linkName || '')
}
</script>

<template>
  <section class="wa-mobile-more-screen" role="dialog" aria-modal="true" aria-labelledby="wa-mobile-more-title">
    <header class="wa-mobile-more-screen__header">
      <h2 id="wa-mobile-more-title">More</h2>
      <button type="button" class="wa-mobile-more-screen__close" aria-label="Close more menu" @click="emit('close')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </header>

    <div class="wa-mobile-more-screen__content">
      <section v-if="quickStartItem" class="wa-mobile-more-section" aria-labelledby="more-quick-actions">
        <h3 id="more-quick-actions" class="wa-mobile-more-section__title">Quick Actions</h3>
        <router-link
          class="wa-mobile-more-row wa-mobile-more-row--quick"
          :to="{ name: quickStartItem.link_name }"
          :aria-current="isActiveRoute(quickStartItem.link_name) ? 'page' : undefined"
          @click="emit('close')"
        >
          <span class="wa-mobile-more-row__icon"><i :class="quickStartItem.icon"></i></span>
          <span class="wa-mobile-more-row__text">{{ quickStartItem.title }}</span>
          <span class="wa-mobile-more-row__chevron" aria-hidden="true">›</span>
        </router-link>
      </section>

      <section v-if="accountItems.length" class="wa-mobile-more-section" aria-labelledby="more-account">
        <h3 id="more-account" class="wa-mobile-more-section__title">Your Account</h3>
        <router-link
          v-for="item in accountItems"
          :key="`account-${item.link_name}`"
          class="wa-mobile-more-row"
          :class="{ 'is-active': isActiveRoute(item.link_name) }"
          :to="{ name: item.link_name }"
          :aria-current="isActiveRoute(item.link_name) ? 'page' : undefined"
          @click="emit('close')"
        >
          <span class="wa-mobile-more-row__icon"><i :class="item.icon"></i></span>
          <span class="wa-mobile-more-row__text">{{ item.name }}</span>
          <span class="wa-mobile-more-row__chevron" aria-hidden="true">›</span>
        </router-link>
      </section>

      <section v-if="trainerItems.length" class="wa-mobile-more-section" aria-labelledby="more-trainer">
        <h3 id="more-trainer" class="wa-mobile-more-section__title">Trainer Services</h3>
        <router-link
          v-for="item in trainerItems"
          :key="`trainer-${item.link_name}`"
          class="wa-mobile-more-row"
          :class="{ 'is-active': isActiveRoute(item.link_name) }"
          :to="{ name: item.link_name }"
          :aria-current="isActiveRoute(item.link_name) ? 'page' : undefined"
          @click="emit('close')"
        >
          <span class="wa-mobile-more-row__icon"><i :class="item.icon"></i></span>
          <span class="wa-mobile-more-row__text">{{ item.name }}</span>
          <span class="wa-mobile-more-row__chevron" aria-hidden="true">›</span>
        </router-link>
      </section>

      <section v-if="adminItems.length" class="wa-mobile-more-section" aria-labelledby="more-admin">
        <h3 id="more-admin" class="wa-mobile-more-section__title">Administration</h3>
        <router-link
          v-for="item in adminItems"
          :key="`admin-${item.link_name}-${item.name}`"
          class="wa-mobile-more-row"
          :class="{ 'is-active': isActiveRoute(item.link_name) }"
          :to="{ name: item.link_name }"
          :aria-current="isActiveRoute(item.link_name) ? 'page' : undefined"
          @click="emit('close')"
        >
          <span class="wa-mobile-more-row__icon"><i :class="item.icon"></i></span>
          <span class="wa-mobile-more-row__text">{{ item.name }}</span>
          <span class="wa-mobile-more-row__chevron" aria-hidden="true">›</span>
        </router-link>
      </section>

      <section v-if="logoutItem" class="wa-mobile-more-section" aria-labelledby="more-logout">
        <h3 id="more-logout" class="wa-mobile-more-section__title">Account</h3>
        <router-link
          class="wa-mobile-more-row wa-mobile-more-row--danger"
          :to="{ name: logoutItem.link_name }"
          @click="emit('close')"
        >
          <span class="wa-mobile-more-row__icon"><i :class="logoutItem.icon"></i></span>
          <span class="wa-mobile-more-row__text">{{ logoutItem.name }}</span>
          <span class="wa-mobile-more-row__chevron" aria-hidden="true">›</span>
        </router-link>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wa-mobile-more-screen {
  position: fixed;
  top: calc(52px + env(safe-area-inset-top));
  left: 0;
  right: 0;
  bottom: var(--wa-mobile-bottom-nav-clearance, calc(92px + env(safe-area-inset-bottom)));
  z-index: 1410;
  background: #0b1630;
  color: #f8fbff;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: max(14px, env(safe-area-inset-bottom));
}

.wa-mobile-more-screen__header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 10px 16px;
  background: #0b1630;
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
}

.wa-mobile-more-screen__header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #ffffff;
}

.wa-mobile-more-screen__close {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  background: rgba(20, 35, 66, 0.92);
  color: #e2e8f0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.wa-mobile-more-screen__close:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}

.wa-mobile-more-screen__content {
  padding: 10px 0 16px;
}

.wa-mobile-more-section {
  margin-top: 12px;
}

.wa-mobile-more-section__title {
  margin: 0;
  padding: 0 16px 8px;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9fb2d8;
}

.wa-mobile-more-row {
  min-height: 48px;
  padding: 11px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #f8fbff;
  text-decoration: none;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.wa-mobile-more-row:last-child {
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.wa-mobile-more-row__icon {
  width: 18px;
  min-width: 18px;
  display: inline-flex;
  justify-content: center;
  color: #d7e3ff;
  font-size: 0.95rem;
}

.wa-mobile-more-row__text {
  flex: 1;
  font-size: 0.97rem;
  font-weight: 600;
  line-height: 1.3;
  color: #ffffff;
}

.wa-mobile-more-row__chevron {
  color: rgba(226, 232, 240, 0.72);
  font-size: 1.08rem;
  line-height: 1;
}

.wa-mobile-more-row.is-active {
  background: rgba(47, 107, 255, 0.12);
}

.wa-mobile-more-row--quick {
  background: rgba(34, 197, 94, 0.08);
}

.wa-mobile-more-row--danger .wa-mobile-more-row__icon,
.wa-mobile-more-row--danger .wa-mobile-more-row__text {
  color: #ffd6d6;
}

@media (min-width: 769px) {
  .wa-mobile-more-screen {
    display: none;
  }
}
</style>
