<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  {
    label: 'Home',
    to: '/dashboard',
    icon: 'fa-solid fa-house',
    matches: ['/dashboard'],
  },
  {
    label: 'Log',
    to: '/workout-log',
    icon: 'fa-solid fa-dumbbell',
    matches: ['/workout-log', '/workouts'],
  },
  {
    label: 'Build',
    to: '/workout-builder',
    icon: 'fa-solid fa-clipboard-list',
    matches: ['/workout-builder'],
  },
  {
    label: 'Progress',
    to: '/progress',
    icon: 'fa-solid fa-chart-line',
    matches: ['/progress'],
  },
  {
    label: 'Nutrition',
    to: '/Nutrition',
    icon: 'fa-solid fa-apple-whole',
    matches: ['/Nutrition'],
  },
]

const currentPath = computed(() => String(route.path || ''))

const isActive = (item) => {
  return item.matches.some((prefix) => currentPath.value === prefix || currentPath.value.startsWith(`${prefix}/`))
}
</script>

<template>
  <nav class="wa-app-bottom-nav" aria-label="Bottom navigation" role="navigation">
    <router-link
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="wa-app-bottom-link"
      :class="{ 'is-active': isActive(item) }"
      :aria-current="isActive(item) ? 'page' : undefined"
    >
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.wa-app-bottom-nav {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: max(10px, env(safe-area-inset-bottom));
  z-index: 70;
  height: 70px;
  border-radius: 16px;
  border: 1px solid var(--wa-border, rgba(145, 160, 200, 0.24));
  background: color-mix(in srgb, var(--wa-panel-bg, #1b2444) 92%, transparent 8%);
  backdrop-filter: blur(10px);
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: 4px;
  box-sizing: border-box;
}

.wa-app-bottom-link {
  text-decoration: none;
  color: var(--wa-text-secondary, #c7d0e3);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  min-width: 0;
}

.wa-app-bottom-link i {
  font-size: 14px;
}

.wa-app-bottom-link.is-active {
  color: var(--wa-action-blue, #4c7bff);
  background: color-mix(in srgb, var(--wa-action-blue, #4c7bff) 18%, transparent 82%);
}

@media (min-width: 768px) {
  .wa-app-bottom-nav {
    display: none;
  }
}
</style>