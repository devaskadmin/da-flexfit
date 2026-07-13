<template>
  <Card class="section-card-shell">
    <header v-if="$slots.header" class="section-card-shell__header">
      <slot name="header" />
    </header>
    <div class="section-card-shell__body">
      <slot />
    </div>
  </Card>
</template>

<script setup>
import Card from './Card.vue'
</script>