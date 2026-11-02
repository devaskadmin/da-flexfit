<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const emit = defineEmits(['more'])

const props = defineProps({
  moreActive: {
    type: Boolean,
    default: false,
  },
})

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
    label: 'Plans',
    to: '/workout-builder',
    icon: 'fa-solid fa-clipboard-list',
    matches: ['/workout-builder'],
  },
  {
    label: 'Nutrition',
    to: '/Nutrition',
    icon: 'fa-solid fa-apple-whole',
    matches: ['/Nutrition'],
  },
  {
    label: 'More',
    to: null,
    icon: 'fa-solid fa-bars',
    matches: [],
    action: 'more',
  },
]

const currentPath = computed(() => String(route.path || ''))

const isActive = (item) => {
  if (item.action === 'more') {
    return props.moreActive
  }
  return item.matches.some((prefix) => currentPath.value === prefix || currentPath.value.startsWith(`${prefix}/`))
}

const handleNavClick = (item, event) => {
  if (item.action !== 'more') return
  event.preventDefault()
  emit('more')
}
</script>

<template>
  <nav class="wa-app-bottom-nav" aria-label="Bottom navigation" role="navigation">
    <component
      v-for="item in navItems"
      :is="item.to ? 'router-link' : 'button'"
      :key="item.label"
      :to="item.to || undefined"
      :type="item.to ? undefined : 'button'"
      class="wa-app-bottom-link"
      :class="{ 'is-active': isActive(item) }"
      :aria-current="isActive(item) ? 'page' : undefined"
      @click="handleNavClick(item, $event)"
    >
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </component>
  </nav>
</template>

<style scoped>
.wa-app-bottom-nav {
  --wa-mobile-bottom-nav-height: var(--wa-mobile-bottom-nav-height, 70px);
  --wa-mobile-bottom-nav-gap: var(--wa-mobile-bottom-nav-gap, 10px);
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: env(safe-area-inset-bottom);
  z-index: 1300;
  height: var(--wa-mobile-bottom-nav-height);
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
  appearance: none;
  border: 0;
  background: transparent;
  text-decoration: none;
  color: var(--wa-text-secondary, #c7d0e3);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 9px;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  min-width: 0;
  min-height: 100%;
  padding: 4px 2px;
  cursor: pointer;
}

.wa-app-bottom-link i {
  font-size: 14px;
  line-height: 1;
}

.wa-app-bottom-link span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wa-app-bottom-link.is-active {
  color: var(--wa-action-blue, #4c7bff);
  background: color-mix(in srgb, var(--wa-action-blue, #4c7bff) 12%, transparent 88%);
}

.wa-app-bottom-nav {
  display: none;
}

@media (min-width: 769px) {
  .wa-app-bottom-nav {
    display: none;
  }
}

@media (max-width: 768px) {
  .wa-app-bottom-nav {
    display: grid;
    left: 10px;
    right: 10px;
    padding: 3px;
  }

  .wa-app-bottom-link:nth-child(1) i {
    color: #60A5FA;
  }

  .wa-app-bottom-link:nth-child(2) i {
    color: #4ADE80;
  }

  .wa-app-bottom-link:nth-child(3) i {
    color: #FB923C;
  }

  .wa-app-bottom-link:nth-child(4) i {
    color: #F87171;
  }

  .wa-app-bottom-link:nth-child(1).is-active {
    color: #60A5FA !important;
    background: color-mix(in srgb, #60A5FA 14%, transparent 86%) !important;
  }

  .wa-app-bottom-link:nth-child(2).is-active {
    color: #4ADE80 !important;
    background: color-mix(in srgb, #4ADE80 14%, transparent 86%) !important;
  }

  .wa-app-bottom-link:nth-child(3).is-active {
    color: #FB923C !important;
    background: color-mix(in srgb, #FB923C 14%, transparent 86%) !important;
  }

  .wa-app-bottom-link:nth-child(4).is-active {
    color: #F87171 !important;
    background: color-mix(in srgb, #F87171 14%, transparent 86%) !important;
  }

  .wa-app-bottom-link {
    gap: 3px;
    border-radius: 8px;
    padding: 4px 1px;
  }

  .wa-app-bottom-link i {
    font-size: 13px;
  }
}

@media (max-width: 360px) {
  .wa-app-bottom-nav {
    left: 8px;
    right: 8px;
  }

  .wa-app-bottom-link {
    font-size: 10px;
    gap: 2px;
  }
}
</style>