<template>
  <header class="page-header-shell">
    <div>
      <p v-if="eyebrow" class="page-header-shell__eyebrow">{{ eyebrow }}</p>
      <h1 class="page-header-shell__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header-shell__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header-shell__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>