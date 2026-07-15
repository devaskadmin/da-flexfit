<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], required: true },
  subtitle: { type: String, default: '' },
  trend: { type: String, default: '' },
  icon: { type: String, default: 'fa-solid fa-chart-line' },
});

const iconBadgeClass = computed(() => {
  if (props.icon.includes('fa-fire')) return 'metric-card__icon-badge--fire';
  if (props.icon.includes('fa-bolt')) return 'metric-card__icon-badge--bolt';
  if (props.icon.includes('fa-drumstick-bite')) return 'metric-card__icon-badge--protein';
  return 'metric-card__icon-badge--default';
});
</script>

<template>
  <article class="metric-card panel-bg">
    <div class="metric-card__main">
      <div class="metric-card__left">
        <span class="metric-card__title">{{ title }}</span>
        <strong class="metric-card__value">{{ value }}</strong>
        <span v-if="subtitle" class="metric-card__subtitle">{{ subtitle }}</span>
      </div>
      <div class="metric-card__right">
        <span v-if="trend" class="metric-card__trend">{{ trend }}</span>
        <span class="metric-card__icon-badge" :class="iconBadgeClass">
          <i :class="icon"></i>
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.metric-card {
  border: 1px solid rgba(120, 130, 150, 0.32);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  background: #fff;
  box-shadow: 0 2px 6px rgba(20, 30, 50, 0.05);
}

.metric-card__main {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metric-card__left {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.metric-card__title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  white-space: nowrap;
}

.metric-card__value {
  font-size: 1.35rem;
  line-height: 1.1;
  font-weight: 900;
  color: #1e293b;
}

.metric-card__subtitle {
  font-size: 0.72rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-card__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  align-self: stretch;
}

.metric-card__trend {
  color: #4ade80;
  font-size: 0.76rem;
  line-height: 1.2;
  font-weight: 700;
  text-align: right;
}

.metric-card__icon-badge {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.metric-card__icon-badge--default {
  background: #eff6ff;
  color: #3b82f6;
}

.metric-card__icon-badge--fire {
  background: #fff7ed;
  color: #f97316;
}

.metric-card__icon-badge--bolt {
  background: #f0fdf4;
  color: #16a34a;
}

.metric-card__icon-badge--protein {
  background: #f5f3ff;
  color: #7c3aed;
}

@media (max-width: 640px) {
  .metric-card {
    padding: 12px;
  }

  .metric-card__title {
    font-size: 0.68rem;
  }

  .metric-card__value {
    font-size: 1.2rem;
  }

  .metric-card__subtitle,
  .metric-card__trend {
    font-size: 0.68rem;
  }

  .metric-card__icon-badge {
    width: 34px;
    height: 34px;
    border-radius: 9px;
  }
}
</style>
