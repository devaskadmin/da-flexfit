<template>
  <Card class="metric-card-shell">
    <div class="metric-card-shell__label">{{ label }}</div>
    <div class="metric-card-shell__value">{{ value }}</div>
    <div v-if="helper" class="metric-card-shell__helper">{{ helper }}</div>
  </Card>
</template>

<script setup>
import Card from './Card.vue'

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  helper: { type: String, default: '' },
})
</script>