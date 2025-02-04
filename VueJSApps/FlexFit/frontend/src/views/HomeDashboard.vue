<script setup>
import {onMounted, ref} from "vue";
import WorkoutStatsComponent from "@/components/Widgets/WorkoutStats.vue";
import NutritionLogChart from "@/components/widgets/NutritionLogChart.vue";
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
</template>

<style scoped>
.row {
  margin-bottom: 20px; /* Consistent spacing between rows */
}

.dashboard-breadcrumb {
  margin-bottom: 20px;
}
</style>