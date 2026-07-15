<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const navLinks = [
  { name: 'dashboard_index', icon: 'fa-solid fa-house', label: 'Home' },
  { name: 'workouts', icon: 'fa-solid fa-clipboard-check', label: 'Log' },
  { name: 'workout_builder', icon: 'fa-solid fa-dumbbell', label: 'Build' },
  { name: 'progress_stats', icon: 'fa-solid fa-chart-line', label: 'Progress' },
  { name: 'Nutrition', icon: 'fa-solid fa-apple-whole', label: 'Nutrition' },
];

// HomeDashboard already renders its own mobile nav.
const shouldRender = computed(() => route.name !== 'dashboard_index');
</script>

<template>
  <nav v-if="shouldRender" class="ff-mobile-nav app-bottom-nav" aria-label="Bottom navigation" role="navigation">
    <router-link
      v-for="item in navLinks"
      :key="item.name"
      :to="{ name: item.name }"
      class="app-bottom-nav__link"
    >
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.ff-mobile-nav {
  display: none;
}

.app-bottom-nav__link {
  text-decoration: none;
  color: var(--wa-shell-text-secondary, #a5afbd);
  min-height: 56px;
  border-radius: 10px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
}

.app-bottom-nav__link i {
  font-size: 14px;
}

.app-bottom-nav__link.router-link-active {
  color: var(--wa-shell-accent, #2563eb);
  background: color-mix(in srgb, var(--wa-shell-accent, #2563eb) 14%, transparent 86%);
}

@media (max-width: 1024px) {
  .ff-mobile-nav {
    display: grid;
  }
}
</style>
