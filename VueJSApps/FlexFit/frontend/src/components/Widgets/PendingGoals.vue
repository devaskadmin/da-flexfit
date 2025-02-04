<script setup>
const pendingGoals = [
  { goal: "Run 5km", due: "Nov 26", status: "In Progress" },
  { goal: "Bench Press 100kg", due: "Dec 1", status: "Pending" },
  { goal: "Yoga Flexibility Test", due: "Dec 5", status: "Completed" },
];
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h5>Pending Goals</h5>
    </div>
    <div class="panel-body">
      <ul>
        <li v-for="(goal, index) in pendingGoals" :key="index">
          <strong>{{ goal.goal }}</strong> - Due: {{ goal.due }} (Status: {{ goal.status }})
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>
