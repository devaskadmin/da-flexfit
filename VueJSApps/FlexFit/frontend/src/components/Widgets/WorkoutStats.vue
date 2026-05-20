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

<style scoped>
/* ── Mobile metric cards ── */
@media (max-width: 768px) {
  /* 2-column grid: Workouts | Streak / Calories | Points */
  .row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  /* Reset Bootstrap col classes inside the grid */
  .col-lg-3,
  .col-6,
  .col-xs-12 {
    width: auto !important;
    max-width: 100% !important;
    flex: unset !important;
    padding: 0 !important;
  }

  /* Compact card */
  .dashboard-top-box {
    padding: 14px 12px !important;
    min-height: unset !important;
    height: auto !important;
  }

  /* Keep metric value prominent */
  .dashboard-top-box h3 {
    font-size: 1.35rem !important;
    margin-bottom: 4px !important;
  }

  .dashboard-top-box p {
    font-size: 0.78rem !important;
    margin-bottom: 0 !important;
    line-height: 1.2;
  }

  /* Smaller icon */
  .dashboard-top-box .fa {
    font-size: 1.6rem !important;
  }
}
</style>
