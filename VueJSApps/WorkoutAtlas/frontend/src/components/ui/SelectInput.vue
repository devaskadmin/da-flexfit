<template>
  <label class="form-field-shell">
    <span v-if="label" class="form-field-shell__label">{{ label }}</span>
    <select v-bind="$attrs" class="form-select">
      <slot />
    </select>
  </label>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineProps({
  label: { type: String, default: '' },
})
</script>