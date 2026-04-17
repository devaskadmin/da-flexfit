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
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 14px;
  padding: 17px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  min-height: 116px;
  background: var(--panel-bg, #fff);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.09);
}

.metric-card__left {
  display: grid;
  gap: 6px;
}

.metric-card__title {
  font-size: 0.78rem;
  line-height: 1.35;
  font-weight: 600;
  color: color-mix(in srgb, var(--text-color-secondary) 88%, #475569 12%);
  text-transform: none;
}

.metric-card__value {
  font-size: clamp(1.58rem, 1.35rem + 0.65vw, 1.86rem);
  line-height: 1.08;
  letter-spacing: -0.018em;
  font-weight: 800;
  color: var(--text-color);
}

.metric-card__subtitle {
  font-size: 0.8rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--text-color-secondary) 92%, #64748b 8%);
}

.metric-card__right {
  display: grid;
  justify-items: end;
  align-content: space-between;
  gap: 10px;
}

.metric-card__trend {
  color: #4ade80;
  font-size: 0.76rem;
  line-height: 1.2;
  font-weight: 700;
}

.metric-card__right i {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: rgba(59, 130, 246, 0.14);
  color: #4f8ff3;
}
</style>
