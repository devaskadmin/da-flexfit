<script setup>
import { ref } from 'vue'

const props = defineProps({
  metadata: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update:metadata']);

const updateField = (field, value) => {
  emit('update:metadata', {
    ...props.metadata,
    [field]: value,
  });
};

const isWorkoutGoalOpen = ref(false)

const toggleWorkoutGoal = () => {
  isWorkoutGoalOpen.value = !isWorkoutGoalOpen.value
}
</script>

<template>
  <div class="builder-metadata-layout">
    <label class="builder-field">
      <span>Workout Name</span>
      <input
        :value="metadata.name"
        type="text"
        placeholder="e.g., Upper Body Power"
        @input="updateField('name', $event.target.value)"
      />
    </label>

    <section class="workout-goal-panel" aria-label="Workout Goal settings">
      <button
        type="button"
        class="workout-goal-panel__header"
        :aria-expanded="isWorkoutGoalOpen"
        @click="toggleWorkoutGoal"
      >
        <span class="workout-goal-panel__label">
          <i class="fa-solid fa-bullseye workout-goal-panel__title-icon" aria-hidden="true"></i>
          <span class="workout-goal-panel__title">Workout Goals</span>
        </span>
        <span class="workout-goal-panel__icon" :class="{ open: isWorkoutGoalOpen }" aria-hidden="true">
          <i class="fa-solid fa-chevron-down"></i>
        </span>
      </button>

      <transition name="inner-panel-collapse">
        <div v-show="isWorkoutGoalOpen" class="workout-goal-panel__body">
          <div class="builder-grid">
            <label class="builder-field builder-field--wide">
              <span>Description</span>
              <textarea
                :value="metadata.description"
                rows="3"
                placeholder="Goal, pacing, or notes for this workout"
                @input="updateField('description', $event.target.value)"
              />
            </label>

            <label class="builder-field">
              <span>Workout Type</span>
              <select :value="metadata.type" @change="updateField('type', $event.target.value)">
                <option value="Strength">Strength</option>
                <option value="Cardio">Cardio</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Mobility">Mobility</option>
              </select>
            </label>

            <label class="builder-field">
              <span>Estimated Duration (min)</span>
              <input
                :value="metadata.estimatedDuration"
                type="number"
                min="1"
                placeholder="45"
                @input="updateField('estimatedDuration', Number($event.target.value || 0))"
              />
            </label>
          </div>
        </div>
      </transition>
    </section>
  </div>
</template>

<style scoped>
.builder-metadata-layout {
  display: grid;
  gap: 16px;
}

.builder-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.builder-field {
  display: grid;
  gap: 8px;
}

.builder-field--wide {
  grid-column: span 1;
}

.builder-field span {
  font-size: 0.88rem;
  font-weight: 700;
  color: #1e293b;
}

.builder-field input,
.builder-field select,
.builder-field textarea {
  width: 100%;
  border: 1px solid #d9e2ef;
  border-radius: 12px;
  background: #f8fafc;
  min-height: 48px;
  padding: 11px 12px;
  color: #0f172a;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.builder-field input:focus,
.builder-field select:focus,
.builder-field textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
  background: #ffffff;
}

.builder-field textarea {
  min-height: 110px;
  resize: vertical;
}

.workout-goal-panel {
  border: 1px solid #d9e2ef;
  border-radius: 14px;
  background: #f8fafc;
  overflow: hidden;
}

.workout-goal-panel__header {
  width: 100%;
  border: 0;
  border-bottom: 1px solid #e2e8f0;
  background: #f1f5f9;
  color: #0f172a;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.workout-goal-panel__title {
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.workout-goal-panel__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.workout-goal-panel__title-icon {
  font-size: 0.82rem;
  color: #475569;
}

.workout-goal-panel__icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid #dbe6f5;
  background: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #334155;
  transition: transform 0.2s ease;
}

.workout-goal-panel__icon.open {
  transform: rotate(180deg);
}

.workout-goal-panel__body {
  padding: 14px;
}

.inner-panel-collapse-enter-active,
.inner-panel-collapse-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: top;
}

.inner-panel-collapse-enter-from,
.inner-panel-collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (min-width: 900px) {
  .builder-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .builder-field--wide {
    grid-column: span 2;
  }

  .workout-goal-panel__body {
    padding: 16px;
  }
}
</style>
