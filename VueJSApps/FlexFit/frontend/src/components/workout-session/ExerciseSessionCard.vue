<script setup>
const props = defineProps({
  exercise: {
    type: Object,
    required: true,
  },
  isCardio: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['add-set', 'remove-set', 'update-set']);
</script>

<template>
  <article class="session-exercise-card">
    <!-- Exercise Header -->
    <div class="sec-header">
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
      <span class="sec-type-chip">{{ exercise.workoutType || 'Strength' }}</span>
    </div>

    <!-- ── STRENGTH Sets Table ─────────────────────────────────────────── -->
    <div v-if="!isCardio" class="sec-sets-table">
      <div class="sec-sets-head">
        <span class="col-set">Set</span>
        <span class="col-weight">Weight (kg)</span>
        <span class="col-reps">Reps</span>
        <span class="col-done">Done</span>
        <span class="col-rm"></span>
      </div>
      <div
        v-for="(set, idx) in exercise.sessionSets"
        :key="idx"
        class="sec-set-row"
        :class="{ 'set-done': set.done }"
      >
        <span class="col-set set-num">{{ set.setNum }}</span>
        <input
          type="number"
          class="col-weight set-input"
          :value="set.weight"
          min="0"
          step="0.5"
          placeholder="0"
          @input="emit('update-set', exercise.id, idx, 'weight', $event.target.value)"
        />
        <input
          type="number"
          class="col-reps set-input"
          :value="set.reps"
          min="0"
          placeholder="0"
          @input="emit('update-set', exercise.id, idx, 'reps', $event.target.value)"
        />
        <label class="col-done done-toggle" :class="{ active: set.done }">
          <input
            type="checkbox"
            :checked="set.done"
            @change="emit('update-set', exercise.id, idx, 'done', $event.target.checked)"
          />
          <span class="done-icon">
            <i v-if="set.done" class="fa-solid fa-circle-check"></i>
            <i v-else class="fa-regular fa-circle"></i>
          </span>
        </label>
        <button
          type="button"
          class="col-rm remove-set-btn"
          :disabled="exercise.sessionSets.length <= 1"
          title="Remove set"
          @click="emit('remove-set', exercise.id, idx)"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>

    <!-- ── CARDIO Sets Table ───────────────────────────────────────────── -->
    <div v-if="isCardio" class="sec-sets-table cardio-table">
      <!-- Desktop header (hidden on mobile) -->
      <div class="sec-sets-head cardio-head">
        <span class="col-set">Set</span>
        <span>Duration (min)</span>
        <span class="col-done">Done</span>
        <span class="col-rm"></span>
      </div>

      <!-- One block per set -->
      <div
        v-for="(set, idx) in exercise.sessionSets"
        :key="idx"
        class="cardio-set-block"
        :class="{ 'set-done': set.done }"
      >
        <!-- Row 1: Set# | Duration | Done | Remove -->
        <div class="cardio-row-primary">
          <span class="col-set set-num">{{ set.setNum }}</span>
          <div class="cardio-dur-cell">
            <input
              type="number"
              class="set-input"
              :value="set.duration"
              min="0"
              placeholder="0"
              @input="emit('update-set', exercise.id, idx, 'duration', $event.target.value)"
            />
            <span class="cardio-inline-label">Duration (min)</span>
          </div>
          <label class="col-done done-toggle" :class="{ active: set.done }">
            <input
              type="checkbox"
              :checked="set.done"
              @change="emit('update-set', exercise.id, idx, 'done', $event.target.checked)"
            />
            <span class="done-icon">
              <i v-if="set.done" class="fa-solid fa-circle-check"></i>
              <i v-else class="fa-regular fa-circle"></i>
            </span>
          </label>
          <button
            type="button"
            class="col-rm remove-set-btn"
            :disabled="exercise.sessionSets.length <= 1"
            title="Remove set"
            @click="emit('remove-set', exercise.id, idx)"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Row 2 (desktop) / Rows 2-4 (mobile): Calories | Distance | Speed -->
        <div class="cardio-row-secondary">
          <span class="cardio-secondary-spacer"></span>
          <div class="cardio-extra-group">
            <!-- Calories -->
            <div class="cardio-extra-field">
              <span class="cardio-mob-set">{{ set.setNum }}</span>
              <input
                type="number"
                class="set-input"
                :value="set.caloriesBurned"
                min="0"
                placeholder="0"
                @input="emit('update-set', exercise.id, idx, 'caloriesBurned', $event.target.value)"
              />
              <span class="cardio-field-label">Calories Burned</span>
              <span class="cardio-mob-blank"></span>
            </div>
            <!-- Distance -->
            <div class="cardio-extra-field">
              <span class="cardio-mob-set">{{ set.setNum }}</span>
              <input
                type="number"
                class="set-input"
                :value="set.distanceMiles"
                min="0"
                step="0.01"
                placeholder="0.00"
                @input="emit('update-set', exercise.id, idx, 'distanceMiles', $event.target.value)"
              />
              <span class="cardio-field-label">Distance (mi)</span>
              <span class="cardio-mob-blank"></span>
            </div>
            <!-- Speed -->
            <div class="cardio-extra-field">
              <span class="cardio-mob-set">{{ set.setNum }}</span>
              <input
                type="number"
                class="set-input"
                :value="set.speedMph"
                min="0"
                step="0.1"
                placeholder="0.0"
                @input="emit('update-set', exercise.id, idx, 'speedMph', $event.target.value)"
              />
              <span class="cardio-field-label">Speed (mph)</span>
              <span class="cardio-mob-blank"></span>
            </div>
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
    </div>
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
  transition: box-shadow 0.18s ease;
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

/* ─── Cardio Layout ───────────────────────── */
.cardio-table {
  gap: 8px;
}

.cardio-head {
  grid-template-columns: 36px 1fr 44px 30px;
}

.cardio-set-block {
  display: grid;
  gap: 5px;
  padding: 4px 0;
  border-radius: 8px;
  transition: background 0.14s ease;
}

.cardio-set-block.set-done {
  background: #f0fdf4;
}

/* Desktop Row 1: Set# | Duration | Done | Remove */
.cardio-row-primary {
  display: grid;
  grid-template-columns: 36px 1fr 44px 30px;
  gap: 8px;
  align-items: center;
}

.cardio-dur-cell {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

/* The inline label is hidden on desktop (header handles it) */
.cardio-inline-label {
  display: none;
}

/* Desktop Row 2: (spacer) | [Calories | Distance | Speed] */
.cardio-row-secondary {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 8px;
  align-items: start;
}

.cardio-secondary-spacer {
  display: block;
}

.cardio-extra-group {
  display: flex;
  gap: 8px;
}

/* Each field: input on top, label below */
.cardio-extra-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.cardio-field-label {
  font-size: 0.67rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
}

/* Mobile set# inside each extra field — hidden on desktop */
.cardio-mob-set {
  display: none;
}

.cardio-mob-blank {
  display: none;
}

/* ─── Done Toggle ─────────────────────────── */
.done-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.done-toggle input[type='checkbox'] {
  display: none;
}

.done-icon {
  font-size: 1.2rem;
  color: #d1d5db;
  transition: color 0.15s ease;
}

.done-toggle.active .done-icon {
  color: #22c55e;
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

/* ─── Cardio Mobile Layout ────────────────── */
@media (max-width: 575px) {
  /* Hide the desktop-only header */
  .cardio-head {
    display: none;
  }

  /* Row 1: Set# | [input+label stacked] | Done | Remove */
  .cardio-row-primary {
    grid-template-columns: 28px 1fr auto auto;
    gap: 6px;
  }

  /* Show the label below the duration input on mobile */
  .cardio-inline-label {
    display: block;
    font-size: 0.68rem;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: center;
    margin-top: 2px;
  }

  /* Row 2 becomes a vertical stack — no spacer needed */
  .cardio-row-secondary {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .cardio-secondary-spacer {
    display: none;
  }

  /* Each field becomes its own 4-col row: Set# | Input | Label | (blank) */
  .cardio-extra-group {
    flex-direction: column;
    gap: 4px;
  }

  .cardio-extra-field {
    flex: none;
    display: grid;
    grid-template-columns: 28px 1fr auto 32px;
    gap: 6px;
    align-items: center;
  }

  /* Show set# badge on mobile */
  .cardio-mob-set {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 700;
    color: #6b7280;
  }

  /* Label becomes inline text, not uppercase small */
  .cardio-field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: none;
    letter-spacing: 0;
    text-align: left;
    white-space: nowrap;
  }

  .cardio-mob-blank {
    display: block;
  }

  /* Tighten inputs on mobile */
  .set-input {
    padding: 5px 6px;
    font-size: 0.82rem;
  }
}
</style>
