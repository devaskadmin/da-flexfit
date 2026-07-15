<template>
  <button class="primary-button" type="button" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
</script>