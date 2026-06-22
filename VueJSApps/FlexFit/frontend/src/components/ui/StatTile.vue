<template>
  <Card class="stat-tile-shell">
    <div class="stat-tile-shell__label">{{ label }}</div>
    <div class="stat-tile-shell__value">{{ value }}</div>
    <div v-if="trend" class="stat-tile-shell__trend">{{ trend }}</div>
  </Card>
</template>

<script setup>
import Card from './Card.vue'

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  trend: { type: String, default: '' },
})
</script>