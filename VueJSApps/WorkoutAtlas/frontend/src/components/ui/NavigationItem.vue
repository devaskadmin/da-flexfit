<template>
  <router-link :to="to" class="sidebar-link" :class="{ active }">
    <slot />
  </router-link>
</template>

<script setup>
defineProps({
  to: { type: [String, Object], required: true },
  active: { type: Boolean, default: false },
})
</script>