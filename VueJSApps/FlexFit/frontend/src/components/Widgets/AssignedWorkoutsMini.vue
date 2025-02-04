<script setup>
const assignedWorkouts = [
  { name: "Upper Body Strength", due: "Nov 25", trainer: "Coach A" },
  { name: "Cardio Blitz", due: "Nov 26", trainer: "Coach B" },
];
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h5>Assigned Workouts</h5>
    </div>
    <div class="panel-body">
      <ul>
        <li v-for="(workout, index) in assignedWorkouts" :key="index">
          {{ workout.name }} - Due: {{ workout.due }} (Trainer: {{ workout.trainer }})
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>
