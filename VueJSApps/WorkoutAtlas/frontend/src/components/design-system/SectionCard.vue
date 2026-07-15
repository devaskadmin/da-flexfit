<template>
  <section class="ff-card ff-glass p-3 p-lg-4" :class="customClass">
    <header v-if="title || subtitle" class="mb-3">
      <h3 class="m-0 fs-5">{{ title }}</h3>
      <p v-if="subtitle" class="m-0 mt-1 small">{{ subtitle }}</p>
    </header>
    <slot />
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  customClass: { type: [String, Array, Object], default: '' },
})
</script>
