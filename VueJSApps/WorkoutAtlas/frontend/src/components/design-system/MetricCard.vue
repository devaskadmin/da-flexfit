<template>
  <article class="ff-metric">
    <p class="mb-1 text-uppercase small">{{ label }}</p>
    <strong class="d-block fs-4">{{ value }}</strong>
    <small v-if="meta" class="text-secondary">{{ meta }}</small>
    <slot />
  </article>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '--' },
  meta: { type: String, default: '' },
})
</script>
