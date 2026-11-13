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

const statusLabel = computed(() => {
  const status = String(props.schedule?.status || props.schedule?.publicationStatus || props.schedule?.planStatus || '').trim();
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1);
});

const onCoverError = (event) => {
  applyWorkoutPlanImageFallback(event);
};
</script>

<template>
  <tr :class="['my-plan-row', { 'my-plan-row--selected': selected, 'my-plan-row--deleting': deleting }]">
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

.my-plan-row .global-library-table__actions-cell {
  width: 132px;
  white-space: nowrap;
}

.my-plan-row .global-plans-table__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: nowrap;
}

.my-plan-row .global-plans-table__actions--icon-only .global-plans-table__btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: 8px !important;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff !important;
  line-height: 1;
  box-shadow: none;
  transform: none;
}

.my-plan-row .global-plans-table__actions--icon-only .global-plans-table__btn i {
  font-size: 0.88rem;
  line-height: 1;
  color: currentColor;
}

.my-plan-row .global-plans-table__btn--open,
.my-plan-row .global-plans-table__btn--open:is(:hover, :focus, :focus-visible, :active, .active, [aria-pressed="true"]) {
  background: #2563eb !important;
  border-color: #1d4ed8 !important;
  color: #ffffff !important;
}

.my-plan-row .global-plans-table__btn--edit,
.my-plan-row .global-plans-table__btn--edit:is(:hover, :focus, :focus-visible, :active, .active, [aria-pressed="true"]) {
  background: #d97706 !important;
  border-color: #b45309 !important;
  color: #ffffff !important;
}

.my-plan-row .global-plans-table__btn--delete,
.my-plan-row .global-plans-table__btn--delete:is(:hover, :focus, :focus-visible, :active, .active, [aria-pressed="true"]) {
  background: #dc2626 !important;
  border-color: #b91c1c !important;
  color: #ffffff !important;
}

.my-plan-row .global-plans-table__actions--icon-only .global-plans-table__btn:focus-visible {
  outline: 2px solid rgba(191, 219, 254, 0.85);
  outline-offset: 1px;
}

.my-plan-row .global-plans-table__actions--icon-only .global-plans-table__btn:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

@media (max-width: 800px) {
  .my-plan-row td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0;
    border-top: none;
    white-space: normal;
    color: #e7eefc;
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .my-plan-row td::before {
    content: attr(data-label);
    color: #a9bddf;
    font-size: 0.72rem;
    font-weight: 700;
    min-width: 92px;
    flex-shrink: 0;
  }

  .my-plan-row td:first-child {
    display: block;
  }

  .my-plan-row td:first-child::before {
    content: none;
  }

  .my-plan-row .marketplace-plan-name-cell {
    gap: 10px;
  }

  .my-plan-row .marketplace-plan-name-content .fw-semibold {
    color: #f8fbff;
    font-size: 0.96rem;
    line-height: 1.3;
  }

  .my-plan-row .marketplace-plan-inline-status {
    color: #a9bddf;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .my-plan-row .global-library-table__actions-cell {
    justify-content: flex-end;
  }

  .my-plan-row .global-library-table__actions-cell::before {
    content: 'Actions';
  }

  .my-plan-row .global-plans-table__actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    width: auto;
  }

  .my-plan-row .global-plans-table__actions--icon-only .global-plans-table__btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
