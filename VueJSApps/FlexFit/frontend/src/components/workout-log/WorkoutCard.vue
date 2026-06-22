<script setup>
import { DEFAULT_EXERCISE_IMAGE } from '@/utils/exerciseImage';

const props = defineProps({
  plan: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['open-session', 'open-builder']);

const resolveImageSrc = (value) => {
  const raw = String(value || '').trim();
  const source = raw || DEFAULT_EXERCISE_IMAGE;

  if (/^https?:\/\//i.test(source) || source.startsWith('data:')) {
    return source;
  }

  if (source.startsWith('/')) {
    return source;
  }

  return source;
};

const handleImageError = (event) => {
  if (!event?.target) return;
  event.target.src = DEFAULT_EXERCISE_IMAGE;
};
</script>

<template>
  <article
    class="workout-card"
    role="button"
    tabindex="0"
    @click="emit('open-session', plan)"
    @keydown.enter.prevent="emit('open-session', plan)"
    @keydown.space.prevent="emit('open-session', plan)"
  >
    <div class="workout-card__image-wrap">
      <img
        class="workout-card__image"
        :src="resolveImageSrc(plan.coverImage)"
        :alt="`${plan.name} cover`"
        width="108"
        height="84"
        loading="lazy"
        decoding="async"
        @error="handleImageError"
      />
    </div>

    <div class="workout-card__content">
      <div class="workout-card__header">
        <h6>{{ plan.name }}</h6>
        <span class="type-chip">{{ plan.type }}</span>
      </div>

      <div class="workout-card__meta">
        <span><strong>Exercises:</strong> {{ Number(plan.exerciseCount || 0) }}</span>
        <span><strong>Duration:</strong> {{ Number(plan.estimatedDuration || 0) }} min</span>
        <span><strong>Last Updated:</strong> {{ plan.updatedAtLabel || '—' }}</span>
      </div>

      <div class="workout-card__btns">
        <button type="button" class="start-workout-btn" @click.stop="emit('open-session', plan)">
          <i class="fa-solid fa-play"></i> Start Workout
        </button>
        <button type="button" class="open-plan-btn" @click.stop="emit('open-builder', plan)">
          <i class="fa-solid fa-pencil"></i> Edit Plan
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.workout-card {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 12px;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}

.workout-card:hover,
.workout-card:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  outline: none;
}

.workout-card__image-wrap {
  width: 108px;
  height: 84px;
  border-radius: 10px;
  overflow: hidden;
  background: #eef2f7;
  border: 1px solid #dbe4ef;
}

.workout-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.workout-card__content {
  min-width: 0;
  display: grid;
  gap: 10px;
}

.workout-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.workout-card__header h6 {
  margin: 0;
  color: var(--text-color);
  font-size: 1rem;
}

.type-chip {
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  color: #1d4ed8;
  padding: 2px 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.workout-card__meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

.workout-card__btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.start-workout-btn {
  border: none;
  background: #2563eb;
  color: #fff;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 0.78rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.start-workout-btn:hover {
  background: #1d4ed8;
}

.open-plan-btn {
  border: 1px solid #3b82f6;
  color: #1d4ed8;
  background: transparent;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

@media (min-width: 900px) {
  .workout-card__meta {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .workout-card {
    grid-template-columns: 1fr;
  }

  .workout-card__image-wrap {
    width: 100%;
    height: 150px;
  }
}
</style>
