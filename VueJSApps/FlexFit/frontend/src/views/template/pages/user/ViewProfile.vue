<script setup>
import DashboardBreadcrumb from "@/components/template/DashboardBreadcrumb.vue";

const goals = [
  { name: 'Lose Body Fat', target: '18%', current: '21%', status: 'In Progress' },
  { name: 'Bench Press', target: '225 lbs', current: '205 lbs', status: 'On Track' },
  { name: 'Weekly Sessions', target: '5 workouts', current: '4 workouts', status: 'Needs 1 more' },
];

const recentWorkouts = [
  { date: 'Today', title: 'Upper Body Strength', duration: '55 min', calories: 420 },
  { date: 'Yesterday', title: 'Lower Body Power', duration: '60 min', calories: 510 },
  { date: '2 days ago', title: 'Zone 2 Cardio', duration: '40 min', calories: 310 },
];

const activityHistory = [
  { time: '07:12 AM', event: 'Logged breakfast', detail: 'Oats + whey + banana' },
  { time: '12:05 PM', event: 'Updated weight', detail: '198.2 lbs' },
  { time: '05:44 PM', event: 'Workout complete', detail: 'Upper Body Strength' },
  { time: '08:22 PM', event: 'Hit hydration target', detail: '3.0L water' },
];
</script>

<template>
  <DashboardBreadcrumb>
    <template #title>View Profile</template>
  </DashboardBreadcrumb>
  <div class="row g-4">
    <div class="col-md-4">
      <div class="panel">
        <div class="panel-body">
          <div class="profile-sidebar">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="profile-sidebar-title">Athlete Profile</h5>
              <div class="dropdown">
                <button class="btn btn-sm btn-icon btn-outline-primary" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  <i class="fa-solid fa-ellipsis"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-sm dropdown-menu-sm-end">
                  <li><router-link :to="{ name: 'edit_profile'}" class="dropdown-item"><i class="fa-regular fa-pen-to-square"></i> Edit Information</router-link></li>
                </ul>
              </div>
            </div>
            <div class="top">
              <div class="image-wrap">
                <div class="part-img rounded-circle overflow-hidden">
                  <img src="@/assets/images/admin.png" alt="admin">
                </div>
                <button class="image-change"><i class="fa-light fa-camera"></i></button>
              </div>
              <div class="part-txt">
                <h4 class="admin-name">Mitchell C. Shay</h4>
                <span class="admin-role">Intermediate Athlete</span>
                <div class="admin-social">
                  <a href="#"><i class="fa-brands fa-facebook-f"></i></a>
                  <a href="#"><i class="fa-brands fa-twitter"></i></a>
                  <a href="#"><i class="fa-brands fa-google"></i></a>
                  <a href="#"><i class="fa-brands fa-instagram"></i></a>
                </div>
              </div>
            </div>
            <div class="bottom">
              <h6 class="profile-sidebar-subtitle">Fitness Snapshot</h6>
              <ul>
                <li><span>Primary Goal:</span>Body Recomposition</li>
                <li><span>Current Weight:</span>198.2 lbs</li>
                <li><span>Target Weight:</span>185 lbs</li>
                <li><span>Resting HR:</span>61 bpm</li>
                <li><span>Weekly Target:</span>5 sessions</li>
              </ul>
              <h6 class="profile-sidebar-subtitle">Coach Note</h6>
              <p>Keep progression linear this week. Prioritize protein and sleep consistency to support recovery.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-8">
      <div class="panel mb-25">
        <div class="panel-header">
          <h5>Goals & Progress</h5>
        </div>
        <div class="panel-body">
          <div class="goal-list">
            <article v-for="goal in goals" :key="goal.name" class="goal-row">
              <div>
                <strong>{{ goal.name }}</strong>
                <p>Current: {{ goal.current }} • Target: {{ goal.target }}</p>
              </div>
              <span class="goal-status">{{ goal.status }}</span>
            </article>
          </div>
        </div>
      </div>

      <div class="panel mb-25">
        <div class="panel-header">
          <h5>Recent Workouts</h5>
        </div>
        <div class="panel-body recent-workout-list">
          <article v-for="workout in recentWorkouts" :key="workout.title + workout.date" class="recent-workout-item">
            <div>
              <strong>{{ workout.title }}</strong>
              <p>{{ workout.date }} • {{ workout.duration }}</p>
            </div>
            <span>{{ workout.calories }} kcal</span>
          </article>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h5>Activity History</h5>
        </div>
        <div class="panel-body">
          <div class="user-activity">
            <ul>
              <li v-for="item in activityHistory" :key="item.time + item.event">
                <div class="left">
                  <span class="user-activity-title">{{ item.event }}</span>
                  <span class="user-activity-details">{{ item.detail }}</span>
                  <span class="user-activity-date">{{ item.time }}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.goal-list {
  display: grid;
  gap: 10px;
}

.goal-row {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.goal-row strong { color: var(--text-color); }
.goal-row p { margin: 4px 0 0; color: var(--text-color-secondary); font-size: 0.82rem; }

.goal-status {
  align-self: center;
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.5);
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 0.74rem;
}

.recent-workout-list {
  display: grid;
  gap: 8px;
}

.recent-workout-item {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 9px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recent-workout-item strong { color: var(--text-color); }
.recent-workout-item p { margin: 3px 0 0; color: var(--text-color-secondary); font-size: 0.8rem; }
.recent-workout-item span { color: #4ade80; font-weight: 700; font-size: 0.8rem; }

</style>