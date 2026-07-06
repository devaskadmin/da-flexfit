<script setup>
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
  <div class="app-page-shell">
    <div class="app-page-canvas app-inner-shell view-profile-page">
      <section class="view-profile-header ff-page-header app-header-gradient">
        <div>
          <h2>View Profile</h2>
          <p>Manage your athlete profile, goals, and activity.</p>
        </div>
      </section>

      <section class="view-profile-layout">
        <article class="app-section-card vp-card vp-profile-card">
          <div class="vp-card-head">
            <h5 class="vp-card-title">Athlete Profile</h5>
            <div class="dropdown">
              <button class="btn btn-sm btn-icon btn-outline-primary" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fa-solid fa-ellipsis"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-sm dropdown-menu-sm-end">
                <li><router-link :to="{ name: 'edit_profile'}" class="dropdown-item"><i class="fa-regular fa-pen-to-square"></i> Edit Information</router-link></li>
              </ul>
            </div>
          </div>

          <div class="vp-profile-top">
            <div class="vp-image-wrap">
              <div class="vp-avatar rounded-circle overflow-hidden">
                <img src="@/assets/images/admin.png" alt="admin">
              </div>
              <button class="vp-image-change"><i class="fa-light fa-camera"></i></button>
            </div>
            <div class="vp-profile-meta">
              <h4 class="vp-admin-name">Mitchell C. Shay</h4>
              <span class="vp-admin-role">Intermediate Athlete</span>
              <div class="vp-admin-social">
                <a href="#"><i class="fa-brands fa-facebook-f"></i></a>
                <a href="#"><i class="fa-brands fa-twitter"></i></a>
                <a href="#"><i class="fa-brands fa-google"></i></a>
                <a href="#"><i class="fa-brands fa-instagram"></i></a>
              </div>
            </div>
          </div>

          <div class="vp-profile-bottom">
            <h6 class="vp-subtitle">Fitness Snapshot</h6>
            <ul class="vp-snapshot-list">
              <li><span>Primary Goal:</span>Body Recomposition</li>
              <li><span>Current Weight:</span>198.2 lbs</li>
              <li><span>Target Weight:</span>185 lbs</li>
              <li><span>Resting HR:</span>61 bpm</li>
              <li><span>Weekly Target:</span>5 sessions</li>
            </ul>
            <h6 class="vp-subtitle">Coach Note</h6>
            <p class="vp-note">Keep progression linear this week. Prioritize protein and sleep consistency to support recovery.</p>
          </div>
        </article>

        <div class="profile-right-stack">
          <article class="app-section-card vp-card">
            <div class="vp-card-head">
              <h5 class="vp-card-title">Goals & Progress</h5>
            </div>
            <div class="goal-list">
              <article v-for="goal in goals" :key="goal.name" class="goal-row">
                <div>
                  <strong>{{ goal.name }}</strong>
                  <p>Current: {{ goal.current }} • Target: {{ goal.target }}</p>
                </div>
                <span class="goal-status">{{ goal.status }}</span>
              </article>
            </div>
          </article>

          <article class="app-section-card vp-card">
            <div class="vp-card-head">
              <h5 class="vp-card-title">Recent Workouts</h5>
            </div>
            <div class="recent-workout-list">
              <article v-for="workout in recentWorkouts" :key="workout.title + workout.date" class="recent-workout-item">
                <div>
                  <strong>{{ workout.title }}</strong>
                  <p>{{ workout.date }} • {{ workout.duration }}</p>
                </div>
                <span>{{ workout.calories }} kcal</span>
              </article>
            </div>
          </article>

          <article class="app-section-card vp-card">
            <div class="vp-card-head">
              <h5 class="vp-card-title">Activity History</h5>
            </div>
            <div class="activity-list">
              <article v-for="item in activityHistory" :key="item.time + item.event" class="activity-item">
                <strong>{{ item.event }}</strong>
                <p>{{ item.detail }}</p>
                <span>{{ item.time }}</span>
              </article>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.view-profile-page {
  --ff-app-inner-max-width: 960px;
  --vp-surface-1: var(--wa-shell-surface, #121923);
  --vp-surface-2: var(--wa-shell-surface-elevated, #17212d);
  --vp-surface-3: var(--wa-shell-surface-soft, #1d2a38);
  --vp-border: var(--wa-shell-border, rgba(120, 145, 175, 0.16));
  --vp-border-strong: var(--wa-shell-border-strong, rgba(120, 145, 175, 0.24));
  --vp-text: var(--wa-shell-text, #f8fafc);
  --vp-text-secondary: var(--wa-shell-text-secondary, #a4b0c0);
  --vp-text-muted: var(--wa-shell-text-muted, #738196);
  --vp-accent: var(--wa-shell-accent, var(--main-color, #3b82f6));
  width: min(100%, var(--ff-app-inner-max-width, 900px));
  margin: 0 auto;
  padding-inline: var(--ff-app-inner-padding-x, clamp(12px, 2vw, 20px));
  box-sizing: border-box;
  gap: 16px;
}

.view-profile-header {
  border: 1.5px solid var(--vp-border-strong);
  background: linear-gradient(135deg, rgba(15, 25, 39, 0.98), rgba(20, 31, 47, 0.95)) !important;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

.view-profile-header h2 {
  margin: 0;
  font-size: 1.34rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.view-profile-header p {
  margin: 4px 0 0;
  color: var(--vp-text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
}

.view-profile-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.profile-right-stack {
  display: grid;
  gap: 14px;
}

.vp-card {
  border-radius: 18px;
  padding: 16px;
  border: 1.5px solid var(--vp-border-strong);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  background: var(--vp-surface-1);
}

.vp-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1.5px solid var(--vp-border);
}

.vp-card-title {
  margin: 0;
  color: var(--vp-text);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.008em;
}

.vp-card-head .btn.btn-icon {
  min-width: 40px;
  min-height: 40px;
  background: var(--vp-surface-2);
  border-color: var(--vp-border-strong);
  color: var(--vp-text-secondary);
}

.vp-card-head .btn.btn-icon:hover,
.vp-card-head .btn.btn-icon:focus-visible {
  background: var(--vp-surface-3);
  border-color: color-mix(in srgb, var(--vp-accent) 44%, var(--vp-border) 56%);
  color: #93c5fd;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-accent) 24%, transparent 76%);
}

.vp-card-head .dropdown-menu {
  background: var(--vp-surface-2);
  border: 1px solid var(--vp-border-strong);
}

.vp-card-head .dropdown-item {
  color: var(--vp-text-secondary);
}

.vp-card-head .dropdown-item:hover,
.vp-card-head .dropdown-item:focus {
  background: var(--vp-surface-3);
  color: var(--vp-text);
}

.vp-profile-top {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.vp-image-wrap {
  position: relative;
  width: 116px;
}

.vp-avatar {
  width: 116px;
  height: 116px;
  border-radius: 50%;
  border: 1.5px solid var(--vp-border-strong);
  background: var(--vp-surface-2);
}

.vp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vp-image-change {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--vp-accent) 44%, var(--vp-border) 56%);
  background: color-mix(in srgb, var(--vp-accent) 22%, var(--vp-surface-2) 78%);
  color: #bfdbfe;
  display: grid;
  place-items: center;
}

.vp-profile-meta {
  display: grid;
  gap: 4px;
}

.vp-admin-name {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 600;
  color: var(--vp-text);
}

.vp-admin-role {
  color: var(--vp-text-secondary);
  font-size: 0.86rem;
  font-weight: 500;
}

.vp-admin-social {
  display: flex;
  gap: 10px;
}

.vp-admin-social a {
  color: #2563eb;
  font-size: 1rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  background: color-mix(in srgb, var(--vp-accent) 12%, var(--vp-surface-2) 88%);
  border: 1px solid color-mix(in srgb, var(--vp-accent) 34%, var(--vp-border) 66%);
}

.vp-admin-social a:hover,
.vp-admin-social a:focus-visible {
  color: #93c5fd;
  background: color-mix(in srgb, var(--vp-accent) 22%, var(--vp-surface-2) 78%);
}

.vp-profile-bottom {
  display: grid;
  gap: 10px;
}

.vp-subtitle {
  margin: 0;
  color: #93c5fd;
  font-size: 0.88rem;
  font-weight: 600;
}

.vp-snapshot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.vp-snapshot-list li {
  color: var(--vp-text);
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.45;
}

.vp-snapshot-list li span {
  margin-right: 6px;
  color: var(--vp-text-secondary);
  font-weight: 500;
}

.vp-note {
  margin: 0;
  color: var(--vp-text-secondary);
  font-size: 0.88rem;
  line-height: 1.45;
  font-weight: 500;
  background: var(--vp-surface-2);
  border: 1px solid var(--vp-border);
  border-radius: 10px;
  padding: 10px;
}

.goal-list,
.recent-workout-list,
.activity-list {
  display: grid;
  gap: 10px;
}

.goal-list {
  display: grid;
  gap: 10px;
}

.goal-row {
  border: 1px solid var(--vp-border);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  background: var(--vp-surface-2);
}

.goal-row strong { color: var(--vp-text); font-size: 0.92rem; font-weight: 600; }
.goal-row p { margin: 4px 0 0; color: var(--vp-text-secondary); font-size: 0.8rem; font-weight: 500; }

.goal-status {
  align-self: center;
  color: #93c5fd;
  border: 1px solid color-mix(in srgb, #3b82f6 58%, var(--vp-border) 42%);
  background: color-mix(in srgb, #3b82f6 18%, var(--vp-surface-2) 82%);
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 0.74rem;
  font-weight: 500;
  white-space: nowrap;
}

.goal-list .goal-row:nth-child(2) .goal-status {
  color: #86efac;
  border-color: color-mix(in srgb, #16a34a 58%, var(--vp-border) 42%);
  background: color-mix(in srgb, #16a34a 18%, var(--vp-surface-2) 82%);
}

.goal-list .goal-row:nth-child(3) .goal-status {
  color: #fdba74;
  border-color: color-mix(in srgb, #f97316 58%, var(--vp-border) 42%);
  background: color-mix(in srgb, #f97316 18%, var(--vp-surface-2) 82%);
}

.recent-workout-list {
  display: grid;
  gap: 8px;
}

.recent-workout-item {
  border: 1px solid var(--vp-border);
  border-radius: 10px;
  padding: 9px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--vp-surface-2);
}

.recent-workout-item strong { color: var(--vp-text); font-size: 0.92rem; font-weight: 600; }
.recent-workout-item p { margin: 3px 0 0; color: var(--vp-text-secondary); font-size: 0.8rem; font-weight: 500; }
.recent-workout-item span { color: #4ade80; font-weight: 600; font-size: 0.78rem; }

.activity-item {
  border: 1px solid var(--vp-border);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 4px;
  background: var(--vp-surface-2);
}

.activity-item strong {
  color: var(--vp-text);
  font-size: 0.88rem;
  font-weight: 600;
}

.activity-item p {
  margin: 0;
  color: var(--vp-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
}

.activity-item span {
  color: var(--vp-text-muted);
  font-size: 0.76rem;
  font-weight: 500;
}

@media (max-width: 768px) {
  .vp-card-head .btn.btn-icon,
  .vp-image-change,
  .vp-admin-social a {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (min-width: 992px) {
  .view-profile-layout {
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .vp-profile-top {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 14px;
  }
}

</style>