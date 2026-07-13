<template>
  <label class="form-field-shell">
    <span v-if="label" class="form-field-shell__label">{{ label }}</span>
    <input v-bind="$attrs" class="form-control" />
  </label>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineProps({
  label: { type: String, default: '' },
})
</script>