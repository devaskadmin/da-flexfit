<script setup>
import { ref } from "vue";

// Assigned Workouts Data
const assignedWorkouts = [
  { name: "Upper Body Strength", due: "Nov 25", trainer: "Coach A", progress: 80 },
  { name: "Cardio Blitz", due: "Nov 26", trainer: "Coach B", progress: 60 },
  { name: "Flexibility Flow", due: "Nov 27", trainer: "Coach C", progress: 50 },
  { name: "Core Stability", due: "Nov 28", trainer: "Coach D", progress: 70 },
  { name: "Power Lifting", due: "Nov 29", trainer: "Coach E", progress: 90 },
];

// Trainer Notes Data
const trainerNotes = [
  "Focus on form for Upper Body Strength.",
  "Increase resistance for Cardio Blitz.",
  "Add flexibility drills before Flexibility Flow.",
];

// Toggle visibility of Trainer Notes
const showNotes = ref(false);

const toggleNotes = () => {
  showNotes.value = !showNotes.value;
};
</script>

<template>
  <div class="panel assigned-workouts-panel">
    <div class="panel-header d-flex justify-content-between align-items-center">
      <h5>Assigned Workouts</h5>
      <a href="#" class="btn btn-sm btn-outline-primary">View All</a>
    </div>
    <div class="panel-body">
      <!-- Assigned Workouts Table -->
      <div class="table-responsive">
        <table class="table table-striped mb-0 recent-project-table">
          <thead>
            <tr>
              <th>Workout Name</th>
              <th>Due Date</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(workout, index) in assignedWorkouts" :key="index">
              <td>
                <span>{{ workout.name }}</span>
                <span class="d-block text-muted">Trainer: {{ workout.trainer }}</span>
              </td>
              <td>{{ workout.due }}</td>
              <td>
                <div class="progress" role="progressbar" :aria-valuenow="workout.progress" aria-valuemin="0" aria-valuemax="100">
                  <div
                    class="progress-bar bg-primary"
                    :style="{ width: workout.progress + '%' }"
                  ></div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Toggleable Trainer's Notes -->
      <div class="mt-3 text-end">
        <button class="btn btn-sm btn-outline-secondary" @click="toggleNotes">
          {{ showNotes ? "Hide Notes" : "Show Notes" }}
        </button>
      </div>
      <div v-if="showNotes" class="mt-2">
        <ul class="list-unstyled">
          <li v-for="(note, index) in trainerNotes" :key="index">- {{ note }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  min-height: 360px; /* Adjust this value to align with the chart */
}

.progress-bar {
  transition: width 0.4s ease;
}

.panel-body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
</style>
