<script setup>
import { ref, reactive, computed } from "vue";
import DateRangePicker from "@/components/template/DateRangePicker.vue";


import flatPickr from 'vue-flatpickr-component';

import 'flatpickr/dist/flatpickr.css';

const workoutType = ref("Strength");
const exercise = reactive({
  name: "",
  sets: "",
  reps: "",
  weight: "",
  duration: "",
});

const workoutList = ref([]);

const addExercise = () => {
  workoutList.value.push({ ...exercise });
  exercise.name = "";
  exercise.sets = "";
  exercise.reps = "";
  exercise.weight = "";
  exercise.duration = "";
};

const estimatedCalories = computed(() => {
  if (workoutType.value === "Cardio") {
    return exercise.duration ? exercise.duration * 10 : 0; // Simplified calorie estimate
  } else if (workoutType.value === "Strength") {
    return exercise.sets && exercise.reps
      ? exercise.sets * exercise.reps * 0.5
      : 0;
  }
  return 0;
});
</script>

<template>
  <!--End of BreadCrumb-->
  <div class="dashboard-breadcrumb mb-25">
    <h2>Log Workout</h2>
    <DateRangePicker />
  </div>
  <!--End of BreadCrumb-->
  <div class="container mt-8">
        <div class="panel">
          <div class="panel-header">
            <h5>Log Your Workout</h5>
          </div>
          
          <div class="panel-body">
            <div class="row g-3">
              <div class="col-md-3">
                <label class="form-label">Workout Type</label>
                <select v-model="workoutType" class="form-select">
                  <option value="Strength">Strength</option>
                  <option value="Cardio">Cardio</option>
                </select>
              </div>
              <div class="col-md-3" v-if="workoutType === 'Strength'">
                <label class="form-label">Exercise Name</label>
                <input
                  v-model="exercise.name"
                  type="text"
                  class="form-control"
                  placeholder="e.g., Bench Press"
                />
              </div>
              <div class="col-md-2" v-if="workoutType === 'Strength'">
                <label class="form-label">Sets</label>
                <input
                  v-model="exercise.sets"
                  type="number"
                  class="form-control"
                  placeholder="e.g., 3"
                />
              </div>
              <div class="col-md-2" v-if="workoutType === 'Strength'">
                <label class="form-label">Reps</label>
                <input
                  v-model="exercise.reps"
                  type="number"
                  class="form-control"
                  placeholder="e.g., 12"
                />
              </div>
              <div class="col-md-2" v-if="workoutType === 'Strength'">
                <label class="form-label">Weight (lbs)</label>
                <input
                  v-model="exercise.weight"
                  type="number"
                  class="form-control"
                  placeholder="e.g., 150"
                />
              </div>
              <div class="col-md-3" v-if="workoutType === 'Cardio'">
                <label class="form-label">Duration (minutes)</label>
                <input
                  v-model="exercise.duration"
                  type="number"
                  class="form-control"
                  placeholder="e.g., 30"
                />
              </div>
              <div class="col-md-12">
                <button @click="addExercise" class="btn btn-primary">
                  Add Exercise
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel mt-4">
          <div class="panel-header">
            <h5>Workout Summary</h5>
          </div>
          <div class="panel-body">
            <ul class="list-group">
              <li
                class="list-group-item"
                v-for="(workout, index) in workoutList"
                :key="index">
                <strong>{{ workoutType }}:</strong>
                {{ workout.name }} | Sets: {{ workout.sets }} | Reps: {{
                  workout.reps
                }} | Weight: {{ workout.weight }} lbs | Duration: {{
                  workout.duration
                }} min
              </li>
            </ul>
            <div class="mt-3">
              <strong>Estimated Calories Burned:</strong>
              {{ estimatedCalories }} kcal
            </div>
          </div>
        </div>
      </div>

</template>

<style scoped>
.dashboard-breadcrumb {
  margin-bottom: 20px;
}

.main-content {
  padding: 20px;
}

.panel {
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
}
</style>
