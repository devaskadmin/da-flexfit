<template>
  <button class="secondary-button" type="button" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
</script>