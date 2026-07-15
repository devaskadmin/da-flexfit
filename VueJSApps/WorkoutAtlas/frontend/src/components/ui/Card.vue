<template>
  <section class="glass-card card-shell" :class="variantClass">
    <slot />
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
  },
})

const variantClass = computed(() => props.variant ? `card-shell--${props.variant}` : '')
</script>