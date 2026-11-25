<script setup>
import {onMounted, onUpdated, ref} from "vue";
import {OverlayScrollbars} from "overlayscrollbars";

const mainContentMinHeight = ref(0);

// Only write when the value actually differs (this runs on every layout update).
const ensureAppDisplayInherit = () => {
  const appElement = document.getElementById('app');
  if (appElement && appElement.style.display !== 'inherit') {
    appElement.style.display = 'inherit';
  }
};

onMounted(() => {
  ensureAppDisplayInherit();

  const windowHeight = window.innerHeight;
  mainContentMinHeight.value = windowHeight - 70;

  if (window.innerWidth < 1800) {
    mainContentMinHeight.value = windowHeight - 60;
  }
  if (window.innerWidth < 992) {
    mainContentMinHeight.value = windowHeight - 50;
  }

})

onUpdated(() => {
  ensureAppDisplayInherit();
});
</script>

<template>
  <div class="main-content" :style="{ 'min-height': mainContentMinHeight + 'px' }">
    <slot/>
  </div>
</template>

<style scoped>

</style>