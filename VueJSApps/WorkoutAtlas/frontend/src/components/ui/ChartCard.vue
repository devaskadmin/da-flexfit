<template>
  <SectionCard class="chart-card-shell">
    <template #header>
      <slot name="header" />
    </template>
    <slot />
  </SectionCard>
</template>

<script setup>
import SectionCard from './SectionCard.vue'
</script>