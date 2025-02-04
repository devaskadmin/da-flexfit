<script setup>
const stats = [
  { title: "Workouts This Week", value: "5", icon: "fa-dumbbell" },
  { title: "Streak", value: "7 Days", icon: "fa-fire" },
  { title: "Points Earned", value: "300", icon: "fa-star" },
  { title: "Calories Burned", value: "1500", icon: "fa-burn" },
];
</script>

<template>
  <div class="row">
    <div
      v-for="(stat, index) in stats"
      :key="index"
      class="col-lg-3 col-6 col-xs-12"
    >
      <div class="dashboard-top-box panel-bg">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h3 class="fw-normal">{{ stat.value }}</h3>
            <p>{{ stat.title }}</p>
          </div>
          <div>
            <i :class="'fa ' + stat.icon"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
