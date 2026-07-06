<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import vueApexcharts from 'vue3-apexcharts';
import { API_BASE } from '@/config/env';

const props = defineProps({
  startDate: { type: String, default: null },
  endDate: { type: String, default: null },
});

const chartLoading = ref(false);
const chartError = ref('');
const chartData = ref([]);
const groupBy = ref('day');
const chartType = ref('bar');

const chartTitle = computed(() => 'Workouts Logged');
const chartSubtitle = computed(() => {
  if (groupBy.value === 'month') return 'All Exercises · Monthly View';
  if (groupBy.value === 'year') return 'All Exercises · Yearly View';
  return 'All Exercises · Daily View';
});

const chartHeight = computed(() => (chartData.value.length > 0 && chartData.value.length <= 3 ? 240 : 300));

const chartSeries = computed(() => ([
  {
    name: 'Workouts Logged',
    data: chartData.value.map((item) => item.value),
  },
]));

const chartCategories = computed(() => chartData.value.map((item) => item.label || item.date));

const chartOptions = computed(() => ({
  chart: {
    type: chartType.value,
    height: 340,
    toolbar: { show: false },
    fontFamily: 'inherit',
    background: 'transparent',
    animations: { enabled: true, easing: 'easeinout', speed: 600 },
  },
  dataLabels: { enabled: false },
  stroke: {
    curve: 'smooth',
    width: chartType.value === 'bar' ? 0 : 2.5,
  },
  fill: chartType.value === 'bar'
    ? {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.25,
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
          gradientToColors: ['#60a5fa'],
=======
          gradientToColors: ['var(--wa-shell-accent, var(--main-color, #3b82f6))'],
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
          inverseColors: false,
          opacityFrom: 0.92,
          opacityTo: 0.72,
          stops: [0, 100],
        },
      }
    : { opacity: 1 },
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  colors: ['#3b82f6'],
  xaxis: {
    categories: chartCategories.value,
    labels: {
      style: { fontSize: '10px', colors: '#94a3b8' },
=======
  colors: ['var(--wa-shell-accent, var(--main-color, #3b82f6))'],
  xaxis: {
    categories: chartCategories.value,
    labels: {
      style: { fontSize: '10px', colors: 'var(--wa-shell-text-muted, #748094)' },
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
      rotate: chartData.value.length > 14 ? -35 : 0,
      maxHeight: 50,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
      style: { fontSize: '10px', colors: '#94a3b8' },
=======
      style: { fontSize: '10px', colors: 'var(--wa-shell-text-muted, #748094)' },
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
      formatter: (value) => Number(value).toLocaleString(),
    },
  },
  grid: {
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
    borderColor: '#f1f5f9',
=======
    borderColor: 'var(--wa-shell-border, rgba(255, 255, 255, 0.09))',
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
    strokeDashArray: 5,
    padding: { top: 0, right: 8, bottom: 0, left: 4 },
  },
  tooltip: {
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
    theme: 'light',
=======
    theme: 'dark',
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
    y: { formatter: (value) => Number(value).toLocaleString() },
  },
  markers: {
    size: chartType.value === 'line' ? 3 : 0,
    colors: ['#fff'],
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
    strokeColors: ['#3b82f6'],
=======
    strokeColors: ['var(--wa-shell-accent, var(--main-color, #3b82f6))'],
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
    strokeWidth: 2,
    hover: { size: 5 },
  },
  plotOptions: {
    bar: { borderRadius: 6, columnWidth: chartData.value.length <= 5 ? '28%' : '58%' },
  },
  responsive: [
    { breakpoint: 1024, options: { chart: { height: 260 } } },
    { breakpoint: 640, options: { chart: { height: 220 } } },
  ],
}));

async function loadChart() {
  chartLoading.value = true;
  chartError.value = '';
  try {
    const params = { groupBy: groupBy.value };
    if (props.startDate) params.startDate = props.startDate;
    if (props.endDate) params.endDate = props.endDate;

    const { data } = await axios.get(`${API_BASE}/api/dashboard/metrics`, {
      params,
      withCredentials: true,
    });

    chartData.value = Array.isArray(data?.workoutsLoggedChart) ? data.workoutsLoggedChart : [];
  } catch (err) {
    console.error('Dashboard progress chart error', err);
    chartError.value = err?.response?.status === 401
      ? 'Session expired. Please log in again.'
      : 'Unable to load chart data. Please try again.';
    chartData.value = [];
  } finally {
    chartLoading.value = false;
  }
}

watch([() => props.startDate, () => props.endDate, groupBy], loadChart);

onMounted(loadChart);
</script>

<template>
  <div class="ps-card dashboard-progress-card">
    <div class="ps-card__header">
      <div class="ps-chart-header">
        <div class="ps-chart-header__left">
          <h5>Training Progress</h5>
          <span class="ps-chart-sub">{{ chartTitle }} · {{ chartSubtitle }}</span>
        </div>
        <div class="ps-chart-controls">
          <div class="ps-group-btns">
            <button class="ps-group-btn" :class="{ 'ps-group-btn--active': groupBy === 'day' }" @click="groupBy = 'day'">Week</button>
            <button class="ps-group-btn" :class="{ 'ps-group-btn--active': groupBy === 'month' }" @click="groupBy = 'month'">Month</button>
            <button class="ps-group-btn" :class="{ 'ps-group-btn--active': groupBy === 'year' }" @click="groupBy = 'year'">Year</button>
          </div>
          <div class="ps-chart-type-btns">
            <button class="ps-type-btn" :class="{ 'ps-type-btn--active': chartType === 'bar' }" @click="chartType = 'bar'">
              <i class="fa-solid fa-chart-bar"></i>
            </button>
            <button class="ps-type-btn" :class="{ 'ps-type-btn--active': chartType === 'line' }" @click="chartType = 'line'">
              <i class="fa-solid fa-chart-line"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="ps-chart-body">
      <div v-if="chartLoading" class="ps-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Loading chart…</span>
      </div>
      <div v-else-if="chartError" class="ps-state ps-state--error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>{{ chartError }}</span>
      </div>
      <div v-else-if="!chartData.length" class="ps-empty-state">
        <div class="ps-empty-icon">📊</div>
        <h6 class="ps-empty-title">No workout history found</h6>
        <div class="ps-empty-tips">
          <span>Complete workouts to generate analytics</span>
          <span>Or try a wider date range</span>
        </div>
      </div>
      <div v-else class="ps-chart-wrap">
        <vueApexcharts :type="chartType" :height="chartHeight" :options="chartOptions" :series="chartSeries" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-progress-card {
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  border: 1px solid rgba(120, 130, 150, 0.32);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
=======
  border: 1px solid var(--wa-shell-border, rgba(255, 255, 255, 0.09));
  border-radius: 12px;
  background: var(--wa-shell-surface, #111821);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
  overflow: hidden;
}

.ps-card__header {
  padding: 14px 18px;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  background: rgba(235, 240, 248, 0.65);
  border-bottom: 1px solid rgba(120, 130, 150, 0.25);
=======
  background: color-mix(in srgb, var(--wa-shell-surface-elevated, #17212d) 70%, transparent 30%);
  border-bottom: 1px solid var(--wa-shell-divider, rgba(255, 255, 255, 0.09));
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
}

.ps-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.ps-chart-header__left h5 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
=======
  color: var(--wa-shell-text, #f8fafc);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
}

.ps-chart-sub {
  display: block;
  font-size: 0.76rem;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  color: var(--text-color-secondary);
=======
  color: var(--wa-shell-text-secondary, #a5afbd);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
  margin-top: 2px;
}

.ps-chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ps-group-btns {
  display: flex;
  gap: 0;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  border: 1px solid #e2e8f0;
=======
  border: 1px solid var(--wa-shell-border, rgba(255, 255, 255, 0.09));
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
  border-radius: 8px;
  overflow: hidden;
}

.ps-group-btn {
  border: none;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  background: #f8fafc;
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-right: 1px solid #e2e8f0;
=======
  background: var(--wa-shell-surface-elevated, #17212d);
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--wa-shell-text-secondary, #a5afbd);
  cursor: pointer;
  border-right: 1px solid var(--wa-shell-border, rgba(255, 255, 255, 0.09));
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
  line-height: 1.4;
}

.ps-group-btn:last-child { border-right: none; }
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
.ps-group-btn:hover { background: #eff6ff; color: #3b82f6; }
.ps-group-btn--active { background: #3b82f6; color: #fff; }
.ps-group-btn--active:hover { background: #2563eb; color: #fff; }
=======
.ps-group-btn:hover { background: var(--wa-shell-surface-soft, #1c2734); color: var(--wa-shell-text, #f8fafc); }
.ps-group-btn--active { background: color-mix(in srgb, var(--wa-shell-accent, var(--main-color, #3b82f6)) 20%, transparent 80%); color: color-mix(in srgb, var(--wa-shell-accent, var(--main-color, #3b82f6)) 62%, #ffffff 38%); }
.ps-group-btn--active:hover { background: color-mix(in srgb, var(--wa-shell-accent, var(--main-color, #3b82f6)) 26%, transparent 74%); color: color-mix(in srgb, var(--wa-shell-accent, var(--main-color, #3b82f6)) 62%, #ffffff 38%); }
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue

.ps-chart-type-btns {
  display: flex;
  gap: 4px;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  background: #f1f5f9;
=======
  background: var(--wa-shell-surface-elevated, #17212d);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
  border-radius: 8px;
  padding: 3px;
}

.ps-type-btn {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 5px 9px;
  font-size: 0.8rem;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  color: #94a3b8;
=======
  color: var(--wa-shell-text-secondary, #a5afbd);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
.ps-type-btn:hover { color: #3b82f6; }

.ps-type-btn--active {
  background: #fff;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
=======
.ps-type-btn:hover { color: var(--wa-shell-text, #f8fafc); }

.ps-type-btn--active {
  background: color-mix(in srgb, var(--wa-shell-accent, var(--main-color, #3b82f6)) 22%, transparent 78%);
  color: color-mix(in srgb, var(--wa-shell-accent, var(--main-color, #3b82f6)) 62%, #ffffff 38%);
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
}

.ps-chart-body { padding: 8px 14px 16px; }
.ps-chart-wrap { overflow: hidden; max-height: 340px; transition: height 0.3s ease; }

.ps-state,
.ps-empty-state {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  color: var(--text-color-secondary);
=======
  color: var(--wa-shell-text-secondary, #a5afbd);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
}

.ps-state--error {
  color: #dc2626;
}

.ps-empty-icon {
  font-size: 1.5rem;
}

.ps-empty-title {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 800;
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/Widgets/ProgressChart.vue
  color: var(--text-color);
=======
  color: var(--wa-shell-text, #f8fafc);
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/Widgets/ProgressChart.vue
}

.ps-empty-tips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .ps-card__header {
    padding: 10px 12px;
  }

  .ps-chart-body {
    padding: 8px 10px 12px;
  }

  .ps-group-btn {
    padding: 4px 10px;
    font-size: 0.72rem;
  }

  .ps-type-btn {
    padding: 4px 8px;
    font-size: 0.74rem;
  }
}
</style>