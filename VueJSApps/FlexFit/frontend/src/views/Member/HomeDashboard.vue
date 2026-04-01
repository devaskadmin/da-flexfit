<script setup>
import DateRangePicker from '@/components/template/DateRangePicker.vue';
import FitnessMetricCard from '@/components/fitness/FitnessMetricCard.vue';
import ProgressChart from '@/components/Widgets/ProgressChart.vue';
import NutritionLogChart from '@/components/Widgets/NutritionLogChart.vue';

const metrics = [
  {
    title: 'Workouts This Week',
    value: 5,
    subtitle: 'Target: 6 sessions',
    trend: '+1 vs last week',
    icon: 'fa-solid fa-dumbbell',
  },
  {
    title: 'Current Streak',
    value: '12 days',
    subtitle: 'Consistency is improving',
    trend: '+3 days',
    icon: 'fa-solid fa-fire',
  },
  {
    title: 'Calories Burned',
    value: '2,430',
    subtitle: 'This week total',
    trend: '+8%',
    icon: 'fa-solid fa-bolt',
  },
  {
    title: 'Protein Today',
    value: '148g',
    subtitle: 'Goal: 170g',
    trend: '87% of goal',
    icon: 'fa-solid fa-drumstick-bite',
  },
];

const recentActivity = [
  { time: '07:10 AM', action: 'Logged breakfast', detail: 'Greek yogurt + berries' },
  { time: '11:30 AM', action: 'Completed workout', detail: 'Upper Body Strength (55 min)' },
  { time: '02:15 PM', action: 'Hydration update', detail: '2.1L total water intake' },
  { time: '06:40 PM', action: 'Added dinner', detail: 'Salmon bowl with rice' },
];
</script>

<template>
  <div class="dashboard-breadcrumb ff-page-header mb-25">
    <h2>Welcome back</h2>
    <DateRangePicker />
  </div>

  <section class="dashboard-hero panel-bg">
    <h3>Today’s focus: progressive overload + nutrition consistency</h3>
    <p>Prioritize one quality strength session and hit your protein target.</p>
  </section>

  <section class="row g-3">
    <div class="col-lg-3 col-md-6" v-for="metric in metrics" :key="metric.title">
      <FitnessMetricCard
        :title="metric.title"
        :value="metric.value"
        :subtitle="metric.subtitle"
        :trend="metric.trend"
        :icon="metric.icon"
      />
    </div>
  </section>

  <section class="row g-3 mt-1">
    <div class="col-lg-8">
      <div class="panel panel-bg dashboard-panel">
        <div class="panel-header"><h5>Training Progress</h5></div>
        <div class="panel-body"><ProgressChart /></div>
      </div>
    </div>
    <div class="col-lg-4">
      <div class="panel panel-bg dashboard-panel">
        <div class="panel-header"><h5>Activity Feed</h5></div>
        <div class="panel-body activity-feed">
          <article v-for="item in recentActivity" :key="item.time + item.action" class="activity-row">
            <span class="time">{{ item.time }}</span>
            <div>
              <strong>{{ item.action }}</strong>
              <p>{{ item.detail }}</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>

  <section class="row g-3 mt-1">
    <div class="col-12">
      <div class="panel panel-bg dashboard-panel">
        <div class="panel-header"><h5>Nutrition Trend</h5></div>
        <div class="panel-body"><NutritionLogChart /></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard-hero {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
}

.dashboard-hero h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 1.1rem;
}

.dashboard-hero p {
  margin: 5px 0 0;
  color: var(--text-color-secondary);
}

.dashboard-panel {
  border: 1px solid var(--border-color);
  border-radius: 14px;
}

.activity-feed {
  display: grid;
  gap: 10px;
}

.activity-row {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 9px;
  display: flex;
  gap: 10px;
}

.activity-row .time {
  color: #a5b4fc;
  min-width: 70px;
  font-size: 0.75rem;
  font-weight: 700;
}

.activity-row strong {
  color: var(--text-color);
  font-size: 0.88rem;
}

.activity-row p {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 0.79rem;
}
</style>