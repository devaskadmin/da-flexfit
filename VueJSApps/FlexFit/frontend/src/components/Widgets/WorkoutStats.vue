<script setup>
// v0.82.21 – Dashboard Metric Integration (date-range aware)
import { onMounted, ref, computed, watch } from 'vue';
import { API_BASE } from '@/config/env';

const props = defineProps({
  startDate: { type: String, default: null },
  endDate:   { type: String, default: null },
});

const workoutsThisWeek = ref(0);
const workoutsLastWeek = ref(0);
const weekDiff         = ref(0);
const weeklyTarget     = ref(0);
const streak           = ref(0);
const caloriesBurned   = ref(0);
const loading          = ref(true);

// +/- comparison text for Workouts This Week
const weekCompareText = computed(() => {
  if (weekDiff.value > 0) return `+${weekDiff.value} vs prior period`;
  if (weekDiff.value < 0) return `${weekDiff.value} vs prior period`;
  return 'No change vs prior period';
});

// "Target: X sessions" when a schedule exists, otherwise "Completed sessions"
const workoutsSubtext = computed(() =>
  weeklyTarget.value > 0
    ? `Target: ${weeklyTarget.value} sessions`
    : 'Completed sessions'
);

// Streak subtext
const streakSubtext = computed(() => {
  if (streak.value === 0) return 'Start streak today';
  if (streak.value >= 7) return 'Consistency improving';
  return 'Keep it going';
});

async function fetchMetrics() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (props.startDate) params.set('startDate', props.startDate);
    if (props.endDate)   params.set('endDate',   props.endDate);

    const res = await fetch(`${API_BASE}/api/dashboard/metrics?${params}`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      workoutsThisWeek.value = data.workoutsThisWeek ?? 0;
      workoutsLastWeek.value = data.workoutsLastWeek ?? 0;
      weekDiff.value         = data.weekDiff         ?? 0;
      weeklyTarget.value     = data.weeklyTarget      ?? 0;
      streak.value           = data.streak            ?? 0;
      caloriesBurned.value   = data.caloriesBurned    ?? 0;
    }
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  } finally {
    loading.value = false;
  }
}

// Re-fetch whenever the date range changes
watch([() => props.startDate, () => props.endDate], fetchMetrics);

onMounted(fetchMetrics);
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
            <small v-if="!loading" class="metric-subtext d-block">{{ workoutsSubtext }}</small>
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
.dashboard-top-box .d-flex {
  align-items: flex-start !important;
  gap: 10px;
}

.dashboard-top-box h3 {
  margin-bottom: 2px;
  line-height: 1.1;
}

.dashboard-top-box p {
  margin-bottom: 2px;
  line-height: 1.25;
}

.dashboard-top-box .metric-subtext,
.dashboard-top-box .metric-compare {
  line-height: 1.3;
  white-space: normal;
  overflow-wrap: anywhere;
}

.dashboard-top-box .metric-compare {
  opacity: 0.9;
}

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
    padding: 9px 10px !important;
    min-height: unset !important;
    height: auto !important;
  }

  /* Keep big value readable */
  .dashboard-top-box h3 {
    font-size: 1.1rem !important;
    margin-bottom: 2px !important;
    line-height: 1.2;
  }

  /* Subtitle smaller */
  .dashboard-top-box p {
    font-size: 0.68rem !important;
    margin-bottom: 2px !important;
    line-height: 1.2;
  }

  .dashboard-top-box .metric-subtext,
  .dashboard-top-box .metric-compare {
    font-size: 0.66rem;
    line-height: 1.25;
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
    padding: 8px 9px !important;
  }

  .dashboard-top-box h3 {
    font-size: 1rem !important;
  }

  .dashboard-top-box p {
    font-size: 0.64rem !important;
  }

  .dashboard-top-box .metric-subtext,
  .dashboard-top-box .metric-compare {
    font-size: 0.62rem;
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
    padding: 7px !important;
  }

  .dashboard-top-box h3 {
    font-size: 0.92rem !important;
  }

  .dashboard-top-box p {
    font-size: 0.6rem !important;
  }

  .dashboard-top-box .metric-subtext,
  .dashboard-top-box .metric-compare {
    font-size: 0.58rem;
    line-height: 1.2;
  }

  .dashboard-top-box .fa {
    font-size: 0.7rem !important;
  }
}
</style>
