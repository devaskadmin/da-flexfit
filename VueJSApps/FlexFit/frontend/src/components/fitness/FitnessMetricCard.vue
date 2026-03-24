<script setup>
defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], required: true },
  subtitle: { type: String, default: '' },
  trend: { type: String, default: '' },
  icon: { type: String, default: 'fa-solid fa-chart-line' },
});
</script>

<template>
  <article class="metric-card panel-bg">
    <div class="metric-card__left">
      <span class="metric-card__title">{{ title }}</span>
      <strong class="metric-card__value">{{ value }}</strong>
      <span v-if="subtitle" class="metric-card__subtitle">{{ subtitle }}</span>
    </div>
    <div class="metric-card__right">
      <span class="metric-card__trend">{{ trend }}</span>
      <i :class="icon"></i>
    </div>
  </article>
</template>

<style scoped>
.metric-card {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 112px;
}

.metric-card__left {
  display: grid;
  gap: 5px;
}

.metric-card__title {
  font-size: 0.82rem;
  color: var(--text-color-secondary);
}

.metric-card__value {
  font-size: 1.65rem;
  line-height: 1;
  color: var(--text-color);
}

.metric-card__subtitle {
  font-size: 0.78rem;
  color: var(--text-color-secondary);
}

.metric-card__right {
  display: grid;
  justify-items: end;
  align-content: space-between;
}

.metric-card__trend {
  color: #4ade80;
  font-size: 0.78rem;
  font-weight: 600;
}

.metric-card__right i {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}
</style>
