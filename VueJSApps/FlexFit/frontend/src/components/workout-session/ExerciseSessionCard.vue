<script setup>
import { computed } from 'vue';

const props = defineProps({
  exercise: {
    type: Object,
    required: true,
  },
  isCardio: {
    type: Boolean,
    default: false,
  },
  isExpanded: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['add-set', 'remove-set', 'update-set', 'select', 'exercise-completed']);

function completeExercise(exerciseId) {
  props.exercise.sessionSets.forEach((set, idx) => {
    if (!set.done) {
      emit('update-set', exerciseId, idx, 'done', true);
    }
  });
  emit('exercise-completed', exerciseId);
}

const workoutType = computed(() => {
  const raw = String(
    props.exercise.WorkoutType ||
    props.exercise.workoutType ||
    ''
  ).trim().toLowerCase();
  if (raw === 'cardio') return 'cardio';
  if (raw === 'other') return 'other';
  if (raw === 'strength') return 'strength';
  // Legacy fallback: honour the isCardio prop, default to strength
  if (props.isCardio) return 'cardio';
  return 'strength';
});

const completedSets = computed(() =>
  props.exercise.sessionSets.filter((s) => s.done).length
);
const totalSets = computed(() => props.exercise.sessionSets.length);
const allDone = computed(() => completedSets.value === totalSets.value && totalSets.value > 0);
</script>

<template>
  <article class="session-exercise-card" :class="{ 'session-exercise-card--active': isExpanded, 'session-exercise-card--done': allDone }">
    <!-- Exercise Header -->
    <div class="sec-header" :class="{ 'sec-header--active': isExpanded }" @click="emit('select', exercise.id)">
      <div class="sec-identity">
        <img
          v-if="exercise.image"
          :src="exercise.image"
          :alt="exercise.name"
          class="sec-thumb"
        />
        <div v-else class="sec-thumb-placeholder">
          <i class="fa-solid fa-dumbbell"></i>
        </div>
        <div class="sec-meta">
          <h5>{{ exercise.name }}</h5>
          <p>
            <span v-if="exercise.muscleGroup">{{ exercise.muscleGroup }}</span>
            <span v-if="exercise.muscleGroup && exercise.equipment"> · </span>
            <span v-if="exercise.equipment">{{ exercise.equipment }}</span>
          </p>
        </div>
      </div>
      <div class="sec-header-actions">
        <span class="sec-type-chip">{{ exercise.workoutType || 'Strength' }}</span>
        <span class="sec-sets-summary" :class="{ 'sec-sets-summary--done': allDone }">
          <i v-if="allDone" class="fa-solid fa-circle-check"></i>
          <i v-else class="fa-regular fa-circle"></i>
          {{ completedSets }} / {{ totalSets }}
        </span>
        <button
          type="button"
          class="sec-select-btn"
          :class="{ 'sec-select-btn--active': isExpanded }"
          @click.stop="emit('select', exercise.id)"
        >
          <i :class="isExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
          {{ isExpanded ? 'Collapse' : 'Select Exercise' }}
        </button>
      </div>
    </div>

    <!-- ── Collapsible body ─────────────────────────────────────────────── -->
    <div v-show="isExpanded" class="sec-body">

    <!-- ── STRENGTH Sets Table ─────────────────────────────────────────── -->
    <div v-if="workoutType === 'strength'" class="cardio-table-wrap">
      <div class="cardio-3col-table">
        <div class="c3-head">
          <span class="c3-col-set">Set</span>
          <span class="c3-col-info">Info</span>
          <span class="c3-col-value">Value</span>
        </div>
        <div
          v-for="(set, idx) in exercise.sessionSets"
          :key="idx"
          class="c3-set-group"
          :class="{ 'c3-set-done': set.done }"
        >
          <!-- Weight row -->
          <div class="c3-row">
            <span class="c3-col-set c3-set-num">{{ set.setNum }}</span>
            <span class="c3-col-info">Weight (kg)</span>
            <div class="c3-col-value">
              <input
                type="number"
                class="set-input"
                :value="set.weight"
                min="0"
                step="0.5"
                placeholder="0"
                @input="emit('update-set', exercise.id, idx, 'weight', $event.target.value)"
              />
            </div>
          </div>
          <!-- Reps row -->
          <div class="c3-row">
            <span class="c3-col-set"></span>
            <span class="c3-col-info">Reps</span>
            <div class="c3-col-value">
              <input
                type="number"
                class="set-input"
                :value="set.reps"
                min="0"
                placeholder="0"
                @input="emit('update-set', exercise.id, idx, 'reps', $event.target.value)"
              />
            </div>
          </div>
          <!-- Action row -->
          <div class="c3-row c3-row-done">
            <span class="c3-col-set"></span>
            <div class="c3-col-info c3-info-action">
              <button
                v-if="exercise.sessionSets.length > 1"
                type="button"
                class="c3-rm-btn"
                title="Remove this set"
                @click="emit('remove-set', exercise.id, idx)"
              >
                <i class="fa-solid fa-minus"></i> Remove Set
              </button>
            </div>
            <div class="c3-col-value c3-done-cell">
              <button
                type="button"
                class="c3-complete-btn"
                :class="{ 'c3-complete-btn--done': set.done }"
                @click="emit('update-set', exercise.id, idx, 'done', !set.done)"
              >
                <i v-if="set.done" class="fa-solid fa-circle-check"></i>
                <i v-else class="fa-regular fa-circle"></i>
                {{ set.done ? 'Set Done' : 'Complete Set' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── OTHER Sets Table ──────────────────────────────────────────── -->
    <div v-if="workoutType === 'other'" class="cardio-table-wrap">
      <div class="cardio-3col-table">
        <div class="c3-head">
          <span class="c3-col-set">Set</span>
          <span class="c3-col-info">Info</span>
          <span class="c3-col-value">Value</span>
        </div>
        <div
          v-for="(set, idx) in exercise.sessionSets"
          :key="idx"
          class="c3-set-group"
          :class="{ 'c3-set-done': set.done }"
        >
          <!-- Duration row -->
          <div class="c3-row">
            <span class="c3-col-set c3-set-num">{{ set.setNum }}</span>
            <span class="c3-col-info">Duration (min)</span>
            <div class="c3-col-value">
              <input
                type="number"
                class="set-input"
                :value="set.duration ?? 0"
                min="0"
                placeholder="0"
                @input="emit('update-set', exercise.id, idx, 'duration', $event.target.value)"
              />
            </div>
          </div>
          <!-- Notes row -->
          <div class="c3-row">
            <span class="c3-col-set"></span>
            <span class="c3-col-info">Notes</span>
            <div class="c3-col-value">
              <input
                type="text"
                class="set-input set-input--text"
                :value="set.notes ?? ''"
                placeholder="Optional notes"
                @input="emit('update-set', exercise.id, idx, 'notes', $event.target.value)"
              />
            </div>
          </div>
          <!-- Action row -->
          <div class="c3-row c3-row-done">
            <span class="c3-col-set"></span>
            <div class="c3-col-info c3-info-action">
              <button
                v-if="exercise.sessionSets.length > 1"
                type="button"
                class="c3-rm-btn"
                title="Remove this set"
                @click="emit('remove-set', exercise.id, idx)"
              >
                <i class="fa-solid fa-minus"></i> Remove Set
              </button>
            </div>
            <div class="c3-col-value c3-done-cell">
              <button
                type="button"
                class="c3-complete-btn"
                :class="{ 'c3-complete-btn--done': set.done }"
                @click="emit('update-set', exercise.id, idx, 'done', !set.done)"
              >
                <i v-if="set.done" class="fa-solid fa-circle-check"></i>
                <i v-else class="fa-regular fa-circle"></i>
                {{ set.done ? 'Set Done' : 'Complete Set' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── CARDIO Sets Table ─────────────────────────────────────────── -->
    <div v-if="workoutType === 'cardio'" class="cardio-table-wrap">
      <div class="cardio-3col-table">
      <!-- Header -->
      <div class="c3-head">
        <span class="c3-col-set">Set</span>
        <span class="c3-col-info">Info</span>
        <span class="c3-col-value">Value</span>
      </div>

      <!-- Per-set group -->
      <div
        v-for="(set, idx) in exercise.sessionSets"
        :key="idx"
        class="c3-set-group"
        :class="{ 'c3-set-done': set.done }"
      >
        <!-- Duration row -->
        <div class="c3-row">
          <span class="c3-col-set c3-set-num">{{ set.setNum }}</span>
          <span class="c3-col-info">Duration (min)</span>
          <div class="c3-col-value">
            <input
              type="number"
              class="set-input"
              :value="set.duration"
              min="0"
              placeholder="0"
              @input="emit('update-set', exercise.id, idx, 'duration', $event.target.value)"
            />
          </div>
        </div>
        <!-- Calories row -->
        <div class="c3-row">
          <span class="c3-col-set"></span>
          <span class="c3-col-info">Calories Burned</span>
          <div class="c3-col-value">
            <input
              type="number"
              class="set-input"
              :value="set.caloriesBurned"
              min="0"
              placeholder="0"
              @input="emit('update-set', exercise.id, idx, 'caloriesBurned', $event.target.value)"
            />
          </div>
        </div>
        <!-- Distance row -->
        <div class="c3-row">
          <span class="c3-col-set"></span>
          <span class="c3-col-info">Distance (Miles)</span>
          <div class="c3-col-value">
            <input
              type="number"
              class="set-input"
              :value="set.distanceMiles"
              min="0"
              step="0.01"
              placeholder="0.00"
              @input="emit('update-set', exercise.id, idx, 'distanceMiles', $event.target.value)"
            />
          </div>
        </div>
        <!-- Speed row -->
        <div class="c3-row">
          <span class="c3-col-set"></span>
          <span class="c3-col-info">Speed (Mph)</span>
          <div class="c3-col-value">
            <input
              type="number"
              class="set-input"
              :value="set.speedMph"
              min="0"
              step="0.1"
              placeholder="0.0"
              @input="emit('update-set', exercise.id, idx, 'speedMph', $event.target.value)"
            />
          </div>
        </div>
        <!-- Completed row -->
        <div class="c3-row c3-row-done">
          <span class="c3-col-set"></span>
          <div class="c3-col-info c3-info-action">
            <button
              v-if="exercise.sessionSets.length > 1"
              type="button"
              class="c3-rm-btn"
              title="Remove this set"
              @click="emit('remove-set', exercise.id, idx)"
            >
              <i class="fa-solid fa-minus"></i> Remove Set
            </button>
          </div>
          <div class="c3-col-value c3-done-cell">
            <button
              type="button"
              class="c3-complete-btn"
              :class="{ 'c3-complete-btn--done': set.done }"
              @click="emit('update-set', exercise.id, idx, 'done', !set.done)"
            >
              <i v-if="set.done" class="fa-solid fa-circle-check"></i>
              <i v-else class="fa-regular fa-circle"></i>
              {{ set.done ? 'Set Done' : 'Complete Set' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Set -->
    <div class="sec-footer">
      <button type="button" class="add-set-btn" @click="emit('add-set', exercise.id)">
        <i class="fa-solid fa-plus"></i> Add Set
      </button>

      <span class="sec-summary">
        {{ exercise.sessionSets.filter((s) => s.done).length }} /
        {{ exercise.sessionSets.length }} sets completed
      </span>

      <button
        type="button"
        class="c3-finish-btn"
        :class="{ 'c3-finish-btn--done': exercise.sessionSets.every((s) => s.done) }"
        @click="completeExercise(exercise.id)"
      >
        <i class="fa-solid fa-flag-checkered"></i> Complete Exercise
      </button>
    </div>

    </div><!-- end sec-body -->
  </article>
</template>

<style scoped>
.session-exercise-card {
  background: #fff;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  padding: 16px;
  display: grid;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.session-exercise-card--active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.session-exercise-card--done {
  border-color: #86efac;
}

.session-exercise-card:focus-within {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

/* ─── Header ──────────────────────────────── */
.sec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  cursor: pointer;
  user-select: none;
  border-radius: 8px;
  transition: background 0.14s ease;
  margin: -4px;
  padding: 4px;
}

.sec-header:hover {
  background: #f8faff;
}

.sec-header--active {
  background: #eff6ff;
}

.sec-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.sec-sets-summary {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.sec-sets-summary--done {
  color: #16a34a;
}

.sec-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1.5px solid #3b82f6;
  color: #2563eb;
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.14s ease;
  white-space: nowrap;
}

.sec-select-btn:hover {
  background: #eff6ff;
}

.sec-select-btn--active {
  background: #dbeafe;
  border-color: #2563eb;
}

.sec-body {
  display: grid;
  gap: 14px;
}

.sec-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sec-thumb {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--border-color, #e5e7eb);
  flex-shrink: 0;
}

.sec-thumb-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: #eff6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  font-size: 1.1rem;
  flex-shrink: 0;
  border: 1px solid #dbeafe;
}

.sec-meta h5 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-color, #111827);
}

.sec-meta p {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: var(--text-color-secondary, #6b7280);
}

.sec-type-chip {
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  padding: 3px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ─── Sets Table ──────────────────────────── */
.sec-sets-table {
  display: grid;
  gap: 6px;
}

.sec-sets-head,
.sec-set-row {
  display: grid;
  grid-template-columns: 36px 1fr 1fr 44px 30px;
  gap: 8px;
  align-items: center;
}

.sec-sets-head {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-color-secondary, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}

.sec-set-row {
  padding: 4px 0;
  border-radius: 8px;
  transition: background 0.14s ease;
}

.sec-set-row.set-done {
  background: #f0fdf4;
}

.set-num {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-color-secondary, #6b7280);
  text-align: center;
}

.set-input {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 0.85rem;
  background: #f9fafb;
  color: var(--text-color, #111827);
  width: 100%;
  min-width: 0;
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.set-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: #fff;
}

.set-input--text {
  text-align: left;
}

/* ─── Cardio Table Wrapper — full width, no cap */
.cardio-table-wrap {
  width: 100%;
}

/* ─── Cardio 3-Column Table ───────────────── */
.cardio-3col-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  overflow: hidden;
  width: 100%;
}

/* Shared column grid: Set(20%) | Info(40%) | Value(40%) */
.c3-head,
.c3-row {
  display: grid;
  grid-template-columns: 20% 40% 40%;
  align-items: center;
  width: 100%;
}

/* Header row */
.c3-head {
  background: #f9fafb;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  padding: 7px 12px;
}

.c3-head span {
  font-size: 0.70rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Per-set group */
.c3-set-group {
  border-bottom: 2px solid var(--border-color, #e5e7eb);
  transition: background 0.14s ease;
}

.c3-set-group:last-child {
  border-bottom: none;
}

.c3-set-group.c3-set-done {
  background: #f0fdf4;
}

/* Individual field row */
.c3-row {
  padding: 4px 12px;
  border-bottom: 1px solid #f3f4f6;
  gap: 0;
}

.c3-row:last-child {
  border-bottom: none;
}

/* First row of each set gets a subtle tint to mark the group start */
.c3-row:first-child {
  background: rgba(59, 130, 246, 0.04);
}

.c3-set-group.c3-set-done .c3-row:first-child {
  background: rgba(34, 197, 94, 0.08);
}

.c3-col-set {
  font-size: 0.82rem;
  font-weight: 700;
  color: #6b7280;
  text-align: center;
}

.c3-set-num {
  font-size: 0.92rem;
  font-weight: 800;
  color: #374151;
}

.c3-col-info {
  font-size: 0.84rem;
  color: #374151;
  font-weight: 500;
  padding: 0 12px 0 0;
}

.c3-col-value {
  min-width: 0;
  padding: 3px 0;
}

/* Value inputs — constrained to their column */
.c3-col-value .set-input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* Completed row — light gray bg + top separator */
.c3-row-done {
  border-top: 1px solid var(--border-color, #e5e7eb) !important;
  background: #f9fafb !important;
}

.c3-set-group.c3-set-done .c3-row-done {
  background: #f0fdf4 !important;
}

.c3-info-action {
  display: flex;
  align-items: center;
}
.c3-done-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Remove Set Button ──────────────── */
.c3-rm-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid #fca5a5;
  color: #dc2626;
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.c3-rm-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

/* ─── Complete Set Button (per-set) ───────────── */
.c3-complete-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 4px 11px;
  font-size: 0.77rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}

.c3-complete-btn:hover {
  background: #15803d;
}

.c3-complete-btn--done {
  background: #166534;
  opacity: 0.85;
  cursor: default;
}

.c3-complete-btn--done:hover {
  background: #166534;
}

/* ─── Complete Exercise Button (entire exercise) ─── */
.c3-finish-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 9px;
  padding: 7px 16px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(22,163,74,0.18);
}

.c3-finish-btn:hover {
  background: #15803d;
}

.c3-finish-btn--done {
  background: #166534;
  opacity: 0.8;
  cursor: default;
}

.c3-finish-btn--done:hover {
  background: #166534;
}

/* ─── Remove Set ──────────────────────────── */
.remove-set-btn {
  background: none;
  border: none;
  color: #d1d5db;
  font-size: 0.75rem;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-set-btn:hover:not(:disabled) {
  color: #ef4444;
}

.remove-set-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ─── Footer ──────────────────────────────── */
.sec-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid var(--border-color, #f3f4f6);
}

.add-set-btn {
  background: none;
  border: 1px solid #3b82f6;
  color: #2563eb;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease, color 0.15s ease;
}

.add-set-btn:hover {
  background: #eff6ff;
}

.sec-summary {
  font-size: 0.78rem;
  color: var(--text-color-secondary, #6b7280);
}

/* ─── Cardio Mobile ───────────────────────── */
@media (max-width: 600px) {
  .c3-col-info {
    font-size: 0.78rem;
    padding-right: 6px;
  }

  .c3-col-set {
    font-size: 0.78rem;
  }

  .c3-head {
    padding: 6px 10px;
  }

  .c3-row {
    padding: 3px 10px;
  }

  .set-input {
    padding: 5px 6px;
    font-size: 0.82rem;
  }

  .c3-complete-btn {
    padding: 5px 10px;
    font-size: 0.78rem;
  }
}
</style>
