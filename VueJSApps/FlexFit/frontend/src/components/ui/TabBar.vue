<template>
  <div class="tab-bar-shell">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="tab"
      :class="{ 'tab--active': tab.key === modelValue }"
      @click="$emit('update:modelValue', tab.key)"
    >
      <span class="tab__label">{{ tab.label }}</span>
      <span v-if="tab.value !== undefined" class="tab__value">{{ tab.value }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  tabs: { type: Array, default: () => [] },
  modelValue: { type: [String, Number], default: '' },
})

defineEmits(['update:modelValue'])
</script>