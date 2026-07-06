<script setup>
import {ref} from "vue";

const currentYear = ref('');
currentYear.value = new Date().getFullYear();
</script>

<template>
  <div class="footer">
    <p>Copyright© {{ currentYear}} All Rights Reserved By <span class="text-primary">WorkoutAtlas</span></p>
  </div>
</template>

<style scoped>
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/FooterComponent.vue
=======
.footer {
  background: var(--wa-shell-header, #0b1017);
  border-top: 1px solid var(--wa-shell-border, rgba(120, 145, 175, 0.16));
}

.footer p {
  color: var(--wa-shell-text-secondary, #a4b0c0);
}

.footer .text-primary {
  color: var(--wa-shell-accent, var(--main-color, #3b82f6)) !important;
}
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/FooterComponent.vue

</style>