<script setup>
import {onMounted, ref} from "vue";
import WorkoutStatsComponent from "@/components/Widgets/WorkoutStats.vue";
import NutritionLogChart from "@/components/Widgets/NutritionLogChart.vue";
import AssignedWorkoutsMini from "@/components/Widgets/AssignedWorkoutsMini.vue";
import ProgressChart from "@/components/Widgets/ProgressChart.vue"


import MyTasks from '@/components/Widgets/MyTasks.vue';
import PendingGoals from '@/components/Widgets/PendingGoals.vue';
import AssignedWorkouts from '@/components/Widgets/AssignedWorkouts.vue';
import UpcomingActivitiesComponent from '@/components/Widgets/UpcomingActivitiesComponent.vue';


import PictureUpload from '@/components/Widgets/PictureUpload.vue';

import DateRangePicker from "@/components/template/DateRangePicker.vue";


onMounted(() => {

})
</script>

<template>
  <div class="dashboard-page-wrapper">
  <div class="dashboard-breadcrumb mb-25">
    <h2>Welcome</h2>
    <DateRangePicker />
  </div>


  <WorkoutStatsComponent/>
  <div class="row">
    

    <!-- Bar Chart and Assigned Workouts -->
    <div class="row g-4 mt-4">
      <div class="col-lg-8">
        <ProgressChart />
      </div>
      <div class="col-lg-4">
        <AssignedWorkouts />
      </div>
    </div>

  <!-- Upcoming Activities and Pending Works -->
  <div class="row mt-4">
    <div class="col-lg-6">
      <UpcomingActivitiesComponent />
    </div>
    <div class="col-lg-6">
      <PendingGoals />
    </div>
  </div>

  <!-- Invoices and My Tasks -->
  <div class="row mt-4">
    <div class="col-lg-8">
      <NutritionLogChart />
    </div>
    <div class="col-lg-4">
      <MyTasks />
    </div>
  </div>

  <!-- Notice Board and Work Deadlines -->
  <div class="row mt-4">
    <div class="col-lg-6">
      <AssignedWorkoutsMini />
    </div>
    <div class="col-lg-6">
      <PictureUpload />
    </div>
  </div>


  </div>
  </div><!-- /.dashboard-page-wrapper -->
</template>

<style scoped>
/* ── Desktop baseline ── */
.dashboard-page-wrapper {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.row {
  margin-bottom: 20px;
}

.dashboard-breadcrumb {
  margin-bottom: 20px;
}

/* ── Mobile: 390px – 768px ── */
@media (max-width: 768px) {
  .dashboard-page-wrapper {
    overflow-x: hidden;
  }

  /* Hero / breadcrumb: stack vertically, tighter spacing */
  :deep(.dashboard-breadcrumb),
  .dashboard-breadcrumb {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border-radius: 16px;
    margin-bottom: 12px;
  }

  .dashboard-breadcrumb h2 {
    font-size: 1.3rem;
    margin-bottom: 0;
  }

  /* Compact row spacing */
  .row {
    margin-bottom: 12px;
  }

  /* Widget columns: single column, full width */
  :deep(.col-lg-8),
  :deep(.col-lg-4),
  :deep(.col-lg-6) {
    width: 100% !important;
    max-width: 100% !important;
    flex: 0 0 100% !important;
  }

  /* Reduce widget card padding */
  :deep(.panel-bg) {
    padding: 16px !important;
  }

  /* Images: never overflow */
  :deep(img) {
    max-width: 100%;
    height: auto;
  }

  /* Remove horizontal scrolling from any inner table/chart */
  :deep(.card),
  :deep(.widget),
  :deep(.chart-container) {
    overflow-x: hidden;
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>