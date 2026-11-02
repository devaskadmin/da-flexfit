<script setup>
import { computed } from 'vue';
import { buildWorkoutPlanCoverImageUrl, applyWorkoutPlanImageFallback } from '@/utils/workoutPlanImage';

const props = defineProps({
  schedule: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  deleting: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['open', 'edit', 'delete']);

const coverImageSrc = computed(() => {
  const explicit = String(props.schedule?.coverImageUrl || props.schedule?.coverImage || '').trim();
  if (explicit) {
    return explicit;
  }

  const planId = String(props.schedule?.planId || '').trim();
  return buildWorkoutPlanCoverImageUrl(planId);
});

const onCoverError = (event) => {
  applyWorkoutPlanImageFallback(event);
};
</script>

<template>
  <article class="schedule-card" :class="{ selected }">
    <div class="schedule-card__body">
      <div class="schedule-card__cover-wrap">
        <img
          class="schedule-card__cover"
          :src="coverImageSrc"
          :alt="`${schedule.name || 'Workout plan'} cover`"
          loading="lazy"
          decoding="async"
          @error="onCoverError"
        />
      </div>

      <div class="schedule-card__text">
        <div class="schedule-card__title-row">
          <h4>{{ schedule.name || 'Untitled Workout' }}</h4>
          <span v-if="selected" class="schedule-card__badge">Selected</span>
        </div>

        <div class="schedule-card__meta">
          <span>
            <strong>Duration:</strong>
            {{ Number(schedule.estimatedDuration || 0) > 0 ? `${Number(schedule.estimatedDuration)} min` : '—' }}
          </span>
          <span>
            <strong>Exercises:</strong>
            {{ Number(schedule.exerciseCount || 0) }}
          </span>
        </div>
      </div>

      <div class="schedule-card__actions">
        <button
          type="button"
          class="schedule-icon-btn schedule-icon-btn--open"
          title="View Workout Plan"
          aria-label="View Workout Plan"
          @click="emit('open', schedule)"
        >
          <i class="fa-solid fa-eye" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="schedule-icon-btn schedule-icon-btn--edit"
          title="Edit Workout Plan"
          aria-label="Edit Workout Plan"
          @click="emit('edit', schedule)"
        >
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="schedule-icon-btn schedule-icon-btn--delete"
          :title="deleting ? 'Deleting workout plan' : 'Delete Workout Plan'"
          :aria-label="deleting ? 'Deleting workout plan' : 'Delete Workout Plan'"
          :disabled="deleting"
          @click="emit('delete', schedule)"
        >
          <i :class="deleting ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-trash'" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.schedule-card {
  border: 1px solid #dbe4ef;
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.schedule-card:hover {
  border-color: #bfd2f3;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
  transform: translateY(-1px);
}

.schedule-card.selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.schedule-card__body {
  display: grid;
  gap: 12px;
}

.schedule-card__cover-wrap {
  width: 100%;
  height: 134px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #dbe4ef;
  background: #eef2f7;
}

.schedule-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.schedule-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  flex-wrap: wrap;
}

.schedule-card__title-row h4 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 800;
  color: #0f172a;
}

.schedule-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
  font-size: 0.74rem;
  font-weight: 700;
}

.schedule-card__meta {
  display: grid;
  gap: 6px;
  font-size: 0.84rem;
  color: #64748b;
}

.schedule-card__meta strong {
  color: #334155;
}

.schedule-card__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
}

.schedule-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  color: #ffffff;
  background: #64748b;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.schedule-icon-btn i {
  font-size: 0.9rem;
  line-height: 1;
}

.schedule-icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.schedule-icon-btn--open {
  border-color: #64748b;
  background: #64748b;
}

.schedule-icon-btn--open:hover:not(:disabled) {
  border-color: #475569;
  background: #475569;
}

.schedule-icon-btn--edit {
  border: 1px solid var(--wa-btn-primary-border, rgba(59, 130, 246, 0.55));
  background: var(--wa-btn-primary, rgba(30, 64, 175, 0.3));
}

.schedule-icon-btn--edit:hover:not(:disabled) {
  border-color: var(--wa-btn-primary-border, rgba(59, 130, 246, 0.55));
  background: var(--wa-btn-primary-hover, rgba(37, 99, 235, 0.42));
}

.schedule-icon-btn--delete {
  border: 1px solid var(--wa-btn-danger-border, #dc2626);
  background: var(--wa-btn-danger, #3b1d2b);
}

.schedule-icon-btn--delete:hover:not(:disabled) {
  border-color: var(--wa-btn-danger-border, #dc2626);
  background: var(--wa-btn-danger-hover, #512334);
}

.schedule-icon-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .schedule-card__body {
    grid-template-columns: 140px minmax(0, 1fr) auto;
    align-items: center;
  }

  .schedule-card__cover-wrap {
    width: 140px;
    height: 94px;
  }

  .schedule-card__actions {
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .schedule-card__badge {
    padding: 2px 8px;
    font-size: 0.68rem;
    border: 1px solid rgba(96, 165, 250, 0.3);
    background: rgba(59, 130, 246, 0.16);
    color: #93c5fd;
  }

  .schedule-card__actions {
    justify-content: flex-start;
    gap: 6px;
  }

  .schedule-icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 9px;
  }
}

@media (max-width: 390px) {
  .schedule-card__actions {
    gap: 6px;
  }
}
</style>
