<template>
  <article class="ff-card ff-glass" :class="customClass">
    <slot />
  </article>
</template>

<script setup>
const props = defineProps({
  customClass: {
    type: [String, Array, Object],
    default: '',
  },
})
</script>
