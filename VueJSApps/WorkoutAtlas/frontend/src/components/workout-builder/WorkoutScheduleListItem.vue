<script setup>
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
</script>

<template>
  <article class="schedule-card" :class="{ selected }">
    <div class="schedule-card__body">
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
        <button type="button" class="schedule-btn schedule-btn--ghost" @click="emit('open', schedule)">
          Open
        </button>
        <button type="button" class="schedule-btn schedule-btn--primary" @click="emit('edit', schedule)">
          Edit
        </button>
        <button type="button" class="schedule-btn schedule-btn--danger" :disabled="deleting" @click="emit('delete', schedule)">
          {{ deleting ? 'Deleting...' : 'Delete' }}
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
  flex-wrap: wrap;
}

.schedule-btn {
  border-radius: 10px;
  min-height: 38px;
  padding: 0 12px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.schedule-btn--ghost {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}

.schedule-btn--ghost:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}

.schedule-btn--primary {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
}

.schedule-btn--primary:hover {
  background: #1d4ed8;
}

.schedule-btn--danger {
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #b91c1c;
}

.schedule-btn--danger:hover:not(:disabled) {
  background: #ffe4e6;
}

.schedule-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .schedule-card__body {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
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
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
  }

  .schedule-btn {
    width: 100%;
    min-width: 0;
    min-height: 40px;
    border-radius: 999px;
    font-size: 13px;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (max-width: 390px) {
  .schedule-card__actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .schedule-btn--danger {
    grid-column: 1 / -1;
  }
}
</style>
