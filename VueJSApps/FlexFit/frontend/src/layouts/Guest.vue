<script setup>
import { onBeforeMount, watchEffect, ref } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const routeName = ref('');
const errorRoutes = ref([
  'error_400', 'error_403', 'error_404', 'error_408',
  'error_500', 'error_503', 'error_504', 'pricing_table'
]);

watchEffect(() => {
  routeName.value = route.name;

  const body = document.body;

  // Remove padding classes first
  body.classList.remove('body-padding', 'body-p-top');

  // Then optionally re-add based on route
  if (!errorRoutes.value.includes(routeName.value)) {
    body.classList.add('body-padding', 'body-p-top');
  }
});
</script>


<template>
  <div
    class="main-content login-panel"
    :class="[
      errorRoutes.includes(routeName) ? 'p-0' : '',
      routeName === 'login' ? 'login-background' : '',
      routeName === 'registration' ? 'registration-background' : '',
      routeName === 'login_3' ? 'login-panel-3' : ''
    ]"
  >
    <slot></slot>
  </div>
</template>


<style scoped>
 .light-theme .main-content.login-panel {
  background: url('@/assets/images/login-background2.jpg') center center no-repeat;
  background-size: cover;
}

.light-theme .main-content.registration-background {
  background: url('@/assets/images/login-background.jpg') center center no-repeat;
  background-size: cover;
}


</style>