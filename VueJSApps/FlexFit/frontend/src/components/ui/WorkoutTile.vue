<template>
  <Card class="workout-tile-shell">
    <div class="workout-tile-shell__title">{{ title }}</div>
    <div class="workout-tile-shell__subtitle">{{ subtitle }}</div>
    <div v-if="meta" class="workout-tile-shell__meta">{{ meta }}</div>
  </Card>
</template>

<script setup>
import Card from './Card.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  meta: { type: String, default: '' },
})
</script>