<template>
  <button class="ff-btn ff-btn-primary" :type="type" :disabled="disabled">
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
})
</script>
