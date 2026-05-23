<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { API_BASE } from '@/config/env';
import vueApexcharts from 'vue3-apexcharts';
import FitnessMetricCard from '@/components/fitness/FitnessMetricCard.vue';
import DateRangePicker from '@/components/template/DateRangePicker.vue';

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().slice(0, 10); }
function last30Days() {
  const end = new Date(), start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: toDateStr(start), end: toDateStr(end) };
}

// ─── State ────────────────────────────────────────────────────────────────────
const range = last30Days();

const summary        = ref({ workoutsThisWeek: 0, currentStreak: 0, caloriesBurned: 0 });
const summaryLoading = ref(true);

const startDate       = ref(range.start);
const endDate         = ref(range.end);
const groupBy         = ref('day');
const workoutType     = ref('all');
const exerciseId      = ref('');
const metricPrimary   = ref('duration');  // valid across all workout types
const metricSecondary = ref('');   // '' = None (Y2); default off
const showRange       = ref('30'); // quick range in days; 'custom' = manual date picker

// TODO: isProUser — wire to user subscription/role when billing is implemented.
//       Free tier:  Y1 only.
//       Pro unlock: dual metric (Y2), trend overlays, period comparison, recovery score.
const isProUser = ref(false);

// Pro row (Y2 section) — collapsed by default
const proRowOpen = ref(false);

const exercises = ref([]);
const exLoading = ref(false);

const chartLoading = ref(false);
const chartError   = ref('');
const chartData    = ref([]);

// Chart type: 'bar' | 'line'
const chartType = ref('bar');

// Active exercise chip selection
const activeExChip = ref('');

// Filter panel — expanded by default in 0.82.4
const filtersOpen = ref(true);

// ─── Y1 metric options — RAW workout log data only ──────────────────────────
// Only values stored directly in workout_log rows. No formulas, no aggregates.
const metricOptions = computed(() => {
  switch (workoutType.value) {
    case 'strength':
      return [
        { value: 'weight',   label: 'Weight (lbs/kg)' },
        { value: 'reps',     label: 'Reps' },
        { value: 'sets',     label: 'Sets' },
        { value: 'duration', label: 'Duration (min)' },
      ];
    case 'cardio':
      return [
        { value: 'duration', label: 'Duration (min)' },
        { value: 'calories', label: 'Calories Burned' },
        { value: 'distance', label: 'Distance (miles)' },
        { value: 'speed',    label: 'Avg Speed (mph)' },
      ];
    case 'other':
      return [
        { value: 'duration', label: 'Duration (min)' },
        { value: 'calories', label: 'Calories Burned' },
      ];
    default: // all
      return [
        { value: 'duration', label: 'Duration (min)' },
        { value: 'calories', label: 'Calories Burned' },
      ];
  }
});

// ─── Y2 Pro metric options — advanced/calculated metrics ─────────────────────
// TODO: Pro metrics will expand with PR tracking, recovery score, trend engine.
const proMetricOptions = computed(() => {
  switch (workoutType.value) {
    case 'strength':
      return [
        { value: 'totalVolume',      label: 'Total Volume (sets × reps × weight)' },
        { value: 'maxWeight',        label: 'Max Weight' },
        { value: 'weight',           label: 'Avg Weight' },
        { value: 'avgReps',          label: 'Avg Reps Per Set' },
        { value: 'volumePerSession', label: 'Volume Per Session' },
        { value: 'workoutCount',     label: 'Workout Sessions' },
      ];
    case 'cardio':
      return [
        { value: 'maxSpeed',           label: 'Max Speed (mph)' },
        { value: 'caloriesPerSession', label: 'Calories Per Session' },
        { value: 'workoutCount',       label: 'Workout Sessions' },
      ];
    case 'other':
      return [
        { value: 'workoutCount', label: 'Workout Sessions' },
      ];
    default: // all
      return [
        { value: 'workoutCount',       label: 'Workout Sessions' },
        { value: 'completedExercises', label: 'Exercises Completed' },
      ];
  }
});

// Return the first valid Y1 metric key for a given workout type
function defaultMetricForType(type) {
  switch (type) {
    case 'strength': return 'weight';
    case 'cardio':   return 'duration';
    default:         return 'duration';
  }
}

// Ensure metrics are valid when workout type changes; reload exercise dropdown
watch(workoutType, () => {
  const allowed    = metricOptions.value.map((m) => m.value);
  const allowedPro = proMetricOptions.value.map((m) => m.value);
  // Set type-aware default rather than blindly picking allowed[0]
  if (!allowed.includes(metricPrimary.value)) {
    metricPrimary.value = defaultMetricForType(workoutType.value);
  }
  if (metricSecondary.value && !allowedPro.includes(metricSecondary.value)) metricSecondary.value = '';
  exerciseId.value   = '';
  activeExChip.value = '';
  loadExercises();
});

// ─── Computed helpers ─────────────────────────────────────────────────────────
const primaryMetricLabel = computed(() => {
  const opt = metricOptions.value.find((m) => m.value === metricPrimary.value);
  return opt ? opt.label : metricPrimary.value;
});

// Alias kept for template compatibility (Quick Insights card header, etc.)
const currentMetricLabel = primaryMetricLabel;

// Secondary metric uses Pro options (advanced/calculated metrics).
// TODO: Future Pro option: cross-type comparison (e.g., Strength volume vs Cardio calories).
const secondaryMetricOptions = computed(() => proMetricOptions.value);

const secondaryMetricLabel = computed(() => {
  if (!metricSecondary.value) return '';
  const opt = secondaryMetricOptions.value.find((m) => m.value === metricSecondary.value);
  return opt ? opt.label : metricSecondary.value;
});

const chartTitle = computed(() => {
  const base = `${primaryMetricLabel.value} Trend`;
  return metricSecondary.value ? `${base} vs ${secondaryMetricLabel.value}` : base;
});

const chartSubtitle = computed(() => {
  const exLabel = exerciseId.value
    ? (exercises.value.find((e) => e.exerciseId == exerciseId.value)?.exerciseTitle || 'Selected Exercise')
    : 'All Exercises';
  const gLabel = groupBy.value === 'day' ? 'Daily' : groupBy.value === 'month' ? 'Monthly' : 'Yearly';
  return `${exLabel} · ${gLabel} View`;
});

// (mini-stats and limited-data removed in 0.82.3 chart-first redesign)

// ─── Right-panel insights derived from chart data ─────────────────────────────
const chartInsights = computed(() => {
  const data = chartData.value;
  if (!data.length) return null;
  const values  = data.map((d) => d.value);
  const total   = values.reduce((a, b) => a + b, 0);
  const peak    = Math.max(...values);
  const avg     = total / values.length;
  const peakIdx = values.indexOf(peak);
  const bestDay = data[peakIdx]?.label || '—';

  // Trend: compare first half vs second half
  const mid    = Math.floor(values.length / 2);
  const firstH = values.slice(0, mid).reduce((a, b) => a + b, 0) / (mid || 1);
  const secH   = values.slice(mid).reduce((a, b) => a + b, 0) / ((values.length - mid) || 1);
  const diff   = secH - firstH;
  const trend  = diff > firstH * 0.05 ? '📈 Increasing' : diff < -firstH * 0.05 ? '📉 Decreasing' : '→ Stable';

  // Most active exercise (from exercises list, first chip that was last selected, or fallback)
  const mostActive = exerciseId.value
    ? (exercises.value.find((e) => String(e.exerciseId) === String(exerciseId.value))?.exerciseTitle || null)
    : null;

  // Personal best: peak is >= 2× avg
  const isPB = values.length >= 2 && peak >= avg * 2;

  return {
    sessions: data.length,
    avg:      Math.round(avg).toLocaleString(),
    peak:     Math.round(peak).toLocaleString(),
    bestDay,
    total:    Math.round(total).toLocaleString(),
    trend,
    mostActive,
    isPB,
  };
});

// Dynamic chart height: compact when sparse data
const chartHeight = computed(() => chartData.value.length > 0 && chartData.value.length <= 3 ? 240 : 300);

// Exercise chip click → auto-select filter + reload
function selectExerciseChip(ex) {
  if (activeExChip.value === ex.exerciseId) {
    activeExChip.value = '';
    exerciseId.value   = '';
  } else {
    activeExChip.value = ex.exerciseId;
    exerciseId.value   = ex.exerciseId;
    const wt = (ex.workoutType || '').toLowerCase();
    if (['strength', 'cardio', 'other'].includes(wt)) workoutType.value = wt;
  }
  // Live watcher (scheduleChartReload) handles reload automatically
}

// Exercise type icon helper
function exIcon(wt) {
  const t = (wt || '').toLowerCase();
  if (t === 'strength') return 'fa-solid fa-dumbbell';
  if (t === 'cardio')   return 'fa-solid fa-person-running';
  return 'fa-solid fa-circle-dot';
}

// ─── Debounced live filter ────────────────────────────────────────────────────
let _debounceTimer = null;
function scheduleChartReload() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(loadChart, 350);
}

// Auto-reload whenever any filter value changes
watch([startDate, endDate, groupBy, workoutType, exerciseId, metricPrimary, metricSecondary], scheduleChartReload);

// Show Range quick filter → auto-update date window ('custom' = user is using date picker, skip)
watch(showRange, (val) => {
  if (val === 'custom') return;
  const days  = Number(val);
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  endDate.value   = toDateStr(end);
  startDate.value = toDateStr(start);
  // startDate/endDate are in the watch array above — chart reloads automatically
});

// ─── Active filter chips ──────────────────────────────────────────────────────
const activeFilters = computed(() => {
  const chips = [];
  const d = last30Days();
  if (startDate.value === d.start && endDate.value === d.end) {
    chips.push({ key: 'dateRange', label: 'Last 30 Days', icon: '📅', removable: false });
  } else {
    chips.push({ key: 'dateRange', label: `${startDate.value} → ${endDate.value}`, icon: '📅', removable: true });
  }
  if (workoutType.value !== 'all') {
    const icons  = { strength: '💪', cardio: '🏃', other: '⚡' };
    const labels = { strength: 'Strength', cardio: 'Cardio', other: 'Other' };
    chips.push({ key: 'workoutType', label: labels[workoutType.value], icon: icons[workoutType.value], removable: true });
  }
  if (exerciseId.value) {
    const ex = exercises.value.find((e) => String(e.exerciseId) === String(exerciseId.value));
    chips.push({ key: 'exercise', label: ex?.exerciseTitle || 'Exercise', icon: '🏋', removable: true });
  }
  const defaultMetric = metricOptions.value[0]?.value;
  if (metricPrimary.value !== defaultMetric) {
    chips.push({ key: 'metric', label: primaryMetricLabel.value, icon: '⚖', removable: true });
  }
  if (metricSecondary.value) {
    chips.push({ key: 'metricSecondary', label: `Y2: ${secondaryMetricLabel.value}`, icon: '📊', removable: true });
  }
  return chips;
});

function removeFilter(key) {
  const d = last30Days();
  if      (key === 'dateRange')   { startDate.value = d.start; endDate.value = d.end; }
  else if (key === 'workoutType') { workoutType.value = 'all'; }
  else if (key === 'exercise')    { exerciseId.value = ''; activeExChip.value = ''; }
  else if (key === 'metric')          { metricPrimary.value   = defaultMetricForType(workoutType.value); }
  else if (key === 'metricSecondary') { metricSecondary.value = ''; }
}

// ─── Summary widgets ──────────────────────────────────────────────────────────
async function loadSummary() {
  summaryLoading.value = true;
  try {
    const { data } = await axios.get(`${API_BASE}/api/progress/summary`, { withCredentials: true });
    summary.value = data;
  } catch (err) {
    console.error('Progress summary error', err);
  } finally {
    summaryLoading.value = false;
  }
}

// ─── Exercise dropdown ────────────────────────────────────────────────────────
async function loadExercises() {
  exLoading.value = true;
  try {
    const params = {};
    if (workoutType.value && workoutType.value !== 'all') {
      params.workoutType = workoutType.value;
    }
    const { data } = await axios.get(`${API_BASE}/api/progress/exercises`, {
      params,
      withCredentials: true,
    });
    exercises.value = data;
  } catch (err) {
    console.error('Progress exercises error', err);
  } finally {
    exLoading.value = false;
  }
}

// ─── Chart data ───────────────────────────────────────────────────────────────
async function loadChart() {
  chartLoading.value = true;
  chartError.value   = '';
  try {
    const params = {
      startDate:     startDate.value,
      endDate:       endDate.value,
      groupBy:       groupBy.value,
      workoutType:   workoutType.value,
      metricPrimary: metricPrimary.value,
      metric:        metricPrimary.value, // legacy compat for older backend versions
    };
    if (metricSecondary.value && isProUser.value) {
      params.metricSecondary = metricSecondary.value;
    }
    if (exerciseId.value) params.exerciseId = exerciseId.value;

    const { data } = await axios.get(`${API_BASE}/api/progress/chart`, {
      params,
      withCredentials: true,
    });
    // Empty array = no data for this period — not an error
    chartData.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Progress chart error', err);
    // Only show error message on actual network/server failure;
    // do NOT reset summary widgets — they load independently
    chartError.value = err?.response?.status === 401
      ? 'Session expired. Please log in again.'
      : 'Unable to load chart data. Please try again.';
    chartData.value = []; // clear stale data on error
  } finally {
    chartLoading.value = false;
  }
}

function resetFilters() {
  const d = last30Days();
  startDate.value       = d.start;
  endDate.value         = d.end;
  showRange.value       = '30';
  groupBy.value         = 'day';
  workoutType.value     = 'all';
  exerciseId.value      = '';
  activeExChip.value    = '';
  metricPrimary.value   = defaultMetricForType(workoutType.value);
  metricSecondary.value = '';
  proRowOpen.value      = false;
  loadExercises();
  loadChart();
}

// ─── ApexCharts config ────────────────────────────────────────────────────────
// isDual: true when Pro user has a secondary metric selected and backend returned value2
const isDual = computed(() =>
  isProUser.value &&
  !!metricSecondary.value &&
  chartData.value.some((d) => d.value2 !== undefined)
);

const chartSeries = computed(() => {
  const series = [{
    name: primaryMetricLabel.value,
    data: chartData.value.map((d) => d.value),
  }];
  // Y2 series — only rendered when Pro + secondary selected + backend returned value2
  if (isDual.value) {
    series.push({
      name: secondaryMetricLabel.value,
      data: chartData.value.map((d) => d.value2 ?? 0),
    });
  }
  return series;
});

const chartCategories = computed(() => chartData.value.map((d) => d.label));

const chartOptions = computed(() => ({
  chart: {
    type: isDual.value ? 'line' : chartType.value,
    height: 340,
    toolbar: { show: false },
    fontFamily: 'inherit',
    background: 'transparent',
    animations: { enabled: true, easing: 'easeinout', speed: 600 },
  },
  dataLabels: { enabled: false },
  stroke: {
    curve: 'smooth',
    width:     isDual.value ? [2.5, 2]  : (chartType.value === 'bar' ? 0 : 2.5),
    dashArray: isDual.value ? [0, 6]   : 0,
  },
  fill: isDual.value
    ? { opacity: 1 }
    : (chartType.value === 'bar'
      ? {
          type: 'gradient',
          gradient: {
            shade: 'light',
            type: 'vertical',
            shadeIntensity: 0.25,
            gradientToColors: ['#60a5fa'],
            inverseColors: false,
            opacityFrom: 0.92,
            opacityTo: 0.72,
            stops: [0, 100],
          },
        }
      : { opacity: 1 }),
  colors: isDual.value ? ['#3b82f6', '#f59e0b'] : ['#3b82f6'],
  xaxis: {
    categories: chartCategories.value,
    labels: {
      style: { fontSize: '10px', colors: '#94a3b8' },
      rotate: chartData.value.length > 14 ? -35 : 0,
      maxHeight: 50,
    },
    axisBorder: { show: false },
    axisTicks:  { show: false },
  },
  yaxis: isDual.value
    ? [
        {
          seriesName: primaryMetricLabel.value,
          labels: { style: { fontSize: '10px', colors: '#3b82f6' }, formatter: (v) => Number(v).toLocaleString() },
        },
        {
          seriesName: secondaryMetricLabel.value,
          opposite: true,
          labels: { style: { fontSize: '10px', colors: '#f59e0b' }, formatter: (v) => Number(v).toLocaleString() },
        },
      ]
    : {
        labels: {
          style: { fontSize: '10px', colors: '#94a3b8' },
          formatter: (v) => Number(v).toLocaleString(),
        },
      },
  grid: {
    borderColor: '#f1f5f9',
    strokeDashArray: 5,
    padding: { top: 0, right: 8, bottom: 0, left: 4 },
  },
  tooltip: {
    theme: 'light',
    y: { formatter: (v) => Number(v).toLocaleString() },
  },
  markers: {
    size:         isDual.value || chartType.value === 'line' ? 3 : 0,
    colors:       ['#fff', '#fff'],
    strokeColors: isDual.value ? ['#3b82f6', '#f59e0b'] : ['#3b82f6'],
    strokeWidth:  2,
    hover:        { size: 5 },
  },
  plotOptions: {
    bar: { borderRadius: 6, columnWidth: chartData.value.length <= 5 ? '28%' : '58%' },
  },
  responsive: [
    { breakpoint: 1024, options: { chart: { height: 260 } } },
    { breakpoint: 640,  options: { chart: { height: 220 } } },
  ],
}));

// ─── Summary metric cards ─────────────────────────────────────────────────────
const metrics = computed(() => [
  {
    title:    'Workouts This Week',
    value:    summaryLoading.value ? '—' : summary.value.workoutsThisWeek,
    subtitle: 'Completed sessions',
    trend:    '',
    icon:     'fa-solid fa-dumbbell',
  },
  {
    title:    'Current Streak',
    value:    summaryLoading.value ? '—' : `${summary.value.currentStreak}d`,
    subtitle: summary.value.currentStreak > 0 ? '🔥 Keep going!' : 'Start a streak today',
    trend:    '',
    icon:     'fa-solid fa-fire',
  },
  {
    title:    'Calories Burned',
    value:    summaryLoading.value ? '—' : summary.value.caloriesBurned.toLocaleString(),
    subtitle: 'This week',
    trend:    '',
    icon:     'fa-solid fa-bolt',
  },
]);

// Date range handler from shared DateRangePicker component
function onDateChange([start, end]) {
  showRange.value = 'custom';
  startDate.value = start;
  endDate.value   = end;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  loadSummary();
  loadExercises();
  loadChart();
});
</script>

<template>
  <div class="app-page-shell ps-container">
    <div class="app-page-canvas app-inner-shell ps-canvas">

      <!-- ── Hero ────────────────────────────────────────────────────────── -->
      <section class="ps-hero ff-page-header app-header-gradient">
        <div class="ps-hero__inner">
          <div class="ps-hero__text">
            <h2>Progress Analytics</h2>
            <p>Track workout trends and exercise history.</p>
          </div>
          <div class="header-picker">
            <DateRangePicker @change="onDateChange" />
          </div>
        </div>
      </section>

      <!-- ── Filters ─────────────────────────────────────────────────────── -->
      <div class="ps-section-panel ps-section-panel--filter">
        <section class="ps-card ps-filter-card">
          <button class="ps-filter-toggle" @click="filtersOpen = !filtersOpen">
            <span><i class="fa-solid fa-sliders"></i> Progress Filters</span>
            <span class="ps-filter-toggle__right">
              <span class="ps-chip ps-chip--live" v-if="chartLoading" style="margin-right:6px">
                <i class="fa-solid fa-spinner fa-spin"></i> Updating…
              </span>
              <i :class="filtersOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
            </span>
          </button>

          <div v-if="filtersOpen" class="ps-filter-body">
            <!-- Row 1: primary filters -->
            <div class="ps-filter-grid">
              <div class="ps-filter-field">
                <label>Workout Type</label>
                <select v-model="workoutType" class="ps-select">
                  <option value="all">All Types</option>
                  <option value="strength">💪 Strength</option>
                  <option value="cardio">🏃 Cardio</option>
                  <option value="other">⚡ Other</option>
                </select>
              </div>
              <div class="ps-filter-field">
                <label>Exercise</label>
                <select v-model="exerciseId" class="ps-select" :disabled="exLoading">
                  <option value="">All Exercises</option>
                  <option v-for="ex in exercises" :key="ex.exerciseId" :value="ex.exerciseId">
                    {{ ex.exerciseTitle }}
                  </option>
                </select>
              </div>
              <div class="ps-filter-field">
                <label>Primary Metric (Y1)</label>
                <select v-model="metricPrimary" class="ps-select">
                  <option v-for="opt in metricOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="ps-filter-field">
                <label>Show Range</label>
                <select v-model="showRange" class="ps-select">
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                  <option value="90">90 Days</option>
                  <option value="180">180 Days</option>
                  <option value="365">365 Days</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div class="ps-filter-field ps-filter-field--action">
                <label>&nbsp;</label>
                <button class="ps-reset-btn" @click="resetFilters">
                  <i class="fa-solid fa-rotate-left"></i> Reset
                </button>
              </div>
            </div>

            <!-- Row 2: Pro Y2 section (collapsible) -->
            <div class="ps-pro-row">
              <button class="ps-pro-row__toggle" @click="proRowOpen = !proRowOpen">
                <span class="ps-pro-row__toggle-left">
                  <i class="fa-solid fa-chart-line"></i>
                  Secondary Metric (Y2)
                  <span class="ps-pro-badge">PRO</span>
                  <span v-if="metricSecondary" class="ps-pro-row__active-hint">· {{ secondaryMetricLabel }}</span>
                </span>
                <span class="ps-pro-row__toggle-right">
                  <span v-if="!isProUser" class="ps-pro-row__lock">
                    <i class="fa-solid fa-lock"></i> Upgrade to Pro
                  </span>
                  <i :class="proRowOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
                </span>
              </button>

              <div v-if="proRowOpen" class="ps-pro-row__body">
                <div v-if="!isProUser" class="ps-pro-row__gate">
                  <div class="ps-pro-gate-icon"><i class="fa-solid fa-lock"></i></div>
                  <div class="ps-pro-gate-text">
                    <strong>Pro Feature</strong>
                    <span>Overlay a second metric on the right Y-axis. Compare Weight vs Reps, Calories vs Distance, and more.</span>
                  </div>
                  <button class="ps-pro-gate-btn" disabled>Upgrade to Pro</button>
                </div>
                <div v-else class="ps-pro-row__fields">
                  <div class="ps-filter-field">
                    <label>Secondary Metric (Y2)</label>
                    <select v-model="metricSecondary" class="ps-select">
                      <option value="">None</option>
                      <option v-for="opt in secondaryMetricOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div><!-- /ps-section-panel filter -->

      <!-- ── Row 2: Chart + Mini Widgets ─────────────────────────────────── -->
      <div class="ps-section-panel">
        <div class="ps-analytics-row">

          <!-- Left col: chart -->
          <div class="ps-left-col">
            <div class="ps-card">
              <div class="ps-card__header">
                <div class="ps-chart-header">
                  <div class="ps-chart-header__left">
                    <h5>{{ chartTitle }}</h5>
                    <span class="ps-chart-sub">{{ chartSubtitle }}</span>
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
          </div><!-- /ps-left-col -->

          <!-- Right col: 3 mini stat widgets -->
          <div class="ps-right-col">

            <!-- Workouts This Week -->
            <div class="ps-card ps-mini-widget">
              <div class="ps-mini-widget__icon">
                <i class="fa-solid fa-dumbbell"></i>
              </div>
              <div class="ps-mini-widget__body">
                <span class="ps-mini-widget__label">Workouts This Week</span>
                <span class="ps-mini-widget__value">{{ summaryLoading ? '—' : summary.workoutsThisWeek }}</span>
                <span class="ps-mini-widget__sub">Completed sessions</span>
              </div>
            </div>

            <!-- Current Streak -->
            <div class="ps-card ps-mini-widget">
              <div class="ps-mini-widget__icon ps-mini-widget__icon--fire">
                <i class="fa-solid fa-fire"></i>
              </div>
              <div class="ps-mini-widget__body">
                <span class="ps-mini-widget__label">Current Streak</span>
                <span class="ps-mini-widget__value">{{ summaryLoading ? '—' : summary.currentStreak + 'd' }}</span>
                <span class="ps-mini-widget__sub">{{ summary.currentStreak > 0 ? '🔥 Keep going!' : 'Start a streak today' }}</span>
              </div>
            </div>

            <!-- Calories Burned -->
            <div class="ps-card ps-mini-widget">
              <div class="ps-mini-widget__icon ps-mini-widget__icon--bolt">
                <i class="fa-solid fa-bolt"></i>
              </div>
              <div class="ps-mini-widget__body">
                <span class="ps-mini-widget__label">Calories Burned</span>
                <span class="ps-mini-widget__value">{{ summaryLoading ? '—' : summary.caloriesBurned.toLocaleString() }}</span>
                <span class="ps-mini-widget__sub">This week</span>
              </div>
            </div>

          </div><!-- /ps-right-col -->

        </div><!-- /ps-analytics-row -->
      </div><!-- /ps-section-panel analytics -->

      <!-- ── Row 3: Exercises | Summary | Quick Insights ─────────────────── -->
      <div class="ps-section-panel">
        <div class="ps-row3">

          <!-- Col 1: Exercises Logged -->
          <div class="ps-card">
            <div class="ps-card__header">
              <div>
                <h5><i class="fa-solid fa-list-check"></i> Exercises Logged</h5>
                <p class="ps-card__subhead">Tap to filter the chart</p>
              </div>
              <span class="ps-badge">{{ exercises.length }}</span>
            </div>
            <div class="ps-card__body">
              <div v-if="exLoading" class="ps-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
              </div>
              <div v-else-if="!exercises.length" class="ps-empty-state">
                <div class="ps-empty-icon">🏋️</div>
                <h6 class="ps-empty-title">No exercises found</h6>
              </div>
              <div v-else class="ps-ex-grid">
                <button
                  v-for="ex in exercises"
                  :key="ex.exerciseId"
                  class="ps-ex-card"
                  :class="[
                    `ps-ex-card--${(ex.workoutType || 'other').toLowerCase()}`,
                    activeExChip === ex.exerciseId ? `ps-ex-card--active ps-ex-card--${(ex.workoutType || 'other').toLowerCase()}` : ''
                  ]"
                  @click="selectExerciseChip(ex)"
                >
                  <i :class="exIcon(ex.workoutType)"></i>
                  <span class="ps-ex-card__name">{{ ex.exerciseTitle }}</span>
                  <span class="ps-ex-card__type">{{ ex.workoutType || 'Other' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Col 2: Workout Summary -->
          <div class="ps-card">
            <div class="ps-card__header">
              <div>
                <h5><i class="fa-solid fa-chart-pie"></i> Workout Summary</h5>
                <p class="ps-card__subhead">Period overview</p>
              </div>
            </div>
            <div class="ps-card__body">
              <div v-if="summaryLoading" class="ps-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
              </div>
              <div v-else>
                <div class="ps-insight-row">
                  <span class="ps-insight-label"><i class="fa-solid fa-calendar-check"></i> Workouts This Week</span>
                  <span class="ps-insight-value ps-insight-value--sm">{{ summary.workoutsThisWeek }}</span>
                </div>
                <div class="ps-insight-row">
                  <span class="ps-insight-label"><i class="fa-solid fa-fire"></i> Current Streak</span>
                  <span class="ps-insight-value ps-insight-value--sm">{{ summary.currentStreak }}d</span>
                </div>
                <div class="ps-insight-row">
                  <span class="ps-insight-label"><i class="fa-solid fa-bolt"></i> Calories Burned</span>
                  <span class="ps-insight-value ps-insight-value--sm">{{ summary.caloriesBurned.toLocaleString() }}</span>
                </div>
                <div class="ps-insight-row" v-if="chartInsights">
                  <span class="ps-insight-label"><i class="fa-solid fa-chart-line"></i> Chart Points</span>
                  <span class="ps-insight-value ps-insight-value--sm">{{ chartInsights.sessions }}</span>
                </div>
                <div class="ps-insight-row" v-if="chartInsights">
                  <span class="ps-insight-label"><i class="fa-solid fa-arrow-trend-up"></i> Trend</span>
                  <span class="ps-insight-value ps-insight-value--sm">{{ chartInsights.trend }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Col 3: Quick Insights -->
          <div class="ps-card ps-insights-card ps-quick-card">
            <div class="ps-card__header">
              <div>
                <h5><i class="fa-solid fa-lightbulb"></i> Quick Insights</h5>
                <p class="ps-card__subhead">{{ currentMetricLabel }}</p>
              </div>
              <span v-if="chartInsights?.isPB" class="ps-pb-badge">🏆 PB!</span>
            </div>
            <div v-if="!chartInsights" class="ps-state">
              <i class="fa-solid fa-chart-simple"></i>
              <span>No data yet</span>
            </div>
            <div v-else class="ps-insights-body">
              <div class="ps-insight-row">
                <span class="ps-insight-label"><i class="fa-solid fa-hashtag"></i> Sessions</span>
                <span class="ps-insight-value ps-insight-value--sm">{{ chartInsights.sessions }}</span>
              </div>
              <div class="ps-insight-row">
                <span class="ps-insight-label"><i class="fa-solid fa-chart-bar"></i> Average</span>
                <span class="ps-insight-value ps-insight-value--sm">{{ chartInsights.avg }}</span>
              </div>
              <div class="ps-insight-row">
                <span class="ps-insight-label"><i class="fa-solid fa-arrow-up"></i> Peak</span>
                <span class="ps-insight-value ps-insight-value--sm">{{ chartInsights.peak }}</span>
              </div>
              <div class="ps-insight-row">
                <span class="ps-insight-label"><i class="fa-solid fa-calendar-star"></i> Best Day</span>
                <span class="ps-insight-value ps-insight-value--sm">{{ chartInsights.bestDay }}</span>
              </div>
              <div class="ps-insight-row">
                <span class="ps-insight-label"><i class="fa-solid fa-arrow-trend-up"></i> Trend</span>
                <span class="ps-insight-value ps-insight-value--sm">{{ chartInsights.trend }}</span>
              </div>
              <div class="ps-insight-divider"></div>
              <div class="ps-insight-total">
                <span class="ps-insight-total__label">Total {{ currentMetricLabel }}</span>
                <span class="ps-insight-total__value">{{ chartInsights.total }}</span>
              </div>
            </div>
          </div>

        </div><!-- /ps-row3 -->
      </div><!-- /ps-section-panel row3 -->

    </div>
  </div>
</template>

<style scoped>
/* ─────────────────────────────────────────────────────────────────── */
/* PAGE SHELL                                                          */
/* ─────────────────────────────────────────────────────────────────── */

.ps-container {
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}

.ps-canvas {
  display: grid;
  gap: 14px;
  padding-block: 4px !important;
}

/* ─────────────────────────────────────────────────────────────────── */
/* HERO                                                                */
/* ─────────────────────────────────────────────────────────────────── */

.ps-hero {
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.ps-hero__inner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.ps-hero__text h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.015em;
}

.ps-hero__text p {
  margin: 5px 0 0;
  font-size: 0.88rem;
  opacity: 0.82;
}

/* ─────────────────────────────────────────────────────────────────── */
/* ANALYTICS ROW  (chart+exercises 2.4fr | side rail 1fr)             */
/* ─────────────────────────────────────────────────────────────────── */

.ps-analytics-row {
  display: grid;
  grid-template-columns: 2.5fr 1fr;
  gap: 14px;
  align-items: start;
}

/* Left column: chart on top, exercises below */
.ps-left-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Right side rail: 3 mini widgets stacked */
.ps-right-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ─────────────────────────────────────────────────────────────────── */
/* ROW 3  (Exercises | Summary | Quick Insights — 3 equal cols)       */
/* ─────────────────────────────────────────────────────────────────── */

.ps-row3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  align-items: start;
}

/* ─────────────────────────────────────────────────────────────────── */
/* HERO DATE PICKER  (mirrors HomeDashboard .header-picker exactly)   */
/* ─────────────────────────────────────────────────────────────────── */

.header-picker {
  margin-top: 2px;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

/* ─────────────────────────────────────────────────────────────────── */
/* MINI STAT WIDGETS (side rail)                                       */
/* ─────────────────────────────────────────────────────────────────── */

.ps-mini-widget {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
}

.ps-mini-widget__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #eff6ff;
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.ps-mini-widget__icon--fire { background: #fff7ed; color: #f97316; }
.ps-mini-widget__icon--bolt { background: #f0fdf4; color: #16a34a; }

.ps-mini-widget__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ps-mini-widget__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  white-space: nowrap;
}

.ps-mini-widget__value {
  font-size: 1.35rem;
  font-weight: 900;
  color: #1e293b;
  line-height: 1.1;
}

.ps-mini-widget__sub {
  font-size: 0.72rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─────────────────────────────────────────────────────────────────── */
/* CARD BASE                                                           */
/* ─────────────────────────────────────────────────────────────────── */

.ps-card {
  border: 1px solid rgba(120, 130, 150, 0.32);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
  overflow: hidden;
}

.ps-card__header {
  padding: 14px 18px;
  background: rgba(235, 240, 248, 0.65);
  border-bottom: 1px solid rgba(120, 130, 150, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ps-card__header h5 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 7px;
}

.ps-card__subhead {
  margin: 3px 0 0;
  font-size: 0.78rem;
  color: var(--text-color-secondary);
}

.ps-badge {
  background: #eff6ff;
  color: #3b82f6;
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.ps-card__body { padding: 16px 18px; }

/* ─────────────────────────────────────────────────────────────────── */
/* FILTER CARD (collapsible)                                           */
/* ─────────────────────────────────────────────────────────────────── */

.ps-filter-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 13px 18px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-color);
  cursor: pointer;
  gap: 10px;
  text-align: left;
}

.ps-filter-toggle span {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #3b82f6;
}

.ps-filter-toggle > i { color: #94a3b8; font-size: 0.78rem; }
.ps-filter-toggle__right { display: flex; align-items: center; gap: 6px; }
.ps-filter-toggle__right > i { color: #94a3b8; font-size: 0.78rem; }

.ps-filter-toggle { background: rgba(235, 240, 248, 0.65); }
.ps-filter-toggle:hover { background: rgba(220, 228, 242, 0.75); }

.ps-filter-body { border-top: 1px solid rgba(120, 130, 150, 0.25); }

.ps-reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 7px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  font-family: inherit;
  margin-top: auto;
  align-self: flex-end;
}

.ps-reset-btn:hover { background: #e2e8f0; }

.ps-filter-field--action {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}

/* Active filter chips strip */
.ps-active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 10px 18px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  min-height: 42px;
}

.ps-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.4;
}

.ps-chip__icon { font-size: 0.8rem; }

.ps-chip--default {
  background: #f1f5f9;
  color: #64748b;
  border-color: #e2e8f0;
}

.ps-chip--live {
  background: #fffbeb;
  color: #92400e;
  border-color: #fde68a;
  gap: 5px;
}

.ps-chip__remove {
  border: none;
  background: none;
  padding: 0 0 0 2px;
  cursor: pointer;
  color: #93c5fd;
  font-size: 0.68rem;
  line-height: 1;
  display: flex;
  align-items: center;
  transition: color 0.12s;
}

.ps-chip__remove:hover { color: #2563eb; }

/* Row 1: Workout Type | Exercise | Primary Metric | Show Range | Reset */
.ps-filter-grid {
  display: grid;
  grid-template-columns: 1.5fr 1.5fr 1.5fr 1.2fr auto;
  gap: 10px;
  padding: 12px 18px 12px;
  align-items: end;
}

.ps-filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ps-filter-field label {
  font-size: 0.71rem;
  font-weight: 700;
  color: var(--text-color-secondary);
}

/* Styled date picker */
.ps-datepicker { position: relative; }

.ps-datepicker__input {
  width: 100%;
  height: 38px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0 38px 0 12px;
  font-size: 0.87rem;
  color: var(--text-color);
  background: #f8fafc;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  font-family: inherit;
}

.ps-datepicker__input:focus {
  border-color: #3b82f6;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

/* Hide native calendar icon, keep click area for picker */
.ps-datepicker__input::-webkit-calendar-picker-indicator {
  opacity: 0;
  position: absolute;
  right: 0;
  width: 40px;
  height: 100%;
  cursor: pointer;
}

.ps-datepicker__icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 0.85rem;
  pointer-events: none;
}

/* Select inputs */
.ps-select {
  height: 38px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 0.87rem;
  color: var(--text-color);
  background: #f8fafc;
  cursor: pointer;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  appearance: auto;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  font-family: inherit;
}

.ps-select:focus {
  border-color: #3b82f6;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

.ps-select:disabled { opacity: 0.5; cursor: not-allowed; }

/* ───────────────────────────────────────────────────────────────── */
/* PRO BADGE + PRO ROW — Y2 collapsible section                      */
/* ───────────────────────────────────────────────────────────────── */

.ps-pro-badge {
  display: inline-block;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: #fff;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.60rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  vertical-align: middle;
  margin-left: 2px;
  line-height: 1.6;
}

.ps-pro-row {
  border-top: 1px solid rgba(120, 130, 150, 0.18);
}

.ps-pro-row__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 18px;
  border: none;
  background: rgba(245, 243, 255, 0.6);
  font-family: inherit;
  font-size: 0.83rem;
  font-weight: 700;
  color: #6d28d9;
  cursor: pointer;
  gap: 10px;
  text-align: left;
  transition: background 0.15s;
}

.ps-pro-row__toggle:hover { background: rgba(237, 233, 254, 0.8); }

.ps-pro-row__toggle-left {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.ps-pro-row__active-hint {
  font-size: 0.76rem;
  font-weight: 600;
  color: #7c3aed;
  opacity: 0.85;
}

.ps-pro-row__toggle-right {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #7c3aed;
}

.ps-pro-row__lock {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #7c3aed;
  opacity: 0.75;
}

.ps-pro-row__toggle-right > i { font-size: 0.72rem; color: #94a3b8; }

.ps-pro-row__body {
  border-top: 1px solid rgba(139, 92, 246, 0.15);
}

.ps-pro-row__gate {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: rgba(245, 243, 255, 0.4);
  flex-wrap: wrap;
}

.ps-pro-gate-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed22, #a855f722);
  border: 1px solid #c4b5fd;
  color: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.ps-pro-gate-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 160px;
}

.ps-pro-gate-text strong {
  font-size: 0.85rem;
  font-weight: 800;
  color: #5b21b6;
}

.ps-pro-gate-text span {
  font-size: 0.77rem;
  color: #6d28d9;
  opacity: 0.8;
  line-height: 1.4;
}

.ps-pro-gate-btn {
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 0.80rem;
  font-weight: 700;
  cursor: not-allowed;
  opacity: 0.6;
  font-family: inherit;
  white-space: nowrap;
}

.ps-pro-row__fields {
  padding: 12px 18px;
  display: grid;
  grid-template-columns: minmax(180px, 300px);
  gap: 10px;
}

/* ─────────────────────────────────────────────────────────────────── */
/* CHART CARD                                                          */
/* ─────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────── */
/* SECTION PANELS  (soft outer grouping borders)                       */
/* ─────────────────────────────────────────────────────────────────── */

.ps-section-panel {
  border: 1px solid rgba(120, 130, 150, 0.32);
  background: rgba(255, 255, 255, 0.82);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
}

.ps-section-panel--filter {
  background: rgba(240, 244, 250, 0.5);
  padding: 0;
  overflow: hidden;
}

/* Remove double-border between inner ps-card and outer panel */
.ps-section-panel > .ps-card,
.ps-section-panel > .ps-analytics-row .ps-card,
.ps-section-panel > .ps-row3 .ps-card {
  box-shadow: none;
}

/* Strengthen inner card borders inside panels */
.ps-section-panel .ps-row3 .ps-card,
.ps-section-panel .ps-analytics-row .ps-card {
  border-color: rgba(120, 130, 150, 0.28);
}

/* Analytics row inside panel — remove outer gap padding since panel provides it */
.ps-section-panel > .ps-analytics-row {
  margin: 0;
}

.ps-filter-card {
  background: transparent;
  border: none;
  box-shadow: none;
  overflow: visible;
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
}

.ps-chart-sub {
  display: block;
  font-size: 0.76rem;
  color: var(--text-color-secondary);
  margin-top: 2px;
}

/* Week / Month / Year quick buttons */
.ps-chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ps-group-btns {
  display: flex;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.ps-group-btn {
  border: none;
  background: #f8fafc;
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-right: 1px solid #e2e8f0;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
  line-height: 1.4;
}

.ps-group-btn:last-child { border-right: none; }
.ps-group-btn:hover { background: #eff6ff; color: #3b82f6; }

.ps-group-btn--active {
  background: #3b82f6;
  color: #fff;
}

.ps-group-btn--active:hover { background: #2563eb; color: #fff; }

/* Bar / Line type switcher */
.ps-chart-type-btns {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
}

.ps-type-btn {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 5px 9px;
  font-size: 0.8rem;
  color: #94a3b8;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.ps-type-btn:hover { color: #3b82f6; }

.ps-type-btn--active {
  background: #fff;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Chart body states */
.ps-chart-body { padding: 8px 14px 16px; }

.ps-chart-wrap { overflow: hidden; max-height: 340px; transition: height 0.3s ease; }

/* Personal best badge */
.ps-pb-badge {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
  border: 1px solid #fcd34d;
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

/* Quick insights card — lighter header */
.ps-quick-card .ps-card__header {
  background: #f8fafc;
}

/* ─────────────────────────────────────────────────────────────────── */
/* INSIGHTS PANEL                                                      */
/* ─────────────────────────────────────────────────────────────────── */

.ps-insights-card { height: auto; }

.ps-insights-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 6px 16px 14px;
}

.ps-insight-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(120, 130, 150, 0.20);
  gap: 8px;
}

.ps-insight-row:last-child { border-bottom: none; }

.ps-insight-row--highlight {
  background: #eff6ff;
  margin: 0 -16px;
  padding: 8px 16px;
  border-bottom: 1px solid #dbeafe;
}

.ps-insight-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.ps-insight-label i {
  color: #3b82f6;
  width: 14px;
  text-align: center;
  font-size: 0.78rem;
}

.ps-insight-value {
  font-size: 1rem;
  font-weight: 800;
  color: #1e293b;
  text-align: right;
}

.ps-insight-value--sm {
  font-size: 0.84rem;
  font-weight: 700;
}

.ps-insight-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 6px 0;
}

.ps-insight-total {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 10px;
  padding: 12px;
  margin-top: 4px;
  gap: 3px;
  text-align: center;
}

.ps-insight-total__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #3b82f6;
}

.ps-insight-total__value {
  font-size: 1.6rem;
  font-weight: 900;
  color: #1e40af;
  line-height: 1;
}

/* Loading / error states */
.ps-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 160px;
  color: var(--text-color-secondary);
  font-size: 0.88rem;
}

.ps-state i { font-size: 1.6rem; opacity: 0.4; }
.ps-state span { font-size: 0.82rem; }
.ps-state--error i { color: #ef4444; opacity: 0.8; }

/* Improved empty state */
.ps-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 20px;
  max-height: 220px;
  text-align: center;
}

.ps-empty-icon { font-size: 2.2rem; line-height: 1; }

.ps-empty-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-color);
}

.ps-empty-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.ps-empty-tips span {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.76rem;
  color: var(--text-color-secondary);
  font-weight: 500;
  white-space: nowrap;
}

/* ─────────────────────────────────────────────────────────────────── */
/* EXERCISE CARD GRID                                                  */
/* ─────────────────────────────────────────────────────────────────── */

.ps-ex-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ps-ex-card {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
  text-align: left;
}

.ps-ex-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
}

.ps-ex-card i { font-size: 0.9rem; margin-bottom: 2px; }

.ps-ex-card__name {
  font-size: 0.83rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-color);
}

.ps-ex-card__type {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.ps-ex-card--strength { border-color: #bfdbfe; }
.ps-ex-card--strength i, .ps-ex-card--strength .ps-ex-card__type { color: #3b82f6; }

.ps-ex-card--cardio { border-color: #bbf7d0; }
.ps-ex-card--cardio i, .ps-ex-card--cardio .ps-ex-card__type { color: #16a34a; }

.ps-ex-card--other { border-color: #fde68a; }
.ps-ex-card--other i, .ps-ex-card--other .ps-ex-card__type { color: #ca8a04; }

.ps-ex-card--active.ps-ex-card--strength { background: #eff6ff; box-shadow: 0 0 0 2px #3b82f6, 0 0 12px rgba(59,130,246,0.25); }
.ps-ex-card--active.ps-ex-card--cardio   { background: #f0fdf4; box-shadow: 0 0 0 2px #16a34a, 0 0 12px rgba(22,163,74,0.2); }
.ps-ex-card--active.ps-ex-card--other    { background: #fefce8; box-shadow: 0 0 0 2px #ca8a04, 0 0 12px rgba(202,138,4,0.2); }

/* ─────────────────────────────────────────────────────────────────── */
/* RESPONSIVE                                                          */
/* ─────────────────────────────────────────────────────────────────── */

@media (max-width: 1100px) {
  .ps-row3 { grid-template-columns: 1fr 1fr; }
  .ps-filter-grid { grid-template-columns: 1fr 1fr 1fr 1fr auto; }
}

@media (max-width: 960px) {
  .ps-analytics-row { grid-template-columns: 1fr; }
  .ps-right-col { flex-direction: row; flex-wrap: wrap; }
  .ps-right-col .ps-mini-widget { flex: 1 1 140px; }
  .ps-chart-wrap { height: 260px !important; }
  .ps-filter-grid { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
}

@media (max-width: 768px) {
  .ps-canvas { gap: 10px; }
  .ps-hero__text h2 { font-size: 1rem; }
  .ps-hero__inner {
    padding: 10px 14px;
    gap: 8px;
    flex-wrap: unset;
    flex-direction: unset;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
  }
  .header-picker { width: auto; min-width: 150px; max-width: 185px; margin-top: 0; flex-shrink: 0; overflow: hidden; }
  .header-picker :deep(.full-datepicker) { font-size: 0.73rem; min-width: 0 !important; width: 100% !important; max-width: 185px !important; }
  .ps-card__header { padding: 10px 14px; }
  .ps-card__body { padding: 12px 14px; }
  .ps-row3 { grid-template-columns: 1fr; }
  .ps-filter-grid { grid-template-columns: 1fr 1fr; }
  .ps-chart-wrap { height: 260px; }
  .ps-group-btn { padding: 5px 9px; font-size: 0.73rem; }
}

@media (max-width: 560px) {
  .ps-canvas { gap: 8px; }
  .ps-chart-wrap { height: 220px !important; }
  .ps-hero__inner { flex-direction: column; }
  .ps-chart-controls { gap: 6px; }
  .ps-filter-grid { grid-template-columns: 1fr; }
  .ps-right-col { flex-direction: column; }
  .ps-insight-total__value { font-size: 1.3rem; }
}
</style>
