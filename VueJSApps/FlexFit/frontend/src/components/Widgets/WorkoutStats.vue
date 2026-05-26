<script setup>
// v0.82.20 – Dashboard Live Metrics
import { onMounted, ref, computed } from 'vue';
import { API_BASE } from '@/config/env';

const workoutsThisWeek = ref(0);
const workoutsLastWeek = ref(0);
const weekDiff = ref(0);
const streak = ref(0);
const caloriesBurned = ref(0);
const loading = ref(true);

// +/- comparison text for Workouts This Week
const weekCompareText = computed(() => {
  if (weekDiff.value > 0) return `+${weekDiff.value} vs last week`;
  if (weekDiff.value < 0) return `${weekDiff.value} vs last week`;
  return 'No change vs last week';
});

// Streak subtext
const streakSubtext = computed(() => {
  if (streak.value === 0) return 'Start streak today';
  if (streak.value >= 7) return 'Consistency improving';
  return 'Keep it going';
});

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard/metrics`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      workoutsThisWeek.value = data.workoutsThisWeek ?? 0;
      workoutsLastWeek.value = data.workoutsLastWeek ?? 0;
      weekDiff.value = data.weekDiff ?? 0;
      streak.value = data.streak ?? 0;
      caloriesBurned.value = data.caloriesBurned ?? 0;
    }
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="row">

    <!-- Card 1: Workouts This Week -->
    <div class="col-lg-3 col-6 col-xs-12">
      <div class="dashboard-top-box panel-bg">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h3 class="fw-normal">{{ loading ? '—' : workoutsThisWeek }}</h3>
            <p>WORKOUTS THIS WEEK</p>
            <small v-if="!loading" class="metric-subtext d-block">Completed sessions</small>
            <small v-if="!loading" class="metric-compare d-block">{{ weekCompareText }}</small>
          </div>
          <div>
            <i class="fa fa-dumbbell"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Card 2: Current Streak -->
    <div class="col-lg-3 col-6 col-xs-12">
      <div class="dashboard-top-box panel-bg">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h3 class="fw-normal">{{ loading ? '—' : streak + 'd' }}</h3>
            <p>CURRENT STREAK</p>
            <small v-if="!loading" class="metric-subtext d-block">{{ streakSubtext }}</small>
          </div>
          <div>
            <i class="fa fa-fire"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Card 3: Points Earned (static – not part of live metrics pass) -->
    <div class="col-lg-3 col-6 col-xs-12">
      <div class="dashboard-top-box panel-bg">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h3 class="fw-normal">300</h3>
            <p>Points Earned</p>
          </div>
          <div>
            <i class="fa fa-star"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Card 4: Calories Burned -->
    <div class="col-lg-3 col-6 col-xs-12">
      <div class="dashboard-top-box panel-bg">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h3 class="fw-normal">{{ loading ? '—' : caloriesBurned }}</h3>
            <p>CALORIES BURNED</p>
            <small v-if="!loading" class="metric-subtext d-block">This week total</small>
          </div>
          <div>
            <i class="fa fa-burn"></i>
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
    gap: 5px;
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

  /* Compact card — target 95–110px tall */
  .dashboard-top-box {
    padding: 7px 9px !important;
    min-height: unset !important;
    height: auto !important;
  }

  /* Keep big value readable */
  .dashboard-top-box h3 {
    font-size: 1.05rem !important;
    margin-bottom: 0 !important;
    line-height: 1.2;
  }

  /* Subtitle smaller */
  .dashboard-top-box p {
    font-size: 0.65rem !important;
    margin-bottom: 0 !important;
    line-height: 1.15;
  }

  /* Icon closer to right edge, smaller */
  .dashboard-top-box .fa {
    font-size: 0.85rem !important;
    margin-right: 2px;
  }
}

@media (max-width: 480px) {
  .row {
    gap: 4px;
  }

  .dashboard-top-box {
    padding: 6px 8px !important;
  }

  .dashboard-top-box h3 {
    font-size: 0.95rem !important;
  }

  .dashboard-top-box p {
    font-size: 0.6rem !important;
  }

  .dashboard-top-box .fa {
    font-size: 0.78rem !important;
  }
}

@media (max-width: 390px) {
  .row {
    gap: 3px;
  }

  .dashboard-top-box {
    padding: 5px 6px !important;
  }

  .dashboard-top-box h3 {
    font-size: 0.88rem !important;
  }

  .dashboard-top-box p {
    font-size: 0.57rem !important;
  }

  .dashboard-top-box .fa {
    font-size: 0.7rem !important;
  }
}
</style>
