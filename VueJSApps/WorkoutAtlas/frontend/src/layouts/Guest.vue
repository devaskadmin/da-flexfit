<script setup>
import {onBeforeMount, onMounted, ref, watchEffect} from "vue";
import {useRoute} from "vue-router";
const route = useRoute();
const routeName = ref('');
const errorRoutes = ref(['error_400', 'error_403', 'error_404', 'error_408', 'error_500', 'error_503', 'error_504', 'pricing_table']);

watchEffect(() => {
  routeName.value = route.name
})

onBeforeMount(() => {
  const body = document.body;
  document.body.classList.remove('body-padding', 'body-p-top');
  // document.body.classList.remove('classToRemove1', 'classToRemove2');
});
</script>

<template>
  <div
    class="main-content"
    :class="[
      errorRoutes.includes(routeName)
        ? 'p-0'
        : (routeName === 'login' ? 'wa-login-route' : 'login-panel'),
      routeName === 'login_3' ? 'login-panel-3' : ''
    ]"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
.main-content.wa-login-route {
  position: static;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0;
  background: var(--wa-app-bg);
}

.main-content.wa-login-route::after {
  display: none;
}

.main-content.login-panel,
.main-content.login-panel-3 {
  background: var(--wa-app-bg);
}
  

</style>
