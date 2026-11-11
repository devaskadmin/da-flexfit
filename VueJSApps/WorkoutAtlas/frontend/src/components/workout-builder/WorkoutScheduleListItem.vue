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
  presentation: {
    type: String,
    default: 'table',
    validator: (value) => ['table', 'card'].includes(value),
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

const formatGoalCategory = () => {
  const rawValue = String(props.schedule?.category ?? props.schedule?.goalCategory ?? '').trim();
  return rawValue || 'Uncategorized';
};

const formatPlanTypeLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '—';
  if (normalized === 'community_shared') return 'Community Shared';
  if (normalized === 'trainer_shared') return 'Trainer Shared';
  if (normalized === 'featured') return 'Global';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatEstimatedDuration = () => {
  const duration = Number(props.schedule?.estimatedDuration);
  return Number.isFinite(duration) && duration > 0 ? `${duration} min` : '—';
};

const formatPlanId = () => {
  const planId = String(props.schedule?.planId || '').trim();
  return planId ? `#${planId}` : '—';
};

const statusLabel = computed(() => {
  const status = String(props.schedule?.status || props.schedule?.publicationStatus || props.schedule?.planStatus || '').trim();
  if (!status) return '—';
  if (status.toLowerCase() === 'active') return 'Published';
  return status.charAt(0).toUpperCase() + status.slice(1);
});

const statusClass = computed(() => {
  const normalized = statusLabel.value.toLowerCase();
  if (normalized === 'active' || normalized === 'published') return 'my-plan-card__status--published';
  if (normalized === 'draft') return 'my-plan-card__status--draft';
  return 'my-plan-card__status--neutral';
});

const onCoverError = (event) => {
  applyWorkoutPlanImageFallback(event);
};
</script>

<template>
  <tr
    v-if="presentation === 'table'"
    :class="['my-plan-row', { 'my-plan-row--selected': selected, 'my-plan-row--deleting': deleting }]"
    :data-plan-id="schedule.planId"
  >
    <td data-label="Plan Name">
      <div class="marketplace-plan-name-cell">
        <img
          class="marketplace-plan-thumb"
          :src="coverImageSrc"
          :alt="`${schedule.name || 'Workout plan'} cover`"
          loading="lazy"
          decoding="async"
          @error="onCoverError"
        />
        <div class="marketplace-plan-name-content">
          <span class="fw-semibold">{{ schedule.name || 'Untitled Workout' }}</span>
          <span class="marketplace-plan-inline-status">[Status - {{ statusLabel }}]</span>
        </div>
      </div>
    </td>
    <td data-label="Goal Category">{{ formatGoalCategory() }}</td>
    <td data-label="Plan Type">{{ formatPlanTypeLabel(schedule.planType) }}</td>
    <td class="text-end global-library-table__actions-cell" data-label="Actions">
      <div class="global-plans-table__actions global-plans-table__actions--icon-only">
        <button
          type="button"
          class="btn btn-sm global-plans-table__btn global-plans-table__btn--open"
          title="View Workout Plan"
          aria-label="View Workout Plan"
          @click="emit('open', schedule)"
        >
          <i class="fa-solid fa-eye" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
          title="Edit Workout Plan"
          aria-label="Edit Workout Plan"
          @click="emit('edit', schedule)"
        >
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="btn btn-sm global-plans-table__btn global-plans-table__btn--delete"
          :title="deleting ? 'Deleting workout plan' : 'Delete Workout Plan'"
          :aria-label="deleting ? 'Deleting workout plan' : 'Delete Workout Plan'"
          :disabled="deleting"
          @click="emit('delete', schedule)"
        >
          <i v-if="deleting" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <i v-else class="fa-solid fa-trash" aria-hidden="true"></i>
        </button>
      </div>
    </td>
  </tr>

  <article
    v-else
    :class="['my-plan-card', { 'my-plan-card--selected': selected, 'my-plan-card--deleting': deleting }]"
    :data-plan-id="schedule.planId"
  >
    <header class="my-plan-card__header">
      <img
        class="my-plan-card__thumb"
        :src="coverImageSrc"
        :alt="`${schedule.name || 'Workout plan'} cover`"
        loading="lazy"
        decoding="async"
        @error="onCoverError"
      />
      <div class="my-plan-card__heading">
        <h3>{{ schedule.name || 'Untitled Workout' }}</h3>
        <span :class="['my-plan-card__status', statusClass]">{{ statusLabel }}</span>
      </div>

      <div class="my-plan-card__actions">
        <button
          type="button"
          class="btn btn-sm global-plans-table__btn global-plans-table__btn--open"
          title="View Workout Plan"
          aria-label="View Workout Plan"
          :data-plan-id="schedule.planId"
          data-plan-action="view"
          @click="emit('open', schedule)"
        >
          <i class="fa-solid fa-eye" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="btn btn-sm global-plans-table__btn global-plans-table__btn--edit"
          title="Edit Workout Plan"
          aria-label="Edit Workout Plan"
          :data-plan-id="schedule.planId"
          data-plan-action="edit"
          @click="emit('edit', schedule)"
        >
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="btn btn-sm global-plans-table__btn global-plans-table__btn--delete"
          :title="deleting ? 'Deleting workout plan' : 'Delete Workout Plan'"
          :aria-label="deleting ? 'Deleting workout plan' : 'Delete Workout Plan'"
          :data-plan-id="schedule.planId"
          data-plan-action="delete"
          :disabled="deleting"
          @click="emit('delete', schedule)"
        >
          <i v-if="deleting" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <i v-else class="fa-solid fa-trash" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <dl class="my-plan-card__details">
      <div>
        <dt>Goal Category</dt>
        <dd>{{ formatGoalCategory() }}</dd>
      </div>
      <div>
        <dt>Plan Type</dt>
        <dd>{{ formatPlanTypeLabel(schedule.planType) }}</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{{ formatEstimatedDuration() }}</dd>
      </div>
      <div>
        <dt>Plan ID</dt>
        <dd>{{ formatPlanId() }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.my-plan-row td {
  background: transparent;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  transition: background-color 0.18s ease;
}

.my-plan-row:hover td {
  background: rgba(59, 130, 246, 0.08);
}

.my-plan-row--selected td {
  background: rgba(59, 130, 246, 0.12);
}

.my-plan-row--deleting td {
  opacity: 0.8;
}

@media (min-width: 801px) {
  .my-plan-row .global-plans-table__actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .my-plan-row .global-plans-table__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    padding: 0;
    border-radius: 4px !important;
  }

  .my-plan-row .global-plans-table__btn i {
    margin: 0;
    color: #ffffff;
    font-size: 14px;
    line-height: 1;
  }
}

.my-plan-row .global-plans-table__btn {
  color: #ffffff;
}

.my-plan-row .global-plans-table__btn i {
  color: #ffffff;
}

.my-plan-row .global-plans-table__btn--open {
  background: #2563eb;
  border-color: #1d4ed8;
}

.my-plan-row .global-plans-table__btn--open:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1e40af;
}

.my-plan-row .global-plans-table__btn--edit {
  background: #0d5b55;
  border-color: #0f766e;
}

.my-plan-row .global-plans-table__btn--edit:hover:not(:disabled) {
  background: #0f766e;
  border-color: #115e59;
}

.my-plan-row .global-plans-table__btn--delete {
  background: #8f1f2a;
  border-color: #b91c1c;
}

.my-plan-row .global-plans-table__btn--delete:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #991b1b;
}

.my-plan-row .marketplace-plan-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.my-plan-row .marketplace-plan-name-content {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.my-plan-row .marketplace-plan-thumb {
  width: 48px;
  height: 48px;
  max-width: 48px;
  max-height: 48px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.36);
  object-fit: cover;
  background: #1f2937;
  display: block;
  flex-shrink: 0;
}

.my-plan-card {
  display: grid;
  gap: 11px;
  width: 100%;
  min-width: 0;
  padding: 12px;
  color: #e7eefc;
  background: #0f1b32;
  border: 1px solid rgba(96, 165, 250, 0.34);
  border-radius: 7px;
  box-sizing: border-box;
}

.my-plan-card--selected {
  border-color: rgba(96, 165, 250, 0.72);
  background: #12213d;
}

.my-plan-card--deleting {
  opacity: 0.8;
}

.my-plan-card__header {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
  min-width: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.my-plan-card__thumb {
  display: block;
  width: 48px;
  height: 48px;
  min-width: 48px;
  max-width: 48px;
  border: 1px solid rgba(148, 163, 184, 0.36);
  border-radius: 6px;
  object-fit: cover;
  background: #1f2937;
}

.my-plan-card__heading {
  display: grid;
  justify-items: start;
  gap: 4px;
  min-width: 0;
}

.my-plan-card__heading h3 {
  max-width: 100%;
  margin: 0;
  overflow-wrap: anywhere;
  color: #f8fbff;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.25;
}

.my-plan-card__status {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 7px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
}

.my-plan-card__status--published {
  color: #d1fae5;
  background: rgba(5, 150, 105, 0.22);
  border-color: rgba(52, 211, 153, 0.38);
}

.my-plan-card__status--draft {
  color: #fef3c7;
  background: rgba(217, 119, 6, 0.2);
  border-color: rgba(251, 191, 36, 0.34);
}

.my-plan-card__status--neutral {
  color: #dbeafe;
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(96, 165, 250, 0.3);
}

.my-plan-card__details {
  display: grid;
  gap: 3px;
  min-width: 0;
  margin: 0;
}

.my-plan-card__details div {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px;
  min-width: 0;
}

.my-plan-card__details dt {
  color: #a9bddf;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
}

.my-plan-card__details dt::after {
  content: ':';
}

.my-plan-card__details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: #f1f5f9;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.3;
}

.my-plan-card__actions {
  display: flex;
  justify-content: flex-end;
  align-self: center;
  flex: 0 0 auto;
  gap: 4px;
}

.my-plan-card__actions .global-plans-table__btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border-color: transparent !important;
  border-radius: 8px !important;
  background: transparent !important;
  color: #ffffff !important;
}

.my-plan-card__actions .global-plans-table__btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 6px;
  transform: translate(-50%, -50%);
}

.my-plan-card__actions .global-plans-table__btn i {
  position: relative;
  z-index: 1;
  color: #ffffff;
  font-size: 0.8rem;
}

.my-plan-card__actions .global-plans-table__btn--open::before {
  background: #2563eb !important;
  border-color: #1d4ed8 !important;
}

.my-plan-card__actions .global-plans-table__btn--open:hover:not(:disabled)::before {
  background: #1d4ed8 !important;
  border-color: #1e40af !important;
}

.my-plan-card__actions .global-plans-table__btn--edit::before {
  background: #0d5b55 !important;
  border-color: #0f766e !important;
}

.my-plan-card__actions .global-plans-table__btn--edit:hover:not(:disabled)::before {
  background: #0f766e !important;
  border-color: #115e59 !important;
}

.my-plan-card__actions .global-plans-table__btn--delete::before {
  background: #8f1f2a !important;
  border-color: #b91c1c !important;
}

.my-plan-card__actions .global-plans-table__btn--delete:hover:not(:disabled)::before {
  background: #b91c1c !important;
  border-color: #991b1b !important;
}
</style>
