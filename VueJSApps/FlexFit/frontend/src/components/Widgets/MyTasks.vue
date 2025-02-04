<script setup>
const tasks = [
  "Complete Morning Yoga",
  "Log Daily Nutrition",
  "Upload Progress Picture",
  "Complete Cardio Workout",
];
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h5>My Tasks</h5>
    </div>
    <div class="panel-body">
      <ul>
        <li v-for="(task, index) in tasks" :key="index">{{ task }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>
